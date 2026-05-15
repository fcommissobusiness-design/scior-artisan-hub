import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field, Fab } from "@/components/AppShell";
import { bundleMargin, SEGMENT_META, type Bundle, type Segment } from "@/lib/data";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

export const Route = createFileRoute("/offerte")({ component: OffertePage });

function OffertePage() {
  const { bundles, updateBundle, addBundle, deleteBundle } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [waId, setWaId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "stagionali">("all");

  const list = bundles.filter(b => {
    if (filter === "active") return b.active;
    if (filter === "stagionali") return !!b.startDate || !!b.endDate || b.availability.toLowerCase().includes("stagion");
    return true;
  });

  // Top profittevoli
  const topProfit = [...bundles].map(b => ({ b, m: bundleMargin(b) }))
    .filter(x => x.m.eur !== null).sort((a, b) => (b.m.eur ?? 0) - (a.m.eur ?? 0)).slice(0, 3);

  return (
    <div>
      <TopBar title="Offerte e Bundle" subtitle={`${bundles.length} bundle · ${bundles.filter(b => b.active).length} attivi`} />

      <div className="px-4 md:px-6 pt-3 flex gap-1.5">
        {[
          { id: "all" as const, label: "Tutti" },
          { id: "active" as const, label: "Attivi" },
          { id: "stagionali" as const, label: "Stagionali" },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {topProfit.length > 0 && (
        <div className="px-4 md:px-6 pt-4">
          <div className="bg-brand-green text-brand-cream rounded-xl p-3">
            <p className="text-[11px] uppercase text-brand-gold font-bold tracking-wide">Top profitto bundle</p>
            <ul className="text-xs mt-1 space-y-0.5">
              {topProfit.map(({ b, m }) => (
                <li key={b.id} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="font-bold text-brand-gold">{formatEuro(m.eur ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((b) => {
          const m = bundleMargin(b);
          return (
            <div key={b.id} className={`bg-card rounded-xl p-4 shadow-sm ${!b.active ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-start gap-3 mb-2">
                <button onClick={() => setEditId(b.id)} className="flex-1 text-left">
                  <h3 className="font-display text-lg text-brand-green leading-tight">{b.name}</h3>
                  <p className="text-[11px] text-brand-gold uppercase tracking-wide mt-0.5 font-semibold">{b.availability}</p>
                  {b.targetSegment && <span className={`text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded ${SEGMENT_META[b.targetSegment].color}`}>{SEGMENT_META[b.targetSegment].label}</span>}
                  {b.channel && <span className="text-[9px] ml-1 inline-block bg-brand-cream border border-border px-1.5 py-0.5 rounded text-foreground/70">{b.channel}</span>}
                </button>
                <button onClick={() => updateBundle(b.id, { active: !b.active })}
                  className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${b.active ? "bg-success" : "bg-muted-foreground/30"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition-transform ${b.active ? "translate-x-5" : ""}`} />
                </button>
              </div>

              <ul className="text-sm text-foreground/80 space-y-0.5 mb-3">
                {b.ingredients.map((i, idx) => <li key={idx}>· {i}</li>)}
              </ul>

              <div className="flex items-end justify-between bg-brand-cream rounded-lg p-3 gap-2">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Pieno</p>
                  <p className="text-sm text-muted-foreground line-through">{formatEuro(b.fullPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-brand-gold tracking-wide">Offerta</p>
                  <p className="font-display text-2xl font-bold text-brand-gold leading-none">
                    {b.offerPrice === null ? "TBD" : formatEuro(b.offerPrice)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Margine</p>
                  <p className={`text-sm font-bold ${m.pct === null ? "text-muted-foreground" : m.pct < 15 ? "text-danger" : m.pct < 25 ? "text-warning" : "text-success"}`}>
                    {m.pct === null ? "—" : m.pct.toFixed(0) + "%"}
                  </p>
                  {m.eur !== null && <p className="text-[10px] text-muted-foreground">{formatEuro(m.eur)}</p>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditId(b.id)} className="flex-1 text-xs bg-brand-green text-brand-cream rounded-lg py-2 font-semibold">Modifica</button>
                <button onClick={() => setWaId(b.id)} className="flex-1 text-xs bg-success text-white rounded-lg py-2 font-semibold">Promo WhatsApp</button>
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <BundleSheet mode="new" onClose={() => setOpenNew(false)} onSave={(b) => { addBundle(b); setOpenNew(false); }} />}

      {editId && (() => {
        const b = bundles.find(x => x.id === editId);
        if (!b) return null;
        return (
          <BundleSheet mode="edit" bundle={b} onClose={() => setEditId(null)}
            onSave={(patch) => { updateBundle(b.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${b.name}?`)) { deleteBundle(b.id); setEditId(null); } }} />
        );
      })()}

      {waId && (() => {
        const b = bundles.find(x => x.id === waId);
        if (!b) return null;
        return (
          <WhatsAppDialog open={true} onClose={() => setWaId(null)}
            phone="" context={{ bundle: b }}
            defaultTemplate="promo_bundle" templates={["promo_bundle", "libero"]}
            title={`Promo · ${b.name}`}
          />
        );
      })()}
    </div>
  );
}

function BundleSheet({ mode, bundle, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; bundle?: Bundle;
  onClose: () => void; onSave: (b: any) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(bundle?.name ?? "");
  const [availability, setAvailability] = useState(bundle?.availability ?? "Sempre attivo");
  const [ingredients, setIngredients] = useState<string[]>(bundle?.ingredients ?? [""]);
  const [fullPrice, setFullPrice] = useState<string>(bundle?.fullPrice?.toString() ?? "");
  const [offerPrice, setOfferPrice] = useState<string>(bundle?.offerPrice?.toString() ?? "");
  const [estimatedCost, setEstimatedCost] = useState<string>(bundle?.estimatedCost?.toString() ?? "");
  const [active, setActive] = useState(bundle?.active ?? true);
  const [startDate, setStartDate] = useState(bundle?.startDate ?? "");
  const [endDate, setEndDate] = useState(bundle?.endDate ?? "");
  const [channel, setChannel] = useState(bundle?.channel ?? "");
  const [targetSegment, setTargetSegment] = useState<Segment | "">((bundle?.targetSegment as any) ?? "");
  const [goal, setGoal] = useState(bundle?.goal ?? "");

  const fp = parseFloat(fullPrice) || 0;
  const op = offerPrice === "" ? null : parseFloat(offerPrice);
  const ec = estimatedCost === "" ? null : parseFloat(estimatedCost);
  const price = op ?? fp;
  const margin = ec !== null && price > 0 ? ((price - ec) / price) * 100 : null;
  const marginEur = ec !== null && price > 0 ? price - ec : null;

  const save = () => {
    const cleanIngs = ingredients.map(i => i.trim()).filter(Boolean);
    if (!name.trim() || fp <= 0 || cleanIngs.length === 0) return;
    onSave({
      name: name.trim(), availability, ingredients: cleanIngs,
      fullPrice: fp, offerPrice: op, estimatedCost: ec ?? undefined,
      active, startDate: startDate || undefined, endDate: endDate || undefined,
      channel: channel.trim() || undefined,
      targetSegment: targetSegment || undefined,
      goal: goal.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={mode === "new" ? "Nuova Offerta" : "Modifica Offerta"}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Margine: </span>
            <span className={`font-bold ${margin === null ? "text-muted-foreground" : margin < 15 ? "text-danger" : margin < 25 ? "text-warning" : "text-success"}`}>
              {margin === null ? "n/d" : `${margin.toFixed(1)}%`}
            </span>
            {marginEur !== null && <span className="text-muted-foreground"> · {formatEuro(marginEur)}</span>}
          </div>
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!name.trim() || fp <= 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome offerta">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Disponibilità">
          <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="es. Venerdì e Sabato"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo pieno (€)">
          <input type="number" step="0.01" value={fullPrice} onChange={(e) => setFullPrice(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo offerta (€)">
          <input type="number" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Costo stimato bundle (€)">
          <input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="per calcolare margine" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Canale consigliato">
          <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="es. WhatsApp broadcast"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Segmento target">
          <select value={targetSegment} onChange={(e) => setTargetSegment(e.target.value as Segment | "")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuno —</option>
            {(Object.keys(SEGMENT_META) as Segment[]).map(s => <option key={s} value={s}>{SEGMENT_META[s].label}</option>)}
          </select>
        </Field>
        <Field label="Obiettivo">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="es. Riattivare inattivi"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Inizio">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fine">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>

      <Field label="Ingredienti">
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex gap-2">
              <input value={ing} onChange={(e) => setIngredients(ingredients.map((x, i) => i === idx ? e.target.value : x))}
                placeholder="es. Mozzarella bufala 500g"
                className="flex-1 bg-card border border-border rounded-lg p-2.5 text-sm" />
              <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                className="text-danger border border-danger/40 rounded-lg px-3 text-sm">×</button>
            </div>
          ))}
          <button onClick={() => setIngredients([...ingredients, ""])}
            className="text-xs text-brand-green border border-brand-green/40 rounded-lg px-3 py-2 font-semibold">+ Aggiungi ingrediente</button>
        </div>
      </Field>

      <Field label="Attivo">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Visibile sul banco e proponibile
        </label>
      </Field>
    </Sheet>
  );
}
