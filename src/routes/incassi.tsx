import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import { CASH_CATEGORIES, type CashEntry, type CashType, type PaymentMethod } from "@/lib/data";
import { cashFlowDay, cashFlowMonth } from "@/lib/metrics";

export const Route = createFileRoute("/incassi")({ component: IncassiPage });

const METHODS: PaymentMethod[] = ["contanti", "pos", "bonifico", "carta", "altro"];

function IncassiPage() {
  const { cashEntries, addCashEntry, updateCashEntry, deleteCashEntry } = useStore();
  const [tab, setTab] = useState<"day" | "month" | "all">("day");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const today = new Date();
  const day = cashFlowDay(cashEntries, today);
  const month = cashFlowMonth(cashEntries, today);

  const list = useMemo(() => {
    let base = cashEntries;
    if (tab === "day") {
      const t = today.toDateString();
      base = base.filter(e => new Date(e.date).toDateString() === t);
    } else if (tab === "month") {
      base = base.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      });
    }
    return [...base].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [cashEntries, tab]);

  return (
    <div>
      <TopBar title="Cassa & Incassi" subtitle={`Oggi: ${formatEuro(day.balance)} · Mese: ${formatEuro(month.balance)}`} />

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Entrate oggi" value={formatEuro(day.in)} />
        <Kpi label="Uscite oggi" value={formatEuro(day.out)} danger />
        <Kpi label="Saldo oggi" value={formatEuro(day.balance)} highlight />
        <Kpi label="Saldo mese" value={formatEuro(month.balance)} />
      </div>

      <div className="px-4 md:px-6 flex gap-2 pb-2">
        {(["day", "month", "all"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "day" ? "Oggi" : t === "month" ? "Mese" : "Tutto"}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun movimento.</p>}
        {list.map(e => (
          <button key={e.id} onClick={() => setEditId(e.id)}
            className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <p className={`font-display text-base ${e.type === "entrata" ? "text-success" : "text-danger"}`}>
                {e.type === "entrata" ? "+" : "−"} {formatEuro(e.amount)}
              </p>
              <p className="text-xs text-muted-foreground truncate">{e.category} · {e.method}{e.notes ? ` · ${e.notes}` : ""}</p>
            </div>
            <p className="text-[10px] text-muted-foreground shrink-0">{formatDate(e.date)}</p>
          </button>
        ))}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <CashSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { addCashEntry(d as Omit<CashEntry, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const e = cashEntries.find(x => x.id === editId);
        if (!e) return null;
        return <CashSheet mode="edit" entry={e} onClose={() => setEditId(null)}
          onSave={(p) => { updateCashEntry(e.id, p); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteCashEntry(e.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function Kpi({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function CashSheet({ mode, entry, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; entry?: CashEntry;
  onClose: () => void; onSave: (d: Omit<CashEntry, "id"> | Partial<CashEntry>) => void;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<CashType>(entry?.type ?? "entrata");
  const [amount, setAmount] = useState(entry?.amount ?? 0);
  const [category, setCategory] = useState(entry?.category ?? CASH_CATEGORIES[0]);
  const [method, setMethod] = useState<PaymentMethod>(entry?.method ?? "contanti");
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const save = () => {
    if (!amount) return;
    onSave({
      date: entry?.date ?? new Date().toISOString(),
      type, amount: Number(amount), category, method,
      notes: notes.trim() || undefined,
      refType: entry?.refType ?? "manual", refId: entry?.refId,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo movimento" : "Modifica movimento"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setType("entrata")}
          className={`py-3 rounded-xl font-semibold ${type === "entrata" ? "bg-success text-white" : "bg-card border border-border"}`}>Entrata</button>
        <button onClick={() => setType("uscita")}
          className={`py-3 rounded-xl font-semibold ${type === "uscita" ? "bg-danger text-white" : "bg-card border border-border"}`}>Uscita</button>
      </div>
      <Field label="Importo (€)">
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}
          className="w-full bg-card border border-border rounded-lg p-3 text-lg" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {CASH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Metodo">
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}
