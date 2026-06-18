import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, formatDateLong } from "@/components/AppShell";

export const Route = createFileRoute("/previsioni")({ component: PrevisioniPage });

/* ============================================================
   Calendario / festività Italia
   ============================================================ */

// Pasqua (algoritmo Gauss/Meeus) — restituisce YYYY-MM-DD
function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function holidaysForYear(year: number): Set<string> {
  const easter = easterDate(year);
  const lunedi = addDays(easter, 1);
  return new Set([
    `${year}-01-01`, // Capodanno
    `${year}-01-06`, // Epifania
    easter,
    lunedi,
    `${year}-04-25`, // Liberazione
    `${year}-05-01`, // Lavoro
    `${year}-06-02`, // Repubblica
    `${year}-08-15`, // Ferragosto
    `${year}-11-01`, // Ognissanti
    `${year}-12-08`, // Immacolata
    `${year}-12-25`, // Natale
    `${year}-12-26`, // S. Stefano
  ]);
}

type DayType = "feriale" | "sabato" | "domenica" | "festivo" | "vigilia_festivo";

function dayType(iso: string): DayType {
  const d = new Date(iso + "T00:00:00");
  const year = d.getFullYear();
  const holidays = holidaysForYear(year);
  const tomorrow = addDays(iso, 1);
  if (holidays.has(iso)) return "festivo";
  if (holidays.has(tomorrow)) return "vigilia_festivo";
  const wd = d.getDay(); // 0=dom, 6=sab
  if (wd === 0) return "domenica";
  if (wd === 6) return "sabato";
  return "feriale";
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  feriale: "Feriale",
  sabato: "Sabato",
  domenica: "Domenica",
  festivo: "Festivo",
  vigilia_festivo: "Vigilia di festivo",
};

const DAY_TYPE_COLOR: Record<DayType, string> = {
  feriale: "bg-card text-foreground/70",
  sabato: "bg-brand-gold/10 text-brand-gold",
  domenica: "bg-danger/10 text-danger",
  festivo: "bg-danger/15 text-danger font-semibold",
  vigilia_festivo: "bg-brand-gold/15 text-brand-gold font-semibold",
};

/* ============================================================
   Algoritmo suggerimento (semplice, robusto)
   ============================================================ */

interface SuggestionInput {
  date: string;
  productId: string;
  history: { date: string; productId: string; ordered: number; sold?: number; leftoverPrev?: number }[];
}

