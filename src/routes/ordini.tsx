import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate, formatTime, Sheet, Field, Fab } from "@/components/AppShell";
import type { Order, OrderItem, OrderStatus, OrderSource } from "@/lib/data";
import { orderMargin } from "@/lib/metrics";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

interface Search { f?: string }

export const Route = createFileRoute("/ordini")({
  component: OrdiniPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

const STATUS_STYLE: Record<OrderStatus, string> = {
  in_attesa: "bg-warning/15 text-warning",
  pronto: "bg-blue-600/15 text-blue-700",
  ritirato: "bg-success/15 text-success",
  annullato: "bg-danger/15 text-danger",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  in_attesa: "In Attesa", pronto: "Pronto", ritirato: "Ritirato", annullato: "Annullato",
};

const SOURCE_LABEL: Record<OrderSource, string> = {
  negozio: "Negozio", whatsapp: "WhatsApp", telefono: "Telefono", consegna: "Consegna", altro: "Altro",
};

type Filter = "all" | "oggi" | "domani" | "ritardi" | "consegne" | "mozzarella" | "alto" | "attesa" | "pronti" | "ritirati" | "annullati";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tutti" },
  { id: "oggi", label: "Oggi" },
  { id: "domani", label: "Domani" },
  { id: "ritardi", label: "Ritardi" },
  { id: "attesa", label: "In attesa" },
  { id: "pronti", label: "Pronti" },
  { id: "consegne", label: "Consegne" },
  { id: "mozzarella", label: "Mozzarella" },
  { id: "alto", label: "Alto valore" },
  { id: "ritirati", label: "Ritirati" },
  { id: "annullati", label: "Annullati" },
];

function OrdiniPage() {
  const search = useSearch({ from: "/ordini" }) as Search;
  const { orders, clients, products, addOrder, updateOrder, deleteOrder, duplicateOrder } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState<string | null>(null); // orderId

  // sync da query string (deep links da dashboard)
  useEffect(() => {
    if (search.f === "nuovo") setOpenNew(true);
    if (search.f && ["oggi","domani","ritardi","attesa","pronti","ritirati","mozzarella","alto"].includes(search.f)) {
      setFilter(search.f as Filter);
    }
  }, [search.f]);

  const todayStr = new Date().toDateString();
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toDateString(); })();
  const cut = Date.now() - 86400000;

  const filtered = useMemo(() => orders.filter((o) => {
    const c = clients.find((c) => c.id === o.clientId);
    if (q && !(c?.name.toLowerCase().includes(q.toLowerCase()) || c?.phone.includes(q))) return false;
    switch (filter) {
      case "oggi": return new Date(o.pickupDate).toDateString() === todayStr && o.status !== "annullato";
      case "domani": return new Date(o.pickupDate).toDateString() === tomorrowStr;
      case "ritardi": return o.status === "in_attesa" && +new Date(o.pickupDate) < cut;
      case "attesa": return o.status === "in_attesa";
      case "pronti": return o.status === "pronto";
      case "ritirati": return o.status === "ritirato";
      case "annullati": return o.status === "annullato";
      case "consegne": return !!o.deliveryId;
      case "mozzarella": return o.items.some(i => i.productId.includes("mozzarella"));
      case "alto": return o.total >= 30;
      default: return true;
    }
  }).sort((a, b) => +new Date(b.pickupDate) - +new Date(a.pickupDate)), [orders, filter, q, clients, todayStr, tomorrowStr, cut]);

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar title="Ordini" subtitle={`${orders.length} totali · ${filtered.length} visibili`} />

      <div className="px-4 md:px-6 pt-3 sticky top-0 md:static bg-brand-cream z-30 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente o telefono..."
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === t.id ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12 md:col-span-2">Nessun ordine.</p>}
        {filtered.map((o) => {
          const c = clientById(o.clientId);
          const m = orderMargin(o, products);
          const overdue = o.status === "in_attesa" && +new Date(o.pickupDate) < cut;
          return (
            <div key={o.id} className={`bg-card rounded-xl p-4 shadow-sm ${overdue ? "ring-2 ring-danger/40" : ""}`}>
              <button onClick={() => setEditId(o.id)} className="w-full text-left">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div>
                    <p className="font-display text-lg text-brand-green leading-tight">{c?.name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{c?.phone ?? "—"} · {SOURCE_LABEL[o.source ?? "negozio"]}</p>
                    {o.label && <p className="text-xs text-brand-gold font-semibold mt-0.5">{o.label}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                    {o.deliveryId && <span className="text-[9px] bg-blue-600/15 text-blue-700 px-1.5 py-0.5 rounded">Consegna</span>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Ritiro {formatDate(o.pickupDate)} · {formatTime(o.pickupDate)} · <span className="font-semibold text-brand-green">{formatEuro(o.total)}</span> · margine <span className="font-semibold">{formatEuro(m)}</span>
                </p>
                <ul className="text-sm space-y-0.5">
                  {o.items.slice(0, 3).map((i, idx) => {
                    const p = productById(i.productId);
                    return <li key={idx} className="text-foreground/80">· {p?.name ?? i.productId} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                  })}
                  {o.items.length > 3 && <li className="text-xs text-muted-foreground">+ altri {o.items.length - 3}</li>}
                </ul>
                {o.notes && <p className="text-xs italic text-muted-foreground mt-2">Note: {o.notes}</p>}
              </button>
              <div className="flex gap-1.5 mt-3">
                {o.status === "in_attesa" && (
                  <button onClick={() => updateOrder(o.id, { status: "pronto" })}
                    className="flex-1 text-xs bg-brand-green text-brand-cream rounded-lg py-1.5 font-semibold">Pronto</button>
                )}
                {(o.status === "in_attesa" || o.status === "pronto") && (
                  <button onClick={() => updateOrder(o.id, { status: "ritirato" })}
                    className="flex-1 text-xs bg-success text-white rounded-lg py-1.5 font-semibold">Ritirato</button>
                )}
                <button onClick={() => duplicateOrder(o.id)}
                  className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 font-semibold">Duplica</button>
                {c?.phone && (
                  <button onClick={() => setWaOpen(o.id)}
                    className="text-xs bg-brand-gold text-white rounded-lg px-2 py-1.5 font-semibold">WA</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <OrderSheet mode="new" onClose={() => setOpenNew(false)}
          onSave={(payload) => { addOrder(payload); setOpenNew(false); }} />
      )}

      {editId && (
        <OrderSheet mode="edit" orderId={editId} onClose={() => setEditId(null)} />
      )}

      {waOpen && (() => {
        const o = orders.find(x => x.id === waOpen);
        if (!o) return null;
        const c = clientById(o.clientId);
        return (
          <WhatsAppDialog
            open={true} onClose={() => setWaOpen(null)}
            phone={c?.phone ?? ""}
            context={{ client: c, order: o, productNames: o.items.map(i => productById(i.productId)?.name ?? "") }}
            defaultTemplate={o.status === "pronto" ? "ordine_pronto" : "promemoria_ritiro"}
            templates={["conferma_ordine", "promemoria_ritiro", "ordine_pronto", "libero"]}
          />
        );
      })()}

      {filtered.find(o => o.status === "in_attesa") && filter === "ritardi" && (
        <div className="px-4 md:px-6 pb-4 text-xs text-muted-foreground italic">
          Ordini "In attesa" con data ritiro più vecchia di 24 ore.
        </div>
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

  const [clientQ, setClientQ] = useState("");
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
  const [source, setSource] = useState<OrderSource>(existing?.source ?? "negozio");
  const [search, setSearch] = useState("");

  const total = items.reduce((s, i) => {
    const p = products.find((p) => p.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);
  const margin = orderMargin({ items } as Order, products);

  const updateItem = (id: string, qty: number) => {
    setItems((prev) => {
      const ex = prev.find((p) => p.productId === id);
      if (qty <= 0) return prev.filter((p) => p.productId !== id);
      if (ex) return prev.map((p) => p.productId === id ? { ...p, qty } : p);
      return [...prev, { productId: id, qty }];
    });
  };

  const filteredProducts = products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);
  const clientSuggestions = clientQ.length >= 1
    ? clients.filter(c => c.name.toLowerCase().includes(clientQ.toLowerCase()) || c.phone.includes(clientQ)).slice(0, 6)
    : [];

  const handleSave = () => {
    if (!clientId || items.length === 0) return;
    const payload: Omit<Order, "id" | "createdAt"> = {
      clientId, label: label.trim() || undefined, items,
      pickupDate: new Date(date).toISOString(),
      status, total, notes: notes.trim() || undefined, source,
    };
    if (mode === "new") onSave?.(payload);
    else if (existing) { updateOrder(existing.id, payload); onClose(); }
  };

  const handleDelete = () => {
    if (!existing) return;
    if (confirm(`Eliminare definitivamente l'ordine?`)) {
      deleteOrder(existing.id);
      onClose();
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Ordine" : `Ordine · ${selectedClient?.name ?? "—"}`}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase text-muted-foreground">Totale · margine</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)} <span className="text-sm text-muted-foreground">· {formatEuro(margin)}</span></p>
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
          <input placeholder="Cerca o seleziona..." value={clientQ || selectedClient?.name || ""}
            onChange={(e) => { setClientQ(e.target.value); }}
            className="w-full bg-card border border-border rounded-lg p-3" />
          {clientSuggestions.length > 0 && clientQ && (
            <div className="bg-card border border-border rounded-lg mt-1 max-h-48 overflow-y-auto">
              {clientSuggestions.map(c => (
                <button key={c.id} onClick={() => { setClientId(c.id); setClientQ(""); }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-cream text-sm border-b border-border last:border-0">
                  {c.name} <span className="text-xs text-muted-foreground">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
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
            <option value="pronto">Pronto</option>
            <option value="ritirato">Ritirato</option>
            <option value="annullato">Annullato</option>
          </select>
        </Field>
        <Field label="Origine">
          <select value={source} onChange={(e) => setSource(e.target.value as OrderSource)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {(Object.keys(SOURCE_LABEL) as OrderSource[]).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
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

      {existing?.timeline && existing.timeline.length > 0 && (
        <Field label="Timeline">
          <ul className="text-xs space-y-1 bg-card rounded-lg p-3">
            {existing.timeline.slice(-8).map((ev, idx) => (
              <li key={idx} className="text-foreground/80">
                <span className="font-mono text-muted-foreground">{new Date(ev.date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                {" · "}<span className="font-semibold uppercase tracking-wide">{ev.type}</span>
                {ev.note && <span className="text-muted-foreground"> — {ev.note}</span>}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Sheet>
  );
}
