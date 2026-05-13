import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, formatTime, Sheet, Field, Fab } from "@/components/AppShell";
import type { Order, OrderItem, OrderStatus } from "@/lib/data";

export const Route = createFileRoute("/ordini")({ component: OrdiniPage });

const TABS: { id: "all" | OrderStatus; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "in_attesa", label: "In Attesa" },
  { id: "ritirato", label: "Ritirati" },
  { id: "annullato", label: "Annullati" },
];

const STATUS_STYLE: Record<OrderStatus, string> = {
  in_attesa: "bg-warning/15 text-warning",
  ritirato: "bg-success/15 text-success",
  annullato: "bg-danger/15 text-danger",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  in_attesa: "In Attesa", ritirato: "Ritirato", annullato: "Annullato",
};

function OrdiniPage() {
  const { orders, clients, products, addOrder } = useStore();
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("all");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = orders.filter((o) => tab === "all" ? true : o.status === tab)
    .sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate));

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar title="Ordini" subtitle={`${orders.length} totali`} />
      <div className="px-4 md:px-6 pt-3 pb-2 flex gap-2 overflow-x-auto sticky top-[88px] md:top-0 bg-brand-cream z-30">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label} ({orders.filter(o => t.id === "all" ? true : o.status === t.id).length})
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12 md:col-span-2">Nessun ordine.</p>}
        {filtered.map((o) => {
          const c = clientById(o.clientId);
          return (
            <button key={o.id} onClick={() => setEditId(o.id)} className="text-left bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-1 gap-2">
                <div>
                  <p className="font-display text-lg text-brand-green leading-tight">{c?.name ?? "—"}</p>
                  {o.label && <p className="text-xs text-brand-gold font-semibold">{o.label}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Ritiro {formatDate(o.pickupDate)} · {formatTime(o.pickupDate)} · <span className="font-semibold text-brand-green">{formatEuro(o.total)}</span></p>
              <ul className="text-sm space-y-0.5">
                {o.items.map((i, idx) => {
                  const p = productById(i.productId);
                  return <li key={idx} className="text-foreground/80">· {p?.name ?? i.productId} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                })}
              </ul>
              {o.notes && <p className="text-xs italic text-muted-foreground mt-2">Note: {o.notes}</p>}
            </button>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <OrderSheet
          mode="new"
          onClose={() => setOpenNew(false)}
          onSave={(payload) => { addOrder(payload); setOpenNew(false); }}
        />
      )}

      {editId && (
        <OrderSheet
          mode="edit"
          orderId={editId}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

function OrderSheet({ mode, orderId, onClose, onSave }: {
  mode: "new" | "edit";
  orderId?: string;
  onClose: () => void;
  onSave?: (o: Omit<Order, "id" | "createdAt">) => void;
}) {
  const { clients, products, orders, updateOrder, deleteOrder } = useStore();
  const existing = orderId ? orders.find((o) => o.id === orderId) : null;

  const [clientId, setClientId] = useState(existing?.clientId ?? clients[0]?.id ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [items, setItems] = useState<OrderItem[]>(existing?.items ?? []);
  const [date, setDate] = useState(() => {
    const d = existing ? new Date(existing.pickupDate) : new Date();
    if (!existing) { d.setMinutes(0); d.setHours(d.getHours() + 1); }
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(+d - tz).toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<OrderStatus>(existing?.status ?? "in_attesa");
  const [search, setSearch] = useState("");

  const total = items.reduce((s, i) => {
    const p = products.find((p) => p.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  const updateItem = (id: string, qty: number) => {
    setItems((prev) => {
      const ex = prev.find((p) => p.productId === id);
      if (qty <= 0) return prev.filter((p) => p.productId !== id);
      if (ex) return prev.map((p) => p.productId === id ? { ...p, qty } : p);
      return [...prev, { productId: id, qty }];
    });
  };

  const filteredProducts = products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  const handleSave = () => {
    if (!clientId || items.length === 0) return;
    const payload: Omit<Order, "id" | "createdAt"> = {
      clientId, label: label.trim() || undefined, items,
      pickupDate: new Date(date).toISOString(),
      status, total, notes: notes.trim() || undefined,
    };
    if (mode === "new") onSave?.(payload);
    else if (existing) { updateOrder(existing.id, payload); onClose(); }
  };

  const handleDelete = () => {
    if (!existing) return;
    if (confirm(`Eliminare definitivamente l'ordine di ${clients.find(c => c.id === existing.clientId)?.name ?? "—"}?`)) {
      deleteOrder(existing.id);
      onClose();
    }
  };

  return (
    <Sheet
      open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Ordine" : "Modifica Ordine"}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase text-muted-foreground">Totale</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)}</p>
          </div>
          {mode === "edit" && (
            <button onClick={handleDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={handleSave} disabled={!clientId || items.length === 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nome ordine (opz.)">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Festa compleanno"
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data e ora ritiro">
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="in_attesa">In Attesa</option>
            <option value="ritirato">Ritirato</option>
            <option value="annullato">Annullato</option>
          </select>
        </Field>
      </div>

      <Field label="Prodotti">
        <input placeholder="Cerca prodotto..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="max-h-80 overflow-y-auto mt-2 space-y-1">
          {filteredProducts.map((p) => {
            const item = items.find((i) => i.productId === p.id);
            const qty = item?.qty ?? 0;
            const step = p.unit === "kg" ? 0.1 : 1;
            return (
              <div key={p.id} className="bg-card rounded-lg p-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatEuro(p.price)}/{p.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateItem(p.id, Math.max(0, +(qty - step).toFixed(2)))}
                    className="w-7 h-7 rounded-full bg-brand-cream text-brand-green font-bold border border-border">−</button>
                  <span className="w-10 text-center text-sm font-semibold">{qty || ""}</span>
                  <button onClick={() => updateItem(p.id, +(qty + step).toFixed(2))}
                    className="w-7 h-7 rounded-full bg-brand-green text-brand-cream font-bold">+</button>
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}
