import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatTime, Fab, Sheet, Field } from "@/components/AppShell";
import { calcMargin, type CasualSale, type OrderItem } from "@/lib/data";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { orders, products, clients, casualSales, updateOrder, addCasualSale, addClient } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const [customStart, setCustomStart] = useState<string>("2026-01-01");
  const [customEnd, setCustomEnd] = useState<string>("2026-12-31");
  const [openSale, setOpenSale] = useState(false);

  const tf = useMemo(() => {
    if (tfId === "custom") return makeTimeFrame("custom", new Date(customStart), new Date(customEnd));
    return makeTimeFrame(tfId);
  }, [tfId, customStart, customEnd]);

  const ordersInFrame = orders.filter((o) => inFrame(o.pickupDate, tf));
  const salesInFrame = casualSales.filter((s) => inFrame(s.date, tf));
  const todayPending = orders.filter((o) => o.status === "in_attesa" && new Date(o.pickupDate).toDateString() === new Date().toDateString());

  const fattStimato = ordersInFrame.filter((o) => o.status === "in_attesa").reduce((s, o) => s + o.total, 0);
  const fattGenerato =
    ordersInFrame.filter((o) => o.status === "ritirato").reduce((s, o) => s + o.total, 0) +
    salesInFrame.reduce((s, o) => s + o.total, 0);

  const kgMozza = ordersInFrame.filter((o) => o.status !== "annullato")
    .reduce((sum, o) => sum + o.items.filter((i) => i.productId.startsWith("mozzarella")).reduce((s, i) => s + i.qty, 0), 0)
    + salesInFrame.reduce((sum, s) => sum + s.items.filter((i) => i.productId.startsWith("mozzarella")).reduce((a, i) => a + i.qty, 0), 0);

  const sottoCosto = products.filter((p) => {
    const m = calcMargin(p);
    return m !== null && m < 0;
  });

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={`${tf.label} · ${tf.start.toLocaleDateString("it-IT")} → ${new Date(+tf.end - 1).toLocaleDateString("it-IT")}`}
        right={
          <select value={tfId} onChange={(e) => setTfId(e.target.value as TimeFrameId)}
            className="bg-brand-green-dark text-brand-cream text-xs rounded-lg px-2 py-2 border border-brand-gold/30">
            {TIME_FRAME_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {tfId === "custom" && (
          <div className="bg-card rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center">
            <Field label="Dal">
              <input type="date" min="2026-01-01" max="2026-12-31" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Al">
              <input type="date" min="2026-01-01" max="2026-12-31" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
        )}

        {sottoCosto.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
            <strong>Attenzione:</strong> {sottoCosto.length} prodotto/i con margine negativo.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Fatt. Stimato" value={formatEuro(fattStimato)} sub="ordini in attesa" />
          <Kpi label="Fatt. Generato" value={formatEuro(fattGenerato)} sub="ritirati + scontrini" highlight />
          <Kpi label="Ordini" value={ordersInFrame.length.toString()} sub={`${ordersInFrame.filter(o=>o.status==='ritirato').length} ritirati`} />
          <Kpi label="Scontrini" value={salesInFrame.length.toString()} sub="acquisti casuali" />
          <Kpi label="Kg Mozzarella" value={kgMozza.toFixed(1)} sub="periodo" />
          <Kpi label="Clienti totali" value={clients.length.toString()} sub="schede" />
          <Kpi label="Sotto Costo" value={sottoCosto.length.toString()} sub="prodotti" danger={sottoCosto.length > 0} />
          <Kpi label="In attesa oggi" value={todayPending.length.toString()} sub="da ritirare" />
        </div>

        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Ordini in attesa oggi</h2>
          </div>
          {todayPending.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessun ordine in attesa oggi.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {todayPending.map((o) => {
              const c = clientById(o.clientId);
              return (
                <div key={o.id} className="bg-card rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-display text-lg leading-tight text-brand-green">{c?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Ritiro {formatTime(o.pickupDate)} · {formatEuro(o.total)}</p>
                    </div>
                  </div>
                  <ul className="text-sm text-foreground/80 mb-3 space-y-0.5">
                    {o.items.map((i, idx) => {
                      const p = productById(i.productId);
                      return <li key={idx}>· {p?.name ?? i.productId} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                    })}
                  </ul>
                  <button
                    onClick={() => updateOrder(o.id, { status: "ritirato" })}
                    className="w-full bg-success text-white rounded-lg py-2.5 text-sm font-semibold active:opacity-80"
                  >
                    Segna come ritirato
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Acquisti casuali (scontrini)</h2>
            <button onClick={() => setOpenSale(true)} className="text-xs bg-brand-gold text-white px-3 py-1.5 rounded-full font-semibold">+ Nuovo</button>
          </div>
          {salesInFrame.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessuno scontrino nel periodo.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {salesInFrame.slice(0, 12).map((s) => {
              const c = s.clientId ? clientById(s.clientId) : null;
              return (
                <div key={s.id} className="bg-card rounded-xl p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">{c?.name ?? s.clientNameInput ?? "Anonimo"}</span>
                    <span className="text-brand-green font-bold">{formatEuro(s.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTime(s.date)} · {new Date(s.date).toLocaleDateString("it-IT")}</p>
                  <p className="text-xs text-foreground/70 mt-1">{s.items.map(i => productById(i.productId)?.name ?? i.productId).join(", ")}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Fab onClick={() => setOpenSale(true)} />

      <NewSaleSheet
        open={openSale}
        onClose={() => setOpenSale(false)}
        onSave={(s, newClient) => {
          if (newClient) addClient(newClient);
          addCasualSale(s);
          setOpenSale(false);
        }}
      />
    </div>
  );
}

function Kpi({ label, value, sub, danger, highlight }: { label: string; value: string; sub?: string; danger?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${highlight ? "text-brand-cream/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

function NewSaleSheet({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (s: Omit<CasualSale, "id">, newClient?: { name: string; phone: string; segment: "occasionali"; stamps: 0 }) => void;
}) {
  const { clients, products } = useStore();
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [items, setItems] = useState<OrderItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [search, setSearch] = useState("");

  const matched = clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase());
  const suggestions = clientName.length >= 2 && !matched
    ? clients.filter((c) => c.name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 4)
    : [];

  const total = items.reduce((s, i) => {
    const p = products.find((p) => p.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  const upd = (id: string, qty: number) => {
    setItems((prev) => {
      const exists = prev.find((p) => p.productId === id);
      if (qty <= 0) return prev.filter((p) => p.productId !== id);
      if (exists) return prev.map((p) => p.productId === id ? { ...p, qty } : p);
      return [...prev, { productId: id, qty }];
    });
  };

  const filtered = products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  const reset = () => { setItems([]); setClientName(""); setSearch(""); };

  const save = () => {
    if (items.length === 0) return;
    const sale: Omit<CasualSale, "id"> = {
      date: new Date(date).toISOString(),
      items, total,
      clientId: matched?.id,
      clientNameInput: clientName.trim() || undefined,
    };
    let newClient: any = undefined;
    if (clientName.trim() && !matched) {
      newClient = { name: clientName.trim(), phone: "", segment: "occasionali" as const, stamps: 0 };
    }
    reset();
    onSave(sale, newClient);
  };

  return (
    <Sheet
      open={open} onClose={onClose} title="Nuovo scontrino"
      footer={
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase text-muted-foreground">Totale</p>
            <p className="font-display text-2xl text-brand-green leading-none">{formatEuro(total)}</p>
          </div>
          <button onClick={save} disabled={items.length === 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma scontrino
          </button>
        </div>
      }
    >
      <Field label="Data e ora">
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>

      <Field label="Cliente (facoltativo)">
        <input placeholder="Nome cliente o lascia vuoto" value={clientName} onChange={(e) => setClientName(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3" />
        {matched && <p className="text-xs text-success mt-1">Cliente esistente: si aggiungerà allo storico di {matched.name}.</p>}
        {!matched && clientName.trim().length >= 2 && (
          <p className="text-xs text-brand-gold mt-1">Nuovo cliente: verrà creata una scheda "Occasionale".</p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => setClientName(c.name)}
                className="text-xs bg-brand-cream border border-border rounded-full px-2 py-1">{c.name}</button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Prodotti">
        <input placeholder="Cerca prodotto..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="max-h-72 overflow-y-auto mt-2 space-y-1">
          {filtered.map((p) => {
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
                  <button onClick={() => upd(p.id, Math.max(0, +(qty - step).toFixed(2)))}
                    className="w-7 h-7 rounded-full bg-brand-cream text-brand-green font-bold border border-border">−</button>
                  <span className="w-10 text-center text-sm font-semibold">{qty || ""}</span>
                  <button onClick={() => upd(p.id, +(qty + step).toFixed(2))}
                    className="w-7 h-7 rounded-full bg-brand-green text-brand-cream font-bold">+</button>
                </div>
              </div>
            );
          })}
        </div>
      </Field>
    </Sheet>
  );
}
