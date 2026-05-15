import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, formatTime, Sheet, Field, Fab } from "@/components/AppShell";
import type { Delivery, DeliveryStatus, DeliveryPayment } from "@/lib/data";
import { openDeliveries } from "@/lib/metrics";
import { telUrl } from "@/lib/whatsapp";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

export const Route = createFileRoute("/consegne")({ component: ConsegnePage });

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  da_preparare: "Da preparare", in_consegna: "In consegna",
  consegnata: "Consegnata", annullata: "Annullata",
};
const STATUS_STYLE: Record<DeliveryStatus, string> = {
  da_preparare: "bg-warning/15 text-warning",
  in_consegna: "bg-blue-600/15 text-blue-700",
  consegnata: "bg-success/15 text-success",
  annullata: "bg-danger/15 text-danger",
};
const PAY_LABEL: Record<DeliveryPayment, string> = {
  da_pagare: "Da pagare", pagato_anticipo: "Pagato (anticipo)", pagato_consegna: "Pagato alla consegna",
};

function ConsegnePage() {
  const { deliveries, clients, orders, addDelivery, updateDelivery, deleteDelivery } = useStore();
  const [tab, setTab] = useState<DeliveryStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [waId, setWaId] = useState<string | null>(null);

  const list = useMemo(() => deliveries
    .filter(d => tab === "all" || d.status === tab)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [deliveries, tab]);

  const aperte = openDeliveries(deliveries);
  const completate = deliveries.filter(d => d.status === "consegnata");
  const ritardo = deliveries.filter(d => (d.status === "da_preparare" || d.status === "in_consegna") && +new Date(d.date) < Date.now() - 86400000);
  const valore = completate.reduce((s, d) => {
    const o = d.orderId ? orders.find(o => o.id === d.orderId) : null;
    return s + (o?.total ?? 0);
  }, 0);

  const clientById = (id: string) => clients.find(c => c.id === id);

  return (
    <div>
      <TopBar title="Consegne" subtitle={`${deliveries.length} totali · ${aperte.length} aperte`} />

      <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Aperte" value={aperte.length.toString()} />
        <Kpi label="Completate" value={completate.length.toString()} />
        <Kpi label="Valore totale" value={formatEuro(valore)} highlight />
        <Kpi label="In ritardo" value={ritardo.length.toString()} danger={ritardo.length > 0} />
      </div>

      <div className="px-4 md:px-6 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "da_preparare", "in_consegna", "consegnata", "annullata"] as const).map(t => (
          <button key={t} onClick={() => setTab(t as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "all" ? "Tutte" : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.length === 0 && <p className="md:col-span-2 text-center text-sm text-muted-foreground py-8">Nessuna consegna.</p>}
        {list.map(d => {
          const c = clientById(d.clientId);
          const o = d.orderId ? orders.find(o => o.id === d.orderId) : null;
          return (
            <div key={d.id} className="bg-card rounded-xl p-4 shadow-sm">
              <button onClick={() => setEditId(d.id)} className="w-full text-left">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green leading-tight">{c?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{c?.phone ?? "—"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                </div>
                <p className="text-sm text-foreground/85 mt-1">{d.address}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(d.date)} · {d.timeSlot} · {PAY_LABEL[d.payment]}
                </p>
                {o && <p className="text-xs mt-1 text-brand-green">Ordine collegato: {formatEuro(o.total)}</p>}
                {d.notes && <p className="text-xs italic text-muted-foreground mt-1">{d.notes}</p>}
              </button>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {d.status === "da_preparare" && (
                  <button onClick={() => updateDelivery(d.id, { status: "in_consegna" })}
                    className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 font-semibold">Parti</button>
                )}
                {d.status !== "consegnata" && d.status !== "annullata" && (
                  <button onClick={() => updateDelivery(d.id, { status: "consegnata" })}
                    className="flex-1 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Consegnata</button>
                )}
                {c?.phone && (
                  <>
                    <a href={telUrl(c.phone)} className="text-xs bg-brand-green text-brand-cream rounded-lg px-2 py-1.5 font-semibold">Chiama</a>
                    <button onClick={() => setWaId(d.id)} className="text-xs bg-brand-gold text-white rounded-lg px-2 py-1.5 font-semibold">WA</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && <DeliverySheet mode="new" onClose={() => setOpenNew(false)} onSave={(d) => { addDelivery(d as Omit<Delivery,"id"|"createdAt">); setOpenNew(false); }} />}
      {editId && (() => {
        const d = deliveries.find(x => x.id === editId);
        if (!d) return null;
        return (
          <DeliverySheet mode="edit" delivery={d} onClose={() => setEditId(null)}
            onSave={(patch) => { updateDelivery(d.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm("Eliminare consegna?")) { deleteDelivery(d.id); setEditId(null); } }} />
        );
      })()}
      {waId && (() => {
        const d = deliveries.find(x => x.id === waId);
        if (!d) return null;
        const c = clientById(d.clientId);
        return (
          <WhatsAppDialog open={true} onClose={() => setWaId(null)}
            phone={c?.phone ?? ""} context={{ client: c, delivery: d }}
            defaultTemplate="consegna_in_arrivo" templates={["consegna_in_arrivo", "libero"]} />
        );
      })()}
    </div>
  );
}

function Kpi({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function DeliverySheet({ mode, delivery, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; delivery?: Delivery;
  onClose: () => void; onSave: (d: Omit<Delivery, "id" | "createdAt"> | Partial<Delivery>) => void;
  onDelete?: () => void;
}) {
  const { clients, orders } = useStore();
  const [clientQ, setClientQ] = useState("");
  const [clientId, setClientId] = useState(delivery?.clientId ?? clients[0]?.id ?? "");
  const [address, setAddress] = useState(delivery?.address ?? "");
  const [date, setDate] = useState(() => {
    const d = delivery ? new Date(delivery.date) : new Date();
    if (!delivery) { d.setHours(10, 0, 0, 0); }
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(+d - tz).toISOString().slice(0, 10);
  });
  const [slot, setSlot] = useState(delivery?.timeSlot ?? "10:00-12:00");
  const [status, setStatus] = useState<DeliveryStatus>(delivery?.status ?? "da_preparare");
  const [payment, setPayment] = useState<DeliveryPayment>(delivery?.payment ?? "da_pagare");
  const [orderId, setOrderId] = useState(delivery?.orderId ?? "");
  const [notes, setNotes] = useState(delivery?.notes ?? "");

  const selectedClient = clients.find(c => c.id === clientId);
  const clientOrders = orders.filter(o => o.clientId === clientId);
  const clientSugg = clientQ.length >= 1
    ? clients.filter(c => c.name.toLowerCase().includes(clientQ.toLowerCase())).slice(0, 6) : [];

  const save = () => {
    if (!clientId || !address.trim()) return;
    const payload: Omit<Delivery, "id" | "createdAt"> = {
      clientId, address: address.trim(),
      date: new Date(date).toISOString(),
      timeSlot: slot, status, payment,
      orderId: orderId || undefined,
      notes: notes.trim() || undefined,
    };
    onSave(payload);
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuova consegna" : "Modifica consegna"}
      footer={
        <div className="flex gap-3">
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!clientId || !address.trim()}
            className="flex-1 bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">Conferma</button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente">
          <input placeholder="Cerca o seleziona..." value={clientQ || selectedClient?.name || ""}
            onChange={(e) => setClientQ(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
          {clientSugg.length > 0 && clientQ && (
            <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto">
              {clientSugg.map(c => (
                <button key={c.id} onClick={() => { setClientId(c.id); setClientQ(""); if (c.deliveryZone) setAddress(c.deliveryZone); }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-cream text-sm border-b border-border last:border-0">
                  {c.name} <span className="text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Indirizzo">
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Via, civico, città" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fascia oraria">
          <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="10:00-12:00"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(STATUS_LABEL) as DeliveryStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Pagamento">
          <select value={payment} onChange={(e) => setPayment(e.target.value as DeliveryPayment)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(PAY_LABEL) as DeliveryPayment[]).map(s => <option key={s} value={s}>{PAY_LABEL[s]}</option>)}
          </select>
        </Field>
        {clientOrders.length > 0 && (
          <Field label="Ordine collegato">
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-3">
              <option value="">— Nessuno —</option>
              {clientOrders.map(o => <option key={o.id} value={o.id}>{formatDate(o.pickupDate)} {formatTime(o.pickupDate)} — {formatEuro(o.total)}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}
