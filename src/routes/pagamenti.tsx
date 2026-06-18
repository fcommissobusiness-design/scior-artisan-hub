import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, Fab, formatEuro, formatDate } from "@/components/AppShell";
import {
  PAYMENT_CATEGORIES, FISCAL_CATEGORIES, FIXED_COST_CATEGORIES,
  type SupplierPayment, type SupplierPaymentStatus,
  type SupplierPaymentRecurrence, type SupplierPaymentBeneficiaryType,
  type PaymentMethod, type SupplierPaymentDocument, type PaymentAttachment,
  type FiscalCategory, type FixedCost, type FixedCostCategory, type FixedCostFrequency, type FixedCostStatus,
} from "@/lib/data";
import { TIME_FRAME_OPTIONS, makeTimeFrame, inFrame, type TimeFrameId } from "@/lib/timeframe";
import { putAttachment, getAttachmentUrl, deleteAttachment, downloadAttachment } from "@/lib/attachments";
import { monthlyFixedCostsTotal } from "@/lib/metrics";

export const Route = createFileRoute("/pagamenti")({ component: UscitePage });

const STATUS_LABEL: Record<SupplierPaymentStatus, string> = { da_pagare: "Da pagare", pagato: "Pagato", scaduto: "Scaduto" };
const STATUS_STYLE: Record<SupplierPaymentStatus, string> = {
  da_pagare: "bg-warning/15 text-warning",
  pagato: "bg-success/15 text-success",
  scaduto: "bg-danger/15 text-danger",
};

