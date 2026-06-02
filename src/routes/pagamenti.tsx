import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import {
  PAYMENT_CATEGORIES, type SupplierPayment, type SupplierPaymentStatus,
  type SupplierPaymentRecurrence, type SupplierPaymentBeneficiaryType,
  type PaymentMethod, type SupplierPaymentDocument,
} from "@/lib/data";
import { supplierPaymentsOverdue, paymentsTotalMonth, recurringMonthlyPayments } from "@/lib/metrics";

export const Route = createFileRoute("/pagamenti")({ component: PagamentiPage });

const STATUS_LABEL: Record<SupplierPaymentStatus, string> = { da_pagare: "Da pagare", pagato: "Pagato", scaduto: "Scaduto" };
const STATUS_STYLE: Record<SupplierPaymentStatus, string> = {
  da_pagare: "bg-warning/15 text-warning",
  pagato: "bg-success/15 text-success",
  scaduto: "bg-danger/15 text-danger",
};

function PagamentiPage() {
  const { supplierPayments, suppliers, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment } = useStore();
  const [tab, setTab] = useState<"all" | SupplierPaymentStatus>("da_pagare");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const overdue = supplierPaymentsOverdue(supplierPayments);
  const monthTotal = paymentsTotalMonth(supplierPayments);
  const recurring = recurringMonthlyPayments(supplierPayments);

  const list = useMemo(() => supplierPayments
    .filter(p => tab === "all" || p.status === tab)
    .sort((a, b) => +new Date(b.dueDate ?? b.date) - +new Date(a.dueDate ?? a.date)),
    [supplierPayments, tab]);

  return (
    <div>
      <TopBar title="Pagamenti" subtitle={`${overdue.length} scaduti · ${recurring.length} ricorrenti`} />

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Da pagare" value={String(supplierPayments.filter(p => p.status === "da_pagare").length)} warn />
        <Kpi label="Scaduti" value={String(overdue.length)} danger={overdue.length > 0} />
        <Kpi label="Pagato mese" value={formatEuro(monthTotal)} />
        <Kpi label="Ricorrenti" value={String(recurring.length)} />
      </div>

      <div className="px-4 md:px-6 flex gap-2 pb-2 overflow-x-auto">
        {(["da_pagare", "scaduto", "pagato", "all"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "all" ? "Tutti" : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun pagamento.</p>}
        {list.map(p => (
          <div key={p.id} className="bg-card rounded-xl p-3">
            <button onClick={() => setEditId(p.id)} className="w-full text-left flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-display text-base text-brand-green truncate">{p.beneficiary}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category} · {p.beneficiaryType}{p.recurrence !== "una_tantum" ? ` · ${p.recurrence}` : ""}
                </p>
                {p.dueDate && <p className="text-[11px] text-muted-foreground mt-0.5">Scadenza: {formatDate(p.dueDate)}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-lg text-brand-green">{formatEuro(p.amount)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
            </button>
            {p.status !== "pagato" && (
              <button onClick={() => updateSupplierPayment(p.id, { status: "pagato" })}
                className="w-full mt-2 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Segna come pagato</button>
            )}
          </div>
        ))}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <PaySheet mode="new" suppliers={suppliers} onClose={() => setOpenNew(false)}
        onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const p = supplierPayments.find(x => x.id === editId);
        if (!p) return null;
        return <PaySheet mode="edit" payment={p} suppliers={suppliers} onClose={() => setEditId(null)}
          onSave={(patch) => { updateSupplierPayment(p.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteSupplierPayment(p.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function Kpi({ label, value, warn, danger }: { label: string; value: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

const METHODS: PaymentMethod[] = ["contanti", "pos", "bonifico", "carta", "altro"];
const RECS: SupplierPaymentRecurrence[] = ["una_tantum", "settimanale", "mensile", "annuale"];
const TYPES: SupplierPaymentBeneficiaryType[] = ["fornitore", "consulente", "servizio", "altro"];
const DOCS: SupplierPaymentDocument[] = ["fattura", "ricevuta", "preventivo", "nessuno"];

function PaySheet({ mode, payment, suppliers, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; payment?: SupplierPayment; suppliers: { id: string; name: string }[];
  onClose: () => void; onSave: (d: Omit<SupplierPayment, "id"> | Partial<SupplierPayment>) => void;
  onDelete?: () => void;
}) {
  const [beneficiary, setBeneficiary] = useState(payment?.beneficiary ?? "");
  const [beneficiaryType, setBeneficiaryType] = useState<SupplierPaymentBeneficiaryType>(payment?.beneficiaryType ?? "fornitore");
  const [supplierId, setSupplierId] = useState(payment?.supplierId ?? "");
  const [category, setCategory] = useState(payment?.category ?? PAYMENT_CATEGORIES[0]);
  const [amount, setAmount] = useState(payment?.amount ?? 0);
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "bonifico");
  const [status, setStatus] = useState<SupplierPaymentStatus>(payment?.status ?? "da_pagare");
  const [dueDate, setDueDate] = useState(payment?.dueDate?.slice(0, 10) ?? "");
  const [recurrence, setRecurrence] = useState<SupplierPaymentRecurrence>(payment?.recurrence ?? "una_tantum");
  const [document, setDoc] = useState<SupplierPaymentDocument>(payment?.document ?? "nessuno");
  const [notes, setNotes] = useState(payment?.notes ?? "");

  const save = () => {
    if (!beneficiary.trim() || !amount) return;
    onSave({
      date: payment?.date ?? new Date().toISOString(),
      beneficiary: beneficiary.trim(), beneficiaryType, supplierId: supplierId || undefined,
      category, amount: Number(amount), method, status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      recurrence, document, notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo pagamento" : "Modifica pagamento"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Beneficiario">
          <input value={beneficiary} onChange={e => setBeneficiary(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Tipo">
          <select value={beneficiaryType} onChange={e => setBeneficiaryType(e.target.value as SupplierPaymentBeneficiaryType)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {beneficiaryType === "fornitore" && (
          <Field label="Fornitore collegato">
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-3">
              <option value="">— Nessuno —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {PAYMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Importo (€)">
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Metodo di pagamento">
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={e => setStatus(e.target.value as SupplierPaymentStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(STATUS_LABEL) as SupplierPaymentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Scadenza">
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Ricorrenza">
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as SupplierPaymentRecurrence)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {RECS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Documento">
          <select value={document} onChange={e => setDoc(e.target.value as SupplierPaymentDocument)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {DOCS.map(d => <option key={d} value={d}>{d}</option>)}
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