function computeSuggestion({ date, productId, history }: SuggestionInput): { value: number | null; basedOn: number; note: string } {
  const targetType = dayType(date);
  const target = new Date(date + "T00:00:00").getTime();
  // ultime occorrenze stesso day-type, prima della data target, con vendita registrata
  const candidates = history
    .filter(h => h.productId === productId)
    .filter(h => new Date(h.date + "T00:00:00").getTime() < target)
    .filter(h => dayType(h.date) === targetType)
    .filter(h => typeof h.sold === "number" && h.sold >= 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  if (candidates.length === 0) {
    return { value: null, basedOn: 0, note: `Nessuno storico per ${DAY_TYPE_LABEL[targetType].toLowerCase()}` };
  }

  const weights = [0.4, 0.3, 0.2, 0.1].slice(0, candidates.length);
  const wsum = weights.reduce((s, w) => s + w, 0);
  const weighted = candidates.reduce((s, c, i) => s + (c.sold ?? 0) * weights[i], 0) / wsum;

  // Disponibile = ordinato + residuo dal giorno precedente
  const available = (c: typeof candidates[number]) => c.ordered + (c.leftoverPrev ?? 0);

  let adjusted = weighted;
  const soldOuts = candidates.filter(c => (c.sold ?? 0) >= available(c) && available(c) > 0).length;
  const leftovers = candidates
    .filter(c => available(c) > 0)
    .map(c => Math.max(0, available(c) - (c.sold ?? 0)) / available(c));
  const avgLeftoverPct = leftovers.length > 0 ? leftovers.reduce((s, v) => s + v, 0) / leftovers.length : 0;

  let note = `Media ultime ${candidates.length} ${DAY_TYPE_LABEL[targetType].toLowerCase()} (su tot. disponibile = ordinato + residuo)`;
  if (candidates.length >= 3 && soldOuts >= 3) { adjusted *= 1.1; note += " · +10% (esauriti)"; }
  else if (avgLeftoverPct > 0.15) { adjusted *= 0.95; note += " · −5% (avanzo)"; }

  return { value: Math.round(adjusted * 10) / 10, basedOn: candidates.length, note };
}

/* ============================================================
   Helpers settimana
   ============================================================ */

function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const wd = d.getDay(); // 0=dom
  const diff = wd === 0 ? -6 : 1 - wd; // settimana inizia lunedì
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function shortDay(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/* ============================================================
   Componente principale
   ============================================================ */

function PrevisioniPage() {
  const { products, dailyForecasts, updateProduct, upsertDailyForecast } = useStore();
  const [weekStart, setWeekStart] = useState<string>(startOfWeek(todayIso()));
  const [editCell, setEditCell] = useState<{ date: string; productId: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const dailyProducts = useMemo(() => products.filter(p => p.dailyForecast), [products]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const forecastByKey = useMemo(() => {
    const m = new Map<string, { id: string; ordered: number; sold?: number; notes?: string }>();
    for (const f of dailyForecasts ?? []) m.set(`${f.date}::${f.productId}`, f);
    return m;
  }, [dailyForecasts]);

  const today = todayIso();

  return (
    <div>
      <TopBar
        title="Previsioni giornaliere"
        subtitle="Ordinato · venduto · suggerito per prodotto"
        right={
          <button onClick={() => setShowSetup(true)}
            className="bg-brand-gold text-brand-green rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap">
            Prodotti monitorati
          </button>
        }
      />

      {/* Navigatore settimana */}
      <div className="px-4 md:px-6 pt-4 flex items-center justify-between gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm">← Settimana prec.</button>
        <div className="text-center">
          <p className="font-display text-sm text-brand-green">
            {formatDateLong(weekStart)} → {formatDateLong(addDays(weekStart, 6))}
          </p>
          <button onClick={() => setWeekStart(startOfWeek(todayIso()))}
            className="text-[11px] text-muted-foreground underline">vai a oggi</button>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm">Settimana succ. →</button>
      </div>

      {/* Riga tipo-giornata */}
      <div className="px-4 md:px-6 pt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map(d => {
            const t = dayType(d);
            const isToday = d === today;
            return (
              <div key={d}
                className={`text-center rounded-lg px-1.5 py-1.5 text-[10px] ${DAY_TYPE_COLOR[t]} ${isToday ? "ring-2 ring-brand-green" : ""}`}>
                <p className="font-semibold">{shortDay(d)}</p>
                <p className="opacity-75 text-[9px] mt-0.5">{DAY_TYPE_LABEL[t]}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista prodotti × giorni */}
      <div className="p-4 md:p-6 space-y-3">
        {dailyProducts.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
            <p className="text-sm text-foreground/80 mb-3">
              Nessun prodotto attivato per le previsioni giornaliere.
            </p>
            <button onClick={() => setShowSetup(true)}
              className="bg-brand-green text-brand-cream rounded-lg px-4 py-2 text-sm font-semibold">
              Scegli i prodotti da monitorare
            </button>
            <p className="text-[11px] text-muted-foreground mt-3 max-w-md mx-auto">
              Attiva i prodotti che ordini/prepari ogni giorno (mozzarella, pane, ricotta…).
              Il sistema imparerà dallo storico e suggerirà la quantità ideale per ogni giorno della settimana.
            </p>
          </div>
        )}

        {dailyProducts.map(p => (
          <div key={p.id} className="bg-card rounded-xl overflow-hidden border border-border">
            <div className="bg-brand-green/5 px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="font-display text-base text-brand-green">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">unità: {p.unit}</p>
              </div>
              <button onClick={() => updateProduct(p.id, { dailyForecast: false })}
                className="text-[10px] text-muted-foreground hover:text-danger underline">
                disattiva
              </button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border">
              {days.map(d => {
                const key = `${d}::${p.id}`;
                const f = forecastByKey.get(key);
                const sugg = computeSuggestion({
                  date: d, productId: p.id,
                  history: (dailyForecasts ?? []),
                });
                const isToday = d === today;
                const isPast = d < today;
                return (
                  <button key={key} onClick={() => setEditCell({ date: d, productId: p.id })}
                    className={`bg-card hover:bg-brand-green/5 active:bg-brand-green/10 text-left p-2 min-h-[88px] flex flex-col gap-1 transition-colors ${isToday ? "ring-2 ring-brand-green ring-inset" : ""}`}>
                    {/* ordinato */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">ord.</span>
                      <span className={`text-sm font-display ${f?.ordered ? "text-brand-green" : "text-muted-foreground/40"}`}>
                        {f?.ordered ?? "—"}
                      </span>
                    </div>
                    {/* venduto */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">vend.</span>
                      <span className={`text-sm font-display ${typeof f?.sold === "number" ? "text-brand-gold" : "text-muted-foreground/40"}`}>
                        {typeof f?.sold === "number" ? f.sold : "—"}
                      </span>
                    </div>
                    {/* suggerito (futuro) o avanzo (passato) */}
                    {isPast && f && typeof f.sold === "number" ? (
                      <div className="flex items-baseline justify-between">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">av.</span>
                        <span className={`text-xs font-semibold ${(f.ordered - f.sold) > 0 ? "text-danger" : "text-success"}`}>
                          {+(f.ordered - f.sold).toFixed(2)}
                        </span>
                      </div>
                    ) : sugg.value !== null ? (
                      <div className="flex items-baseline justify-between border-t border-border/50 pt-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-brand-green">sugg.</span>
                        <span className="text-sm font-display font-semibold text-brand-green">{sugg.value}</span>
                      </div>
                    ) : (
                      <div className="text-[9px] text-muted-foreground/60 mt-auto italic">no storico</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sheet modifica cella */}
      {editCell && (() => {
        const p = products.find(x => x.id === editCell.productId);
        if (!p) return null;
        const key = `${editCell.date}::${editCell.productId}`;
        const f = forecastByKey.get(key);
        const sugg = computeSuggestion({
          date: editCell.date, productId: editCell.productId,
          history: dailyForecasts ?? [],
        });
        return (
          <ForecastCellSheet
            date={editCell.date}
            product={p}
            initialOrdered={f?.ordered}
            initialSold={f?.sold}
            initialNotes={f?.notes}
            suggestion={sugg}
            onClose={() => setEditCell(null)}
            onSave={(patch) => {
              upsertDailyForecast(editCell.date, editCell.productId, patch);
              setEditCell(null);
            }}
          />
        );
      })()}

      {/* Sheet setup prodotti */}
      {showSetup && (
        <DailySetupSheet onClose={() => setShowSetup(false)} />
      )}
    </div>
  );
}

/* ============================================================
   Sheet: modifica cella (ordinato / venduto / note)
   ============================================================ */

function ForecastCellSheet({ date, product, initialOrdered, initialSold, initialNotes, suggestion, onClose, onSave }: {
  date: string;
  product: { id: string; name: string; unit: "kg" | "pz" };
  initialOrdered?: number;
  initialSold?: number;
  initialNotes?: string;
  suggestion: { value: number | null; basedOn: number; note: string };
  onClose: () => void;
  onSave: (patch: { ordered?: number; sold?: number; notes?: string }) => void;
}) {
  const [ordered, setOrdered] = useState<string>(initialOrdered?.toString() ?? "");
  const [sold, setSold] = useState<string>(initialSold?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const t = dayType(date);

  const save = () => {
    onSave({
      ordered: ordered === "" ? 0 : Number(ordered),
      sold: sold === "" ? undefined : Number(sold),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={`${product.name} · ${formatDateLong(date)}`}
      footer={<button onClick={save} className="w-full bg-brand-green text-brand-cream rounded-xl py-3 font-semibold">Salva</button>}>
      <div className={`rounded-lg px-3 py-2 text-xs ${DAY_TYPE_COLOR[t]}`}>
        Tipo giornata: <strong>{DAY_TYPE_LABEL[t]}</strong>
      </div>

      {suggestion.value !== null && (
        <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-brand-green font-semibold">Suggerito dal sistema</p>
          <p className="font-display text-2xl text-brand-green mt-1">
            {suggestion.value} <span className="text-sm">{product.unit}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{suggestion.note}</p>
          <button type="button" onClick={() => setOrdered(String(suggestion.value))}
            className="mt-2 text-xs bg-brand-green text-brand-cream rounded px-3 py-1.5 font-semibold">
            Usa come ordinato
          </button>
        </div>
      )}
      {suggestion.value === null && (
        <p className="text-[11px] text-muted-foreground italic">
          {suggestion.note}. Servono almeno 1-2 settimane di dati per i primi suggerimenti.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Ordinato (${product.unit})`}>
          <input type="number" step="0.1" inputMode="decimal" value={ordered}
            onChange={e => setOrdered(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3 text-lg font-display" />
        </Field>
        <Field label={`Venduto (${product.unit})`}>
          <input type="number" step="0.1" inputMode="decimal" value={sold}
            onChange={e => setSold(e.target.value)}
            placeholder="a fine giornata"
            className="w-full bg-card border border-border rounded-lg p-3 text-lg font-display" />
        </Field>
      </div>
      <Field label="Note (opzionale)">
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} placeholder="es. evento, maltempo, sagra…"
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

/* ============================================================
   Sheet: setup prodotti giornalieri
   ============================================================ */

function DailySetupSheet({ onClose }: { onClose: () => void }) {
  const { products, updateProduct } = useStore();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products
      .filter(p => p.active !== false)
      .filter(p => !term || p.name.toLowerCase().includes(term))
      .sort((a, b) => Number(!!b.dailyForecast) - Number(!!a.dailyForecast) || a.name.localeCompare(b.name));
  }, [products, q]);

  return (
    <Sheet open={true} onClose={onClose} title="Prodotti giornalieri"
      footer={<button onClick={onClose} className="w-full bg-brand-green text-brand-cream rounded-xl py-3 font-semibold">Fatto</button>}>
      <p className="text-xs text-muted-foreground">
        Attiva i prodotti che ordini o prepari ogni giorno (mozzarella, pane, ricotta, ecc.).
        Compariranno nella griglia delle previsioni.
      </p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto…"
        className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
        {filtered.map(p => (
          <label key={p.id}
            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 cursor-pointer border ${p.dailyForecast ? "bg-brand-green/10 border-brand-green/30" : "bg-card border-border"}`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-green truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.category} · {p.unit}</p>
            </div>
            <input type="checkbox" checked={!!p.dailyForecast}
              onChange={e => updateProduct(p.id, { dailyForecast: e.target.checked })}
              className="w-5 h-5 accent-brand-green" />
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nessun prodotto trovato.</p>
        )}
      </div>
    </Sheet>
  );
}
