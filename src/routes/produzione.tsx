import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatDate } from "@/components/AppShell";
import type { Production, ProductionStatus } from "@/lib/data";
import { mozzarellaKgForDate, productionsForDate } from "@/lib/metrics";

export const Route = createFileRoute("/produzione")({ component: ProduzionePage });

const STATUS_LABEL: Record<ProductionStatus, string> = {
  da_preparare: "Da preparare", preparato: "Preparato", completato: "Completato",
};
const STATUS_STYLE: Record<ProductionStatus, string> = {
  da_preparare: "bg-warning/15 text-warning",
  preparato: "bg-blue-600/15 text-blue-700",
  completato: "bg-success/15 text-success",
};

const toDay = (iso: string) => iso.slice(0, 10);

function ProduzionePage() {
  const { productions, products, orders, addProduction, updateProduction, deleteProduction } = useStore();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const todays = useMemo(() => productions.filter(p => toDay(p.date) === day)
    .sort((a, b) => a.productId.localeCompare(b.productId)), [productions, day]);

  const mozzaKg = mozzarellaKgForDate(productions, products, day + "T00:00");
  const totItems = todays.reduce((s, p) => s + p.qtyPlanned, 0);
  const fatti = todays.filter(p => p.status === "completato").length;

  // Suggerimento da ordini in attesa per il giorno
  const dayOrders = orders.filter(o => o.status !== "annullato" && toDay(o.pickupDate) === day);
  const sugg = new Map<string, number>();
  dayOrders.forEach(o => o.items.forEach(i => sugg.set(i.productId, (sugg.get(i.productId) ?? 0) + i.qty)));

  return (
    <div>
      <TopBar title="Produzione" subtitle={`${day} · ${todays.length} righe`} />

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Mozzarella oggi" value={`${mozzaKg.toFixed(1)} kg`} highlight />
        <Kpi label="Righe totali" value={String(todays.length)} />
        <Kpi label="Pezzi/Kg pianificati" value={totItems.toFixed(1)} />
        <Kpi label="Completati" value={`${fatti}/${todays.length}`} />
      </div>

      <div className="px-4 md:px-6 flex items-center gap-3 pb-2">
        <input type="date" value={day} onChange={e => setDay(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        {sugg.size > 0 && (
          <p className="text-xs text-muted-foreground">{sugg.size} prodotti richiesti dagli ordini di oggi</p>
        )}
      </div>

      {sugg.size > 0 && (
        <div className="mx-4 md:mx-6 mb-3 bg-brand-cream-dark/40 rounded-xl p-3">
          <p className="text-xs uppercase font-bold text-brand-green mb-2">Suggerimento da ordini</p>
          <div className="flex flex-wrap gap-2">
            {[...sugg.entries()].map(([pid, qty]) => {
              const prod = products.find(p => p.id === pid);
              if (!prod) return null;
              const already = todays.filter(t => t.productId === pid).reduce((s, t) => s + t.qtyPlanned, 0);
              const missing = qty - already;
              if (missing <= 0) return null;
              return (
                <button key={pid} onClick={() => addProduction({
                  date: new Date(day + "T07:00").toISOString(),
                  productId: pid, qtyPlanned: missing, status: "da_preparare",
                  orderIds: dayOrders.filter(o => o.items.some(i => i.productId === pid)).map(o => o.id),
                })}
                  className="text-xs bg-card border border-border rounded-full px-3 py-1.5">
                  + {prod.name} · {missing.toFixed(1)} {prod.unit}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {todays.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessuna produzione pianificata.</p>}
        {todays.map(p => {
          const prod = products.find(x => x.id === p.productId);
          return (
            <div key={p.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(p.id)} className="w-full text-left">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green leading-tight">{prod?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Pianificato: {p.qtyPlanned} {prod?.unit ?? ""}
                      {p.qtyActual !== undefined && ` · Effettivo: ${p.qtyActual}`}
                    </p>
                    {p.orderIds && p.orderIds.length > 0 && (
                      <p className="text-xs text-brand-green mt-1">Per {p.orderIds.length} ordin{p.orderIds.length === 1 ? "e" : "i"}</p>
                    )}
                    {p.notes && <p className="text-xs italic text-muted-foreground mt-1">{p.notes}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
              </button>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {p.status === "da_preparare" && (
                  <button onClick={() => updateProduction(p.id, { status: "preparato" })}
                    className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 font-semibold">Preparato</button>
                )}
                {p.status !== "completato" && (
                  <button onClick={() => updateProduction(p.id, { status: "completato", qtyActual: p.qtyActual ?? p.qtyPlanned })}
                    className="flex-1 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Completato</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <ProdSheet day={day} mode="new"
        onClose={() => setOpenNew(false)}
        onSave={(d) => { addProduction(d as Omit<Production, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const p = productions.find(x => x.id === editId);
        if (!p) return null;
        return (
          <ProdSheet day={day} mode="edit" production={p}
            onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduction(p.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm("Eliminare?")) { deleteProduction(p.id); setEditId(null); } }} />
        );
      })()}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function ProdSheet({ day, mode, production, onClose, onSave, onDelete }: {
  day: string; mode: "new" | "edit"; production?: Production;
  onClose: () => void; onSave: (d: Omit<Production, "id"> | Partial<Production>) => void;
  onDelete?: () => void;
}) {
  const { products } = useStore();
  const [productId, setProductId] = useState(production?.productId ?? products[0]?.id ?? "");
  const [qtyPlanned, setQtyPlanned] = useState(production?.qtyPlanned ?? 1);
  const [qtyActual, setQtyActual] = useState(production?.qtyActual ?? 0);
  const [status, setStatus] = useState<ProductionStatus>(production?.status ?? "da_preparare");
  const [notes, setNotes] = useState(production?.notes ?? "");

  const save = () => {
    onSave({
      date: production?.date ?? new Date(day + "T07:00").toISOString(),
      productId, qtyPlanned: Number(qtyPlanned),
      qtyActual: qtyActual ? Number(qtyActual) : undefined,
      status, notes: notes.trim() || undefined,
      orderIds: production?.orderIds,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova produzione" : "Modifica produzione"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma</button>
        </div>
      }>
      <Field label="Prodotto">
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pianificato">
          <input type="number" step="0.1" value={qtyPlanned} onChange={e => setQtyPlanned(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Effettivo">
          <input type="number" step="0.1" value={qtyActual} onChange={e => setQtyActual(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Status">
        <select value={status} onChange={e => setStatus(e.target.value as ProductionStatus)}
          className="w-full bg-card border border-border rounded-lg p-3">
          {(Object.keys(STATUS_LABEL) as ProductionStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
      {production?.date && (
        <p className="text-xs text-muted-foreground">Data: {formatDate(production.date)}</p>
      )}
    </Sheet>
  );
}