function UscitePage() {
  const {
    supplierPayments, suppliers, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
    fixedCosts, addFixedCost, updateFixedCost, deleteFixedCost,
  } = useStore();
  const [tab, setTab] = useState<"variabili" | "fissi">("variabili");
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);
  const [openNew, setOpenNew] = useState(false);
  const [openFcConfig, setOpenFcConfig] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const fissiMese = useMemo(() => monthlyFixedCostsTotal(fixedCosts), [fixedCosts]);

  // riferimento data: dueDate se presente, altrimenti date
  const refIso = (p: SupplierPayment) => p.dueDate ?? p.date;

  const inPeriod = useMemo(() => supplierPayments.filter(p => inFrame(refIso(p), tf)), [supplierPayments, tf]);

  const nowTs = Date.now();
  const isOverdue = (p: SupplierPayment) =>
    p.status === "scaduto" || (p.status === "da_pagare" && p.dueDate && +new Date(p.dueDate) < nowTs);

  const kpi = useMemo(() => {
    let daPagare = 0, scaduti = 0, saldato = 0;
    for (const p of inPeriod) {
      if (p.status === "pagato") saldato += p.amount;
      else if (isOverdue(p)) scaduti += p.amount;
      else if (p.status === "da_pagare") daPagare += p.amount;
    }
    return { daPagare, scaduti, saldato };
  }, [inPeriod]);

  const list = useMemo(
    () => [...inPeriod].sort((a, b) => +new Date(refIso(b)) - +new Date(refIso(a))),
    [inPeriod],
  );

  return (
    <div>
      <TopBar title="Uscite" right={
        <button onClick={() => setOpenFcConfig(true)}
          className="bg-brand-gold text-brand-green text-xs font-semibold rounded-lg px-3 py-2">
          ⚙ Configura Costi Fissi
        </button>
      } />

      <div className="px-4 md:px-6 pt-3 flex gap-2 items-center">
        <button onClick={() => setTab("variabili")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "variabili" ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
          Uscite variabili
        </button>
        <button onClick={() => setTab("fissi")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "fissi" ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
          Costi fissi · {formatEuro(fissiMese)}/mese
        </button>
        <div className="ml-auto">
          {tab === "variabili" && (
            <select value={tfId} onChange={e => setTfId(e.target.value as TimeFrameId)}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs">
              {TIME_FRAME_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {tab === "variabili" ? (
        <>
          <div className="p-4 md:p-6 grid grid-cols-3 gap-3">
            <Kpi label="Da Pagare" value={formatEuro(kpi.daPagare)} warn />
            <Kpi label="Scaduti" value={formatEuro(kpi.scaduti)} danger />
            <Kpi label="Saldato" value={formatEuro(kpi.saldato)} ok />
          </div>

          <div className="p-4 md:p-6 space-y-2">
            {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna uscita nel periodo.</p>}
            {list.map(p => (
              <div key={p.id} className="bg-card rounded-xl p-3">
                <button onClick={() => setEditId(p.id)} className="w-full text-left flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base text-brand-green truncate">{p.beneficiary}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.category} · {p.beneficiaryType}{p.recurrence !== "una_tantum" ? ` · ${p.recurrence}` : ""}
                      {p.attachments && p.attachments.length > 0 && ` · 📎 ${p.attachments.length}`}
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
        </>
      ) : (
        <FixedCostsList costs={fixedCosts} onAdd={d => addFixedCost(d)} onUpdate={updateFixedCost} onDelete={deleteFixedCost} onOpenConfig={() => setOpenFcConfig(true)} />
      )}

      {openNew && <PaySheet mode="new" suppliers={suppliers} onClose={() => setOpenNew(false)}
        onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const p = supplierPayments.find(x => x.id === editId);
        if (!p) return null;
        return <PaySheet mode="edit" payment={p} suppliers={suppliers} onClose={() => setEditId(null)}
          onSave={(patch) => { updateSupplierPayment(p.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteSupplierPayment(p.id); setEditId(null); } }} />;
      })()}
      {openFcConfig && (
        <FixedCostsConfigSheet
          costs={fixedCosts}
          onAdd={addFixedCost}
          onUpdate={updateFixedCost}
          onDelete={deleteFixedCost}
          onClose={() => setOpenFcConfig(false)}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, warn, danger, ok }: { label: string; value: string; warn?: boolean; danger?: boolean; ok?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : ok ? "text-success" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

const METHODS: PaymentMethod[] = ["contanti", "bonifico", "carta", "altro"];
const RECS: SupplierPaymentRecurrence[] = ["una_tantum", "settimanale", "mensile", "annuale"];
const TYPES: SupplierPaymentBeneficiaryType[] = ["fornitore", "consulente", "servizio", "altro"];
const DOC_OPTIONS: { value: SupplierPaymentDocument; label: string }[] = [
  { value: "fattura", label: "Fattura" },
  { value: "preventivo", label: "Preventivo" },
  { value: "contratto", label: "Contratto" },
  { value: "nessuno", label: "Nessuno" },
];

export function PaySheet({ mode, payment, suppliers, onClose, onSave, onDelete }: {
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
  const initialDoc: SupplierPaymentDocument = (() => {
    const d = payment?.document ?? "nessuno";
    return d === "ricevuta" ? "nessuno" : d;
  })();
  const [document, setDoc] = useState<SupplierPaymentDocument>(initialDoc);
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [deductible, setDeductible] = useState<boolean>(payment?.deductible ?? true);
  const [fiscalCategory, setFiscalCategory] = useState<FiscalCategory>(payment?.fiscalCategory ?? "Altro");
  const [attachments, setAttachments] = useState<PaymentAttachment[]>(payment?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const added: PaymentAttachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { setUploadErr(`${f.name}: file > 10MB ignorato.`); continue; }
        const meta = await putAttachment(f);
        added.push(meta);
      }
      setAttachments(prev => [...prev, ...added]);
    } catch (e) { setUploadErr((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removeAttachment = async (id: string) => {
    try { await deleteAttachment(id); } catch { /* ignore */ }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const save = () => {
    if (!beneficiary.trim() || !amount) return;
    onSave({
      date: payment?.date ?? new Date().toISOString(),
      beneficiary: beneficiary.trim(), beneficiaryType, supplierId: supplierId || undefined,
      category, amount: Number(amount), method, status,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      recurrence, document, notes: notes.trim() || undefined,
      deductible, fiscalCategory,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova uscita" : "Modifica uscita"}
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
        <Field label="Tipo documento">
          <select value={document} onChange={e => setDoc(e.target.value as SupplierPaymentDocument)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {DOC_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Deducibile fiscalmente">
          <select value={deductible ? "si" : "no"} onChange={e => setDeductible(e.target.value === "si")}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="si">Sì</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Categoria fiscale">
          <select value={fiscalCategory} onChange={e => setFiscalCategory(e.target.value as FiscalCategory)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {FISCAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Carica allegato (${attachments.length}) — PDF, JPG, PNG`}>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/jpg" multiple
            onChange={e => onPickFiles(e.target.files)} className="text-xs" />
          {uploading && <p className="text-xs text-muted-foreground">Caricamento in corso...</p>}
          {uploadErr && <p className="text-xs text-danger">{uploadErr}</p>}
          <div className="space-y-1.5">
            {attachments.map(a => (
              <AttachmentRow key={a.id} att={a} onDelete={() => removeAttachment(a.id)} />
            ))}
            {attachments.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nessun allegato. Max 10MB per file.</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}

function AttachmentRow({ att, onDelete }: { att: PaymentAttachment; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImg = att.type.startsWith("image/");
  useEffect(() => {
    let alive = true; let url: string | null = null;
    if (isImg) getAttachmentUrl(att.id).then(u => { if (alive) { url = u; setPreviewUrl(u); } });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [att.id, isImg]);
  const open = async () => { const u = await getAttachmentUrl(att.id); if (u) window.open(u, "_blank"); };
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
      {isImg && previewUrl ? (
        <img src={previewUrl} alt="" className="w-10 h-10 object-cover rounded" />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground/60">
          {att.type.includes("pdf") ? "PDF" : "FILE"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{att.name}</p>
        <p className="text-[10px] text-muted-foreground">{(att.size / 1024).toFixed(0)} KB</p>
      </div>
      <button onClick={open} className="text-xs text-brand-green font-semibold px-2">Apri</button>
      <button onClick={() => downloadAttachment(att)} className="text-xs text-brand-green font-semibold px-2">Scarica</button>
      <button onClick={onDelete} className="text-xs text-danger font-semibold px-2">×</button>
    </div>
  );
}

// ============= COSTI FISSI =============

const FC_FREQS: FixedCostFrequency[] = ["mensile", "annuale", "una_tantum"];

function FixedCostsList({ costs, onAdd, onUpdate, onDelete, onOpenConfig }: {
  costs: FixedCost[];
  onAdd: (d: Omit<FixedCost, "id">) => void;
  onUpdate: (id: string, patch: Partial<FixedCost>) => void;
  onDelete: (id: string) => void;
  onOpenConfig: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...costs].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [costs],
  );
  return (
    <div className="p-4 md:p-6 space-y-2">
      {sorted.length === 0 && (
        <div className="bg-card rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Nessun costo fisso configurato.</p>
          <button onClick={onOpenConfig}
            className="bg-brand-green text-brand-cream rounded-lg px-4 py-2 text-sm font-semibold">
            Configura Costi Fissi
          </button>
        </div>
      )}
      {sorted.map(c => {
        const monthly = c.frequency === "annuale" ? c.amount / 12 : c.frequency === "mensile" ? c.amount : 0;
        return (
          <button key={c.id} onClick={() => setEditId(c.id)}
            className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-center gap-3 hover:bg-brand-cream/40 transition-colors">
            <div className="min-w-0">
              <p className="font-display text-base text-brand-green truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{c.category} · {c.frequency} · {c.status}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-lg text-brand-green">{formatEuro(c.amount)}</p>
              {c.frequency !== "mensile" && <p className="text-[10px] text-muted-foreground">{formatEuro(monthly)}/mese</p>}
            </div>
          </button>
        );
      })}
      {editId && (() => {
        const c = costs.find(x => x.id === editId);
        if (!c) return null;
        return <FixedCostSheet mode="edit" cost={c} onClose={() => setEditId(null)}
          onSave={(patch) => { onUpdate(c.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare questo costo fisso?")) { onDelete(c.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

function FixedCostsConfigSheet({ costs, onAdd, onUpdate, onDelete, onClose }: {
  costs: FixedCost[];
  onAdd: (d: Omit<FixedCost, "id">) => void;
  onUpdate: (id: string, patch: Partial<FixedCost>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const fissiMese = useMemo(() => monthlyFixedCostsTotal(costs), [costs]);
  const sorted = useMemo(
    () => [...costs].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [costs],
  );
  return (
    <Sheet open={true} onClose={onClose} title="Configura Costi Fissi"
      footer={
        <button onClick={() => setOpenNew(true)}
          className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">+ Nuovo costo fisso</button>
      }>
      <p className="text-xs text-muted-foreground">
        Totale mensile: <span className="font-semibold text-brand-green">{formatEuro(fissiMese)}</span> · usato anche da Finanziario e Fiscalità.
      </p>
      {sorted.length === 0 && <p className="text-sm text-muted-foreground italic">Nessun costo fisso. Esempi: Affitto, Luce, Internet, Commercialista.</p>}
      <div className="space-y-1.5">
        {sorted.map(c => {
          const monthly = c.frequency === "annuale" ? c.amount / 12 : c.frequency === "mensile" ? c.amount : 0;
          return (
            <button key={c.id} onClick={() => setEditId(c.id)}
              className="w-full text-left bg-card border border-border rounded-lg p-2.5 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-green truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{c.category} · {c.frequency} · {c.status}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-brand-green">{formatEuro(c.amount)}</p>
                {c.frequency !== "mensile" && <p className="text-[10px] text-muted-foreground">{formatEuro(monthly)}/mese</p>}
              </div>
            </button>
          );
        })}
      </div>

      {openNew && <FixedCostSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { onAdd(d as Omit<FixedCost, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const c = costs.find(x => x.id === editId);
        if (!c) return null;
        return <FixedCostSheet mode="edit" cost={c} onClose={() => setEditId(null)}
          onSave={(patch) => { onUpdate(c.id, patch); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare questo costo fisso?")) { onDelete(c.id); setEditId(null); } }} />;
      })()}
    </Sheet>
  );
}

function nextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function FixedCostSheet({ mode, cost, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; cost?: FixedCost;
  onClose: () => void; onSave: (d: Omit<FixedCost, "id"> | Partial<FixedCost>) => void;
  onDelete?: () => void;
}) {
  const todayDate = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(cost?.name ?? "");
  const [description, setDescription] = useState(cost?.description ?? "");
  const [category, setCategory] = useState<FixedCostCategory>(cost?.category ?? "altro");
  // amount come stringa libera (fix bug "0 non cancellabile")
  const [amountStr, setAmountStr] = useState<string>(cost?.amount != null ? String(cost.amount).replace(".", ",") : "");
  const [frequency, setFrequency] = useState<FixedCostFrequency>(cost?.frequency ?? "mensile");
  const [status, setStatus] = useState<FixedCostStatus>(cost?.status ?? "attivo");
  const [dayOfMonth, setDayOfMonth] = useState<string>(cost?.dayOfMonth != null ? String(cost.dayOfMonth) : "");
  const [specificDate, setSpecificDate] = useState<string>(cost?.specificDate?.slice(0, 10) ?? "");
  const [hasInvoice, setHasInvoice] = useState<boolean>(cost?.hasInvoice ?? false);
  const [attachments, setAttachments] = useState<PaymentAttachment[]>(cost?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState(cost?.notes ?? "");
  const [confirmEdit, setConfirmEdit] = useState<null | { payload: Partial<FixedCost> }>(null);

  const parsedAmount = (() => {
    const s = amountStr.trim().replace(",", ".");
    if (s === "") return NaN;
    const n = Number(s);
    return isNaN(n) ? NaN : n;
  })();

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadErr(null); setUploading(true);
    try {
      const added: PaymentAttachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { setUploadErr(`${f.name}: file > 10MB ignorato.`); continue; }
        added.push(await putAttachment(f));
      }
      setAttachments(prev => [...prev, ...added]);
    } catch (e) { setUploadErr((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const removeAttachment = async (id: string) => {
    try { await deleteAttachment(id); } catch { /* ignore */ }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const baseline = cost ? {
    name: cost.name, description: cost.description ?? "", category, amount: cost.amount,
    frequency: cost.frequency, status: cost.status,
    dayOfMonth: cost.dayOfMonth ?? null, specificDate: cost.specificDate ?? "",
    hasInvoice: cost.hasInvoice ?? false,
  } : null;
  const isChanged = baseline ? (
    baseline.name !== name.trim() ||
    baseline.description !== description.trim() ||
    baseline.category !== category ||
    Number(baseline.amount) !== parsedAmount ||
    baseline.frequency !== frequency ||
    baseline.status !== status ||
    baseline.dayOfMonth !== (dayOfMonth === "" ? null : Number(dayOfMonth)) ||
    baseline.specificDate !== specificDate ||
    baseline.hasInvoice !== hasInvoice
  ) : false;

  const save = () => {
    if (!name.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;
    // Validazione date in base alla frequenza
    let dom: number | undefined;
    let sd: string | undefined;
    if (frequency === "mensile") {
      if (dayOfMonth !== "") {
        const n = Number(dayOfMonth);
        if (!isNaN(n) && n >= 1 && n <= 31) dom = n;
      }
    } else {
      if (specificDate) sd = new Date(specificDate).toISOString();
    }
    const payload: Partial<FixedCost> = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      amount: parsedAmount,
      frequency, status,
      dayOfMonth: dom,
      specificDate: sd,
      hasInvoice,
      attachments: attachments.length > 0 ? attachments : undefined,
      notes: notes.trim() || undefined,
    };
    if (mode === "edit" && isChanged) {
      setConfirmEdit({ payload });
      return;
    }
    onSave(mode === "new" ? (payload as Omit<FixedCost, "id">) : payload);
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo costo fisso" : "Modifica costo fisso"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} className="flex-1 bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
        </div>
      }>
      <Field label="Nome">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="es. Affitto locale" className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <Field label="Descrizione">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="Dettagli aggiuntivi (facoltativo)"
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value as FixedCostCategory)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {FIXED_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Importo (€)">
          <input
            type="text" inputMode="decimal"
            value={amountStr}
            onChange={e => {
              // accetta solo cifre, , e .
              const v = e.target.value.replace(/[^0-9.,]/g, "");
              setAmountStr(v);
            }}
            placeholder="0,00"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Decorrenza (frequenza)">
          <select value={frequency} onChange={e => setFrequency(e.target.value as FixedCostFrequency)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {FC_FREQS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Stato">
          <select value={status} onChange={e => setStatus(e.target.value as FixedCostStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="attivo">attivo</option>
            <option value="inattivo">inattivo</option>
          </select>
        </Field>
      </div>

      {frequency === "mensile" ? (
        <Field label="Giorno del mese (1-31)">
          <input type="number" min="1" max="31" inputMode="numeric"
            value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)}
            placeholder="es. 15"
            className="w-full bg-card border border-border rounded-lg p-3" />
          <p className="text-[11px] text-muted-foreground mt-1">
            Ogni mese il costo verrà registrato in questa giornata.
          </p>
        </Field>
      ) : (
        <Field label={frequency === "annuale" ? "Data annuale (gg/mm/aaaa)" : "Data (gg/mm/aaaa)"}>
          <input type="date" value={specificDate} onChange={e => setSpecificDate(e.target.value)}
            min={frequency === "annuale" ? undefined : todayDate.slice(0, 4) + "-01-01"}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      )}

      <Field label="Fattura collegata">
        <label className="flex items-center gap-2 bg-card border border-border rounded-lg p-3 cursor-pointer">
          <input type="checkbox" checked={hasInvoice} onChange={e => setHasInvoice(e.target.checked)}
            className="w-4 h-4 accent-brand-green" />
          <span className="text-sm">Questo costo ha una fattura · comparirà anche in <strong>Fatture</strong></span>
        </label>
      </Field>

      <Field label={`Allegati (${attachments.length}) — ricevute, scontrini, fatture (PDF, JPG, PNG)`}>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/jpg" multiple
            onChange={e => onPickFiles(e.target.files)} className="text-xs" />
          {uploading && <p className="text-xs text-muted-foreground">Caricamento in corso...</p>}
          {uploadErr && <p className="text-xs text-danger">{uploadErr}</p>}
          <div className="space-y-1.5">
            {attachments.map(a => (
              <AttachmentRow key={a.id} att={a} onDelete={() => removeAttachment(a.id)} />
            ))}
            {attachments.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nessun allegato. Max 10MB per file.</p>
            )}
          </div>
        </div>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {confirmEdit && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={() => setConfirmEdit(null)}>
          <div className="bg-brand-cream rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-xl text-brand-green mb-2">Applica modifica</h3>
            <p className="text-sm text-foreground/80 mb-4">
              Vuoi applicare questa modifica alla <strong>decorrenza corrente</strong> oppure dalla <strong>prossima</strong>?
            </p>
            <div className="flex gap-2 flex-col">
              <button
                onClick={() => { onSave(confirmEdit.payload); setConfirmEdit(null); }}
                className="px-4 py-2.5 rounded-lg bg-brand-green text-brand-cream text-sm font-semibold">
                Applica alla decorrenza corrente
              </button>
              <button
                onClick={() => {
                  const nm = nextMonthIso();
                  const noteAdd = `Modifica effettiva dalla decorrenza del ${new Date(nm).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`;
                  onSave({
                    ...confirmEdit.payload,
                    startDate: nm,
                    notes: (confirmEdit.payload.notes ? confirmEdit.payload.notes + " · " : "") + noteAdd,
                  });
                  setConfirmEdit(null);
                }}
                className="px-4 py-2.5 rounded-lg bg-brand-gold text-white text-sm font-semibold">
                Applica dalla prossima decorrenza
              </button>
              <button onClick={() => setConfirmEdit(null)} className="px-4 py-2 rounded-lg bg-card border border-border text-sm">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
