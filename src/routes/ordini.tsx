import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, formatTime } from "@/components/AppShell";
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
  const { orders, clients, products, addOrder, updateOrder } = useStore();
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("all");
  const [open, setOpen] = useState(false);

  const filtered = orders.filter((o) => tab === "all" ? true : o.status === tab)
    .sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate));

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar title="Ordini" subtitle={`${orders.length} totali`} />
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto sticky top-[88px] bg-brand-cream z-30">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Nessun ordine.</p>}
        {filtered.map((o) => {
          const c = clientById(o.clientId);
          return (
            <div key={o.id} className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="font-display text-lg text-brand-green">{c?.name ?? "—"}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Ritiro {formatDate(o.pickupDate)} · {formatTime(o.pickupDate)} · <span className="font-semibold text-brand-green">{formatEuro(o.total)}</span></p>
              <ul className="text-sm space-y-0.5 mb-3">
                {o.items.map((i, idx) => {
                  const p = productById(i.productId);
                  return <li key={idx} className="text-foreground/80">· {p?.name ?? i.productId} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                })}
              </ul>
              {o.notes && <p className="text-xs italic text-muted-foreground mb-3">Note: {o.notes}</p>}
              {o.status === "in_attesa" && (
                <div className="flex gap-2">
                  <button onClick={() => updateOrder(o.id, { status: "ritirato" })} className="flex-1 bg-success text-white rounded-lg py-2 text-sm font-semibold">Ritirato</button>
                  <button onClick={() => updateOrder(o.id, { status: "annullato" })} className="px-3 bg-card border border-danger/40 text-danger rounded-lg py-2 text-sm font-semibold">Annulla</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-brand-gold text-white text-3xl shadow-lg z-40 flex items-center justify-center font-light">
        +
      </button>

      {open && <NewOrderModal onClose={() => setOpen(false)} onSave={(o) => { addOrder(o); setOpen(false); }} />}
    </div>
  );
}

function NewOrderModal({ onClose, onSave }: { onClose: () => void; onSave: (o: Order) => void }) {
  const { clients, products } = useStore();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const total = items.reduce((s, i) => {
    const p = products.find((p) => p.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  const updateItem = (id: string, qty: number) => {
    setItems((prev) => {
      const exists = prev.find((p) => p.productId === id);
      if (qty <= 0) return prev.filter((p) => p.productId !== id);
      if (exists) return prev.map((p) => p.productId === id ? { ...p, qty } : p);
      return [...prev, { productId: id, qty }];
    });
  };

  const filteredProducts = products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase()));

  const save = () => {
    if (!clientId || items.length === 0) return;
    onSave({
      id: "o" + Date.now(), clientId, items,
      pickupDate: new Date(date).toISOString(),
      status: "in_attesa", total, notes, createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-brand-cream w-full max-w-[480px] rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-brand-green text-brand-cream px-5 py-4 flex justify-between items-center">
          <h2 className="font-display text-xl text-brand-gold">Nuovo Ordine</h2>
          <button onClick={onClose} className="text-brand-cream text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3 mt-1">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Data e ora ritiro</label>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-3 mt-1" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Prodotti</label>
            <input placeholder="Cerca prodotto..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 mt-1 text-sm" />
            <div className="max-h-72 overflow-y-auto mt-2 space-y-1">
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
                        className="w-7 h-7 rounded-full bg-brand-cream text-brand-green font-bold">−</button>
                      <span className="w-10 text-center text-sm font-semibold">{qty || ""}</span>
                      <button onClick={() => updateItem(p.id, +(qty + step).toFixed(2))}
                        className="w-7 h-7 rounded-full bg-brand-green text-brand-cream font-bold">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Note</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full bg-card border border-border rounded-lg p-3 mt-1 text-sm" />
          </div>

          <div className="bg-brand-green text-brand-cream rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm">Totale</span>
            <span className="font-display text-2xl text-brand-gold">{formatEuro(total)}</span>
          </div>

          <button onClick={save} disabled={!clientId || items.length === 0}
            className="w-full bg-brand-gold text-white rounded-xl py-3.5 font-semibold disabled:opacity-40">
            Salva ordine
          </button>
        </div>
      </div>
    </div>
  );
}
