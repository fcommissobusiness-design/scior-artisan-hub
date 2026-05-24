import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatTime, Fab, Sheet, Field } from "@/components/AppShell";
import { calcMargin, type CasualSale, type OrderItem, type OrderSource, type DeliveryMode } from "@/lib/data";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";
import {
  pendingPickupsToday, lateOrders, inactiveClients,
  loyaltyReadyClients, openDeliveries, dailyMargin, orderMargin,
  lowStockProducts, outOfStockProducts, supplierPaymentsOverdue,
  productionsForDate,
} from "@/lib/metrics";
import { loadCrmSettings } from "@/lib/crm-settings";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { OrderSheet } from "@/routes/ordini";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { orders, products, clients, casualSales, deliveries, supplierPayments, productions, updateOrder, addCasualSale, addClient, addOrder } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("today");
  const [customStart, setCustomStart] = useState<string>("2026-01-01");
  const [customEnd, setCustomEnd] = useState<string>("2026-12-31");
  const [openSale, setOpenSale] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [openQuick, setOpenQuick] = useState(false);
  const [pickAction, setPickAction] = useState(false);
  const [waOpen, setWaOpen] = useState<{ phone: string; clientId?: string; orderId?: string } | null>(null);
  const navigate = useNavigate();

  const tf = useMemo(() => {
    if (tfId === "custom") return makeTimeFrame("custom", new Date(customStart), new Date(customEnd));
    return makeTimeFrame(tfId);
  }, [tfId, customStart, customEnd]);

  const ordersInFrame = orders.filter((o) => inFrame(o.pickupDate, tf));
  const salesInFrame = casualSales.filter((s) => inFrame(s.date, tf));

  const fattStimato = ordersInFrame.filter((o) => o.status === "in_attesa" || o.status === "pronto" || o.status === "da_consegnare").reduce((s, o) => s + o.total, 0);
  const fattGenerato =
    ordersInFrame.filter((o) => o.status === "ritirato" || o.status === "consegnato").reduce((s, o) => s + o.total, 0) +
    salesInFrame.reduce((s, o) => s + o.total, 0);
  const ticketMedio = salesInFrame.length === 0 ? 0 : salesInFrame.reduce((s, x) => s + x.total, 0) / salesInFrame.length;

  const mGiorno = useMemo(() => dailyMargin(orders, casualSales, products), [orders, casualSales, products]);
  const ritardi = useMemo(() => lateOrders(orders), [orders]);
  useMemo(() => inactiveClients(orders, casualSales, clients, loadCrmSettings().inactiveOccDays), [orders, casualSales, clients]);
  const premi = useMemo(() => loyaltyReadyClients(clients), [clients]);
  const consegneAperte = useMemo(() => openDeliveries(deliveries), [deliveries]);
  const sottoCosto = products.filter((p) => { const m = calcMargin(p); return m !== null && m < 0; });
  const lowStock = useMemo(() => lowStockProducts(products), [products]);
  const outStock = useMemo(() => outOfStockProducts(products), [products]);
  const overduePay = useMemo(() => supplierPaymentsOverdue(supplierPayments), [supplierPayments]);
  const prodOggi = useMemo(() => productionsForDate(productions), [productions]);

  // "Ritiri" rispetta il timeframe + esclude finalizzati/annullati
  const ritiriFrame = ordersInFrame
    .filter((o) => o.status === "in_attesa" || o.status === "pronto" || o.status === "da_consegnare")
    .sort((a, b) => +new Date(a.pickupDate) - +new Date(b.pickupDate));

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

      <div className="p-4 md:p-6 space-y-5 md:space-y-6">
        {tfId === "custom" && (
          <div className="bg-card rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center">
            <Field label="Dal">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Al">
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-brand-cream border border-border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
        )}

        {/* ATTENZIONE */}
        {(ritardi.length > 0 || premi.length > 0 || sottoCosto.length > 0 || consegneAperte.length > 0 || lowStock.length > 0 || outStock.length > 0 || overduePay.length > 0 || prodOggi.filter(p => p.status === "da_preparare").length > 0) && (
          <section className="bg-warning/10 border border-warning/30 rounded-xl p-4">
            <h2 className="font-display text-base text-warning mb-2">Attenzione</h2>
            <ul className="text-sm space-y-1 text-foreground/85">
              {ritardi.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/ordini", search: { f: "ritardi" } as any })} className="underline underline-offset-2">{ritardi.length} ordine/i in ritardo</button></li>
              )}
              {prodOggi.filter(p => p.status === "da_preparare").length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/produzione" })} className="underline underline-offset-2">{prodOggi.filter(p => p.status === "da_preparare").length} preparazione/i da fare oggi</button></li>
              )}
              {outStock.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/magazzino" })} className="underline underline-offset-2 text-danger">{outStock.length} prodotto/i esaurito/i</button></li>
              )}
              {lowStock.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/magazzino" })} className="underline underline-offset-2">{lowStock.length} prodotto/i sotto soglia</button></li>
              )}
              {overduePay.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/pagamenti" })} className="underline underline-offset-2 text-danger">{overduePay.length} pagamento/i scaduto/i</button></li>
              )}
              {premi.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/clienti", search: { f: "premi" } as any })} className="underline underline-offset-2">{premi.length} cliente/i con premio fedeltà pronto</button></li>
              )}
              {sottoCosto.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/prodotti", search: { f: "sottocosto" } as any })} className="underline underline-offset-2">{sottoCosto.length} prodotto/i sotto costo</button></li>
              )}
              {consegneAperte.length > 0 && (
                <li>· <button onClick={() => navigate({ to: "/consegne" })} className="underline underline-offset-2">{consegneAperte.length} consegna/e ancora aperta/e</button></li>
              )}
            </ul>
          </section>
        )}

        {/* QUICK ACTIONS */}
        <section className="grid grid-cols-3 gap-2">
          <Quick onClick={() => setOpenOrder(true)} label="Nuovo ordine" />
          <Quick onClick={() => setOpenSale(true)} label="Nuovo scontrino" />
          <Quick onClick={() => setOpenQuick(true)} label="WhatsApp rapido" />
        </section>

        {/* KPI CASSA */}
        <section>
          <h2 className="font-display text-sm uppercase tracking-wide text-muted-foreground mb-2">Cassa</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi to={{ to: "/ordini", search: { f: "ritirati" } as any }} label="Fatt. Generato" value={formatEuro(fattGenerato)} sub="ritirati + scontrini" highlight />
            <Kpi to={{ to: "/ordini", search: { f: "attesa" } as any }} label="Fatt. Stimato" value={formatEuro(fattStimato)} sub="in attesa + pronti" />
            <Kpi label="Margine giorno" value={formatEuro(mGiorno)} sub="oggi" />
            <Kpi label="Scontrino medio" value={formatEuro(ticketMedio)} sub={`${salesInFrame.length} scontrini`} />
          </div>
        </section>

        {/* RITIRI */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Ritiri ({ritiriFrame.length})</h2>
            <Link to="/ordini" className="text-xs text-brand-gold font-semibold">Tutti gli ordini →</Link>
          </div>
          {ritiriFrame.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessun ritiro nel periodo.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ritiriFrame.map((o) => {
              const c = clientById(o.clientId);
              const m = orderMargin(o, products);
              return (
                <div key={o.id} className="bg-card rounded-xl p-4 shadow-sm">
                  <button onClick={() => setEditOrderId(o.id)} className="w-full text-left">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <p className="font-display text-lg leading-tight text-brand-green">{c?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{o.delivery === "domicilio" ? "Consegna" : "Ritiro"} {formatTime(o.pickupDate)} · {formatEuro(o.total)} · margine {formatEuro(m)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${o.status === "pronto" ? "bg-blue-600/15 text-blue-700" : o.status === "da_consegnare" ? "bg-purple-600/15 text-purple-700" : "bg-warning/15 text-warning"}`}>
                        {o.status === "pronto" ? "Pronto" : o.status === "da_consegnare" ? "Da Consegnare" : "Attesa"}
                      </span>
                    </div>
                    <ul className="text-sm text-foreground/80 mb-3 space-y-0.5">
                      {o.items.slice(0, 4).map((i, idx) => {
                        const p = productById(i.productId);
                        return <li key={idx}>· {p?.name ?? i.productId} <span className="text-muted-foreground">x{i.qty}{p?.unit === "kg" ? "kg" : ""}</span></li>;
                      })}
                      {o.items.length > 4 && <li className="text-xs text-muted-foreground">+ altri {o.items.length - 4}</li>}
                    </ul>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {o.status === "in_attesa" && (
                      <button onClick={() => updateOrder(o.id, { status: "pronto" })}
                        className="flex-1 bg-brand-green text-brand-cream rounded-lg py-1.5 text-xs font-semibold">Pronto</button>
                    )}
                    {o.delivery === "domicilio" ? (
                      <button onClick={() => updateOrder(o.id, { status: "consegnato" })}
                        className="flex-1 bg-success text-white rounded-lg py-1.5 text-xs font-semibold">Consegnato</button>
                    ) : (
                      <button onClick={() => updateOrder(o.id, { status: "ritirato" })}
                        className="flex-1 bg-success text-white rounded-lg py-1.5 text-xs font-semibold">Ritirato</button>
                    )}
                    <button onClick={() => { if (confirm("Annullare l'ordine?")) updateOrder(o.id, { status: "annullato" }); }}
                      className="bg-card border border-danger/40 text-danger rounded-lg px-2 py-1.5 text-xs font-semibold">Annulla</button>
                    {c?.phone && (
                      <button onClick={() => setWaOpen({ phone: c.phone, clientId: c.id, orderId: o.id })}
                        className="bg-brand-gold text-white rounded-lg px-2 py-1.5 text-xs font-semibold">WA</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SCONTRINI */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-xl text-brand-green">Scontrini ({salesInFrame.length})</h2>
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

      <Fab onClick={() => setPickAction(true)} />

      {pickAction && (
        <Sheet open={true} onClose={() => setPickAction(false)} title="Cosa vuoi creare?">
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => { setPickAction(false); setOpenOrder(true); }}
              className="bg-brand-green text-brand-cream rounded-xl py-4 font-semibold">Nuovo ordine</button>
            <button onClick={() => { setPickAction(false); setOpenSale(true); }}
              className="bg-brand-gold text-white rounded-xl py-4 font-semibold">Nuovo scontrino</button>
          </div>
        </Sheet>
      )}

      {openOrder && (
        <OrderSheet mode="new" onClose={() => setOpenOrder(false)}
          onSave={(payload) => { addOrder(payload); setOpenOrder(false); }} />
      )}

      {editOrderId && (
        <OrderSheet mode="edit" orderId={editOrderId} onClose={() => setEditOrderId(null)} />
      )}

      <NewSaleSheet
        open={openSale}
        onClose={() => setOpenSale(false)}
        onSave={(s, newClient) => {
          if (newClient) addClient(newClient);
          addCasualSale(s);
          setOpenSale(false);
        }}
      />

      {openQuick && (
        <QuickWhatsAppPicker
          onClose={() => setOpenQuick(false)}
          onPick={(c) => { setOpenQuick(false); setWaOpen({ phone: c.phone, clientId: c.id }); }}
        />
      )}

      {waOpen && (
        <WhatsAppDialog
          open={true}
          onClose={() => setWaOpen(null)}
          phone={waOpen.phone}
          context={{
            client: clients.find(c => c.id === waOpen.clientId),
            order: waOpen.orderId ? orders.find(o => o.id === waOpen.orderId) : undefined,
            productNames: waOpen.orderId ? orders.find(o => o.id === waOpen.orderId)?.items.map(i => products.find(p => p.id === i.productId)?.name ?? "") : undefined,
          }}
          defaultTemplate={waOpen.orderId ? "promemoria_ritiro" : "libero"}
        />
      )}
    </div>
  );
}

function Quick({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="bg-brand-green text-brand-cream rounded-xl px-3 py-3 text-xs md:text-sm font-semibold text-left active:opacity-80">
      {label}
    </button>
  );
}

function Kpi({ label, value, sub, danger, highlight, to }: { label: string; value: string; sub?: string; danger?: boolean; highlight?: boolean; to?: any }) {
  const inner = (
    <div className={`rounded-xl p-4 shadow-sm ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${highlight ? "text-brand-cream/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
  if (to) return <Link to={to.to} search={to.search} className="block">{inner}</Link>;
  return inner;
}

function QuickWhatsAppPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: { id: string; phone: string }) => void }) {
  const { clients } = useStore();
  const [q, setQ] = useState("");
  const filtered = clients.filter((c) => c.phone && c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  return (
    <Sheet open={true} onClose={onClose} title="Scegli cliente">
      <input autoFocus placeholder="Cerca cliente..." value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full bg-card border border-border rounded-lg p-3" />
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => onPick({ id: c.id, phone: c.phone })}
            className="w-full text-left bg-card rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-semibold text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </div>
            <span className="text-brand-gold text-xs font-semibold">→</span>
          </button>
        ))}
      </div>
    </Sheet>
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
    ? clients.filter((c) => c.name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 4) : [];

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
    <Sheet open={open} onClose={onClose} title="Nuovo scontrino"
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
