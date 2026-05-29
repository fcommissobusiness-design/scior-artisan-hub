import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, formatEuro } from "@/components/AppShell";
import {
  cashFlowMonth, cashFlowDay, paymentsTotalMonth, paymentsByType,
  supplierPaymentsOverdue, grossMargin, topBeneficiaries, topB2BByRevenue,
  monthlyFixedCostsTotal, fixedCostsByCategory, topFixedCosts,
  variableCostsMonth, goodsReceiptsMonth, paymentsPaidMonth, dueSoonPayments,
  forecastMonth, marginByCategoryMonth, topSuppliersByCost, topConsultantsByCost,
  ecomRevenueMonth, ecomMarginMonth, ecomShippingCostMonth, ecomCogsMonth,
} from "@/lib/metrics";
import {
  FIXED_COST_CATEGORIES, type FixedCost, type FixedCostCategory,
  type FixedCostFrequency, type FixedCostStatus,
} from "@/lib/data";

export const Route = createFileRoute("/finanza")({ component: FinanzaPage });

function FinanzaPage() {
  const s = useStore();
  const today = new Date();

  const inMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };
  const inDay = (iso: string) => new Date(iso).toDateString() === today.toDateString();

  // Fatturato
  const revOrdersToday = s.orders.filter(o => o.status === "ritirato" && inDay(o.pickupDate)).reduce((a, o) => a + o.total, 0);
  const revSalesToday = s.casualSales.filter(x => inDay(x.date)).reduce((a, x) => a + x.total, 0);
  const dayRevenue = revOrdersToday + revSalesToday;

  const revOrdersMonth = s.orders.filter(o => o.status === "ritirato" && inMonth(o.pickupDate)).reduce((a, o) => a + o.total, 0);
  const revSalesMonth = s.casualSales.filter(x => inMonth(x.date)).reduce((a, x) => a + x.total, 0);
  const ecomRev = ecomRevenueMonth(s.onlineOrders, today);
  const ecomMargin = ecomMarginMonth(s.onlineOrders, s.products, today);
  const ecomShipping = ecomShippingCostMonth(s.onlineOrders, today);
  const ecomCogs = ecomCogsMonth(s.onlineOrders, s.products, today);
  const monthRevenue = revOrdersMonth + revSalesMonth + ecomRev;
  const b2bMonth = s.b2bClients.flatMap(c => c.history).filter(h => inMonth(h.date)).reduce((a, h) => a + h.total, 0);

  // Margine lordo (negozio + scontrini + online)
  const margin = grossMargin(s.orders, s.casualSales, s.products, inMonth) + ecomMargin;

  // Cassa
  const monthCash = cashFlowMonth(s.cashEntries, today);
  const dayCash = cashFlowDay(s.cashEntries, today);

  // Pagamenti
  const monthPayments = paymentsTotalMonth(s.supplierPayments, today);
  const paid = paymentsPaidMonth(s.supplierPayments, today);
  const overdue = supplierPaymentsOverdue(s.supplierPayments);
  const dueSoon = dueSoonPayments(s.supplierPayments, 7);
  const byType = paymentsByType(s.supplierPayments, today);

  // Costi fissi & variabili (include COGS online + spedizioni)
  const fixedMonth = monthlyFixedCostsTotal(s.fixedCosts);
  const fixedByCat = fixedCostsByCategory(s.fixedCosts);
  const topFixed = topFixedCosts(s.fixedCosts, 5);
  const varBase = variableCostsMonth(s.orders, s.casualSales, s.products, s.unsoldEntries, today);
  const varMonth = { ...varBase, total: varBase.total + ecomCogs + ecomShipping };
  const receiptsMonth = goodsReceiptsMonth(s.goodsReceipts, today);

  // Utile stimato
  const netEstimate = margin - fixedMonth - varBase.unsoldLoss;

  // Previsione
  const forecast = forecastMonth({
    orders: s.orders, sales: s.casualSales, products: s.products, unsold: s.unsoldEntries,
    fixedCosts: s.fixedCosts, hours: s.businessHours, specials: s.specialDays, date: today,
  });

  // Report
  const topBen = topBeneficiaries(s.supplierPayments, 5);
  const topSup = topSuppliersByCost(s.supplierPayments, 5);
  const topCons = topConsultantsByCost(s.supplierPayments, 5);
  const topB2B = topB2BByRevenue(s.b2bClients, 3);
  const marginByCat = marginByCategoryMonth(s.orders, s.casualSales, s.products, today);

  const [tab, setTab] = useState<"dashboard" | "fissi" | "report">("dashboard");

  return (
    <div>
      <TopBar title="Finanza" subtitle={today.toLocaleDateString("it-IT", { month: "long", year: "numeric" })} />

      <div className="px-4 md:px-6 flex gap-2 pb-2 overflow-x-auto">
        {(["dashboard", "fissi", "report"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "dashboard" ? "Dashboard" : t === "fissi" ? "Costi fissi" : "Report"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="p-4 md:p-6 space-y-4">
          {/* Hero utile stimato */}
          <section className="bg-brand-green text-brand-cream rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wide text-brand-gold/80">Utile netto stimato del mese</p>
            <p className={`font-display text-4xl mt-1 ${netEstimate >= 0 ? "text-brand-gold" : "text-danger"}`}>{formatEuro(netEstimate)}</p>
            <p className="text-xs opacity-70 mt-1">
              Margine lordo {formatEuro(margin)} − costi fissi {formatEuro(fixedMonth)} − scarti {formatEuro(varMonth.unsoldLoss)}
            </p>
          </section>

          {/* Previsione fine mese */}
          <section className="bg-card rounded-2xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Previsione fine mese</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Basata su {forecast.daysOpenSoFar}/{forecast.daysOpenTotal} giorni aperti · media {formatEuro(forecast.avgDailyRevenue)}/giorno
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ForecastCard label="Prudente" value={forecast.prudente} tone="warn" />
              <ForecastCard label="Standard" value={forecast.standard} tone="default" />
              <ForecastCard label="Ottimistico" value={forecast.ottimistico} tone="good" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div>Fatturato proiettato: <span className="font-semibold text-foreground">{formatEuro(forecast.projectedRevenue)}</span></div>
              <div>Variabili proiettate: <span className="font-semibold text-foreground">{formatEuro(forecast.variableProjected)}</span></div>
            </div>
          </section>

          {/* KPI fatturato */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Fatturato oggi" value={formatEuro(dayRevenue)} highlight />
            <Kpi label="Fatturato mese" value={formatEuro(monthRevenue)} />
            <Kpi label="di cui B2B" value={formatEuro(b2bMonth)} muted />
            <Kpi label="Margine lordo" value={formatEuro(margin)} success />
          </div>

          {/* KPI costi */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Costi fissi mese" value={formatEuro(fixedMonth)} danger />
            <Kpi label="Costi variabili" value={formatEuro(varMonth.total)} danger />
            <Kpi label="Pagamenti effettuati" value={formatEuro(paid)} />
            <Kpi label="Pagamenti totali" value={formatEuro(monthPayments)} />
          </div>

          {/* KPI cassa */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Saldo oggi" value={formatEuro(dayCash.balance)} highlight={dayCash.balance >= 0} danger={dayCash.balance < 0} />
            <Kpi label="Saldo mese" value={formatEuro(monthCash.balance)} highlight={monthCash.balance >= 0} danger={monthCash.balance < 0} />
            <Kpi label="Entrate merci" value={formatEuro(receiptsMonth)} muted />
            <Kpi label="Scarti/invenduto" value={formatEuro(varMonth.unsoldLoss)} danger={varMonth.unsoldLoss > 0} />
          </div>

          {/* Alert pagamenti */}
          {(overdue.length > 0 || dueSoon.length > 0) && (
            <section className="bg-card rounded-xl p-4 space-y-2">
              <p className="text-xs uppercase font-bold text-brand-green">Pagamenti — attenzione</p>
              {overdue.length > 0 && (
                <Link to="/pagamenti" className="block bg-danger/10 rounded-lg p-3">
                  <p className="text-sm font-semibold text-danger">{overdue.length} pagament{overdue.length === 1 ? "o" : "i"} scadut{overdue.length === 1 ? "o" : "i"}</p>
                  <p className="text-[11px] text-muted-foreground">Tot: {formatEuro(overdue.reduce((a, p) => a + p.amount, 0))}</p>
                </Link>
              )}
              {dueSoon.length > 0 && (
                <Link to="/pagamenti" className="block bg-warning/10 rounded-lg p-3">
                  <p className="text-sm font-semibold text-warning">{dueSoon.length} in scadenza nei prossimi 7 giorni</p>
                  <p className="text-[11px] text-muted-foreground">Tot: {formatEuro(dueSoon.reduce((a, p) => a + p.amount, 0))}</p>
                </Link>
              )}
            </section>
          )}

          {/* Uscite per tipo */}
          <section className="bg-card rounded-xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Uscite per tipologia (mese)</p>
            <div className="space-y-2">
              {Object.entries(byType).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="capitalize">{k}</span>
                    <span className="font-semibold">{formatEuro(v)}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-brand-gold" style={{ width: monthPayments > 0 ? `${(v / monthPayments) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link to="/incassi" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Cassa →</Link>
            <Link to="/pagamenti" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Pagamenti →</Link>
            <Link to="/entrate-merci" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Scarico prodotti →</Link>
            <Link to="/report" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Report →</Link>
          </div>

          <Disclaimer />
        </div>
      )}

      {tab === "fissi" && <FixedCostsTab fixedByCat={fixedByCat} fixedMonth={fixedMonth} topFixed={topFixed} />}

      {tab === "report" && (
        <div className="p-4 md:p-6 space-y-4">
          <ReportCard title="Entrate vs Uscite (mese)">
            <Row label="Fatturato" value={formatEuro(monthRevenue)} good />
            <Row label="Costi fissi" value={formatEuro(fixedMonth)} bad />
            <Row label="Costi variabili (COGS + scarti)" value={formatEuro(varMonth.total)} bad />
            <Row label="Pagamenti registrati" value={formatEuro(paid)} bad />
            <div className="border-t border-border my-2" />
            <Row label="Margine lordo" value={formatEuro(margin)} good bold />
            <Row label="Utile stimato" value={formatEuro(netEstimate)} good={netEstimate >= 0} bad={netEstimate < 0} bold />
          </ReportCard>

          <ReportCard title="Margine per categoria prodotto (mese)">
            {marginByCat.length === 0 && <p className="text-sm text-muted-foreground">Nessun dato.</p>}
            {marginByCat.map(c => (
              <Row key={c.category} label={c.category}
                value={`${formatEuro(c.margin)} · ${c.revenue > 0 ? ((c.margin / c.revenue) * 100).toFixed(0) : 0}%`} />
            ))}
          </ReportCard>

          <ReportCard title="Top fornitori più costosi">
            {topSup.length === 0 && <p className="text-sm text-muted-foreground">Nessun pagamento registrato.</p>}
            {topSup.map(t => <Row key={t.name} label={t.name} value={formatEuro(t.total)} />)}
          </ReportCard>

          <ReportCard title="Top consulenti / servizi">
            {topCons.length === 0 && <p className="text-sm text-muted-foreground">Nessun pagamento registrato.</p>}
            {topCons.map(t => <Row key={t.name} label={t.name} value={formatEuro(t.total)} />)}
          </ReportCard>

          <ReportCard title="Top beneficiari (storico)">
            {topBen.map(t => <Row key={t.name} label={t.name} value={formatEuro(t.total)} />)}
          </ReportCard>

          {topB2B.length > 0 && (
            <ReportCard title="Top clienti B2B">
              {topB2B.map(t => <Row key={t.client.id} label={t.client.name} value={formatEuro(t.total)} />)}
            </ReportCard>
          )}

          <Disclaimer />
        </div>
      )}
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-3 py-1">
      Dati gestionali interni e stime operative. Non sostituiscono commercialista, registratore fiscale o contabilità ufficiale.
    </p>
  );
}

function Kpi({ label, value, highlight, danger, success, muted }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; success?: boolean; muted?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : success ? "text-success" : muted ? "text-muted-foreground" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function ForecastCard({ label, value, tone }: { label: string; value: number; tone: "warn" | "default" | "good" }) {
  const color = value < 0 ? "text-danger" : tone === "warn" ? "text-warning" : tone === "good" ? "text-success" : "text-brand-green";
  return (
    <div className="bg-background border border-border rounded-xl p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`font-display text-lg mt-1 ${color}`}>{formatEuro(value)}</p>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl p-4">
      <p className="text-xs uppercase font-bold text-brand-green mb-3">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value, good, bad, bold }: { label: string; value: string; good?: boolean; bad?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="truncate">{label}</span>
      <span className={bad ? "text-danger" : good ? "text-success" : "text-foreground"}>{value}</span>
    </div>
  );
}

// ============= COSTI FISSI TAB =============

function FixedCostsTab({ fixedByCat, fixedMonth, topFixed }: {
  fixedByCat: Record<string, number>; fixedMonth: number; topFixed: FixedCost[];
}) {
  const { fixedCosts, addFixedCost, updateFixedCost, deleteFixedCost } = useStore();
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"attivi" | "inattivi" | "tutti">("attivi");

  const list = useMemo(() => {
    return [...fixedCosts]
      .filter(c => filter === "tutti" || (filter === "attivi" ? c.status === "attivo" : c.status === "inattivo"))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [fixedCosts, filter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Costi fissi mese" value={formatEuro(fixedMonth)} highlight />
        <Kpi label="Voci attive" value={String(fixedCosts.filter(c => c.status === "attivo").length)} />
        <Kpi label="Top voce" value={topFixed[0]?.name ?? "—"} muted />
      </div>

      <section className="bg-card rounded-xl p-4">
        <p className="text-xs uppercase font-bold text-brand-green mb-3">Per categoria (mese normalizzato)</p>
        <div className="space-y-2">
          {Object.entries(fixedByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="capitalize">{k}</span>
                <span className="font-semibold">{formatEuro(v)}</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-brand-gold" style={{ width: fixedMonth > 0 ? `${(v / fixedMonth) * 100}%` : "0%" }} />
              </div>
            </div>
          ))}
          {Object.keys(fixedByCat).length === 0 && <p className="text-sm text-muted-foreground">Nessun costo fisso.</p>}
        </div>
      </section>

      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          {(["attivi", "inattivi", "tutti"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setOpenNew(true)} className="bg-brand-gold text-white rounded-full px-4 py-2 text-sm font-semibold">+ Nuovo</button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Nessun costo fisso.</p>}
        {list.map(c => {
          const monthly = c.frequency === "annuale" ? c.amount / 12 : c.frequency === "mensile" ? c.amount : 0;
          return (
            <button key={c.id} onClick={() => setEditId(c.id)} className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-display text-base text-brand-green truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{c.category} · {c.frequency} · {c.status}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-lg text-brand-green">{formatEuro(c.amount)}</p>
                {c.frequency !== "mensile" && <p className="text-[10px] text-muted-foreground">{formatEuro(monthly)}/mese</p>}
              </div>
            </button>
          );
        })}
      </div>

      <Disclaimer />

      {openNew && <FixedCostSheet mode="new" onClose={() => setOpenNew(false)}
        onSave={(d) => { addFixedCost(d as Omit<FixedCost, "id">); setOpenNew(false); }} />}
      {editId && (() => {
        const c = fixedCosts.find(x => x.id === editId);
        if (!c) return null;
        return <FixedCostSheet mode="edit" cost={c} onClose={() => setEditId(null)}
          onSave={(p) => { updateFixedCost(c.id, p); setEditId(null); }}
          onDelete={() => { if (confirm("Eliminare?")) { deleteFixedCost(c.id); setEditId(null); } }} />;
      })()}
    </div>
  );
}

const FREQS: FixedCostFrequency[] = ["mensile", "annuale", "una_tantum"];
const STATUSES: FixedCostStatus[] = ["attivo", "inattivo"];

function FixedCostSheet({ mode, cost, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; cost?: FixedCost;
  onClose: () => void; onSave: (d: Omit<FixedCost, "id"> | Partial<FixedCost>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(cost?.name ?? "");
  const [category, setCategory] = useState<FixedCostCategory>(cost?.category ?? "altro");
  const [amount, setAmount] = useState(cost?.amount ?? 0);
  const [frequency, setFrequency] = useState<FixedCostFrequency>(cost?.frequency ?? "mensile");
  const [status, setStatus] = useState<FixedCostStatus>(cost?.status ?? "attivo");
  const [notes, setNotes] = useState(cost?.notes ?? "");

  const save = () => {
    if (!name.trim() || !amount) return;
    onSave({ name: name.trim(), category, amount: Number(amount), frequency, status, notes: notes.trim() || undefined });
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
        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select value={category} onChange={e => setCategory(e.target.value as FixedCostCategory)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {FIXED_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Importo (€)">
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Frequenza">
          <select value={frequency} onChange={e => setFrequency(e.target.value as FixedCostFrequency)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Stato">
          <select value={status} onChange={e => setStatus(e.target.value as FixedCostStatus)}
            className="w-full bg-card border border-border rounded-lg p-3">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
