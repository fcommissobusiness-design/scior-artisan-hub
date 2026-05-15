import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro } from "@/components/AppShell";
import {
  cashFlowMonth, cashFlowDay, paymentsTotalMonth, paymentsByType,
  supplierPaymentsOverdue, grossMargin, topBeneficiaries, topB2BByRevenue,
} from "@/lib/metrics";

export const Route = createFileRoute("/finanza")({ component: FinanzaPage });

function FinanzaPage() {
  const { orders, casualSales, products, cashEntries, supplierPayments, b2bClients } = useStore();
  const today = new Date();

  const inMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const monthCash = cashFlowMonth(cashEntries, today);
  const dayCash = cashFlowDay(cashEntries, today);
  const monthPayments = paymentsTotalMonth(supplierPayments, today);
  const overdue = supplierPaymentsOverdue(supplierPayments);
  const byType = paymentsByType(supplierPayments, today);
  const margin = grossMargin(orders, casualSales, products, inMonth);

  // Fatturato mese (ordini ritirati + scontrini)
  const revOrders = orders.filter(o => o.status === "ritirato" && inMonth(o.pickupDate)).reduce((s, o) => s + o.total, 0);
  const revSales = casualSales.filter(s => inMonth(s.date)).reduce((s, x) => s + x.total, 0);
  const monthRevenue = revOrders + revSales;
  const b2bMonth = b2bClients.flatMap(c => c.history).filter(h => inMonth(h.date)).reduce((s, h) => s + h.total, 0);

  // Saldo netto stimato = margine lordo - uscite/pagamenti del mese
  const netEstimate = margin - monthPayments;
  const netImpactPct = margin > 0 ? (monthPayments / margin) * 100 : 0;

  const topBen = topBeneficiaries(supplierPayments, 5);
  const topB2B = topB2BByRevenue(b2bClients, 3);

  return (
    <div>
      <TopBar title="Finanza" subtitle={`${today.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`} />

      <div className="p-4 md:p-6 space-y-4">
        {/* Sintesi mese */}
        <section className="bg-brand-green text-brand-cream rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wide text-brand-gold/80">Saldo netto stimato del mese</p>
          <p className={`font-display text-4xl mt-1 ${netEstimate >= 0 ? "text-brand-gold" : "text-danger"}`}>{formatEuro(netEstimate)}</p>
          <p className="text-xs opacity-70 mt-1">Margine lordo {formatEuro(margin)} − uscite registrate {formatEuro(monthPayments)}</p>
          {margin > 0 && (
            <div className="mt-3">
              <div className="h-2 bg-brand-cream/10 rounded-full overflow-hidden">
                <div className="h-full bg-brand-gold" style={{ width: `${Math.min(100, netImpactPct)}%` }} />
              </div>
              <p className="text-[11px] mt-1 opacity-80">Le uscite consumano il {netImpactPct.toFixed(0)}% del margine lordo</p>
            </div>
          )}
        </section>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Fatturato mese" value={formatEuro(monthRevenue)} />
          <Kpi label="di cui B2B" value={formatEuro(b2bMonth)} muted />
          <Kpi label="Margine lordo" value={formatEuro(margin)} success />
          <Kpi label="Saldo cassa mese" value={formatEuro(monthCash.balance)} highlight={monthCash.balance >= 0} danger={monthCash.balance < 0} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Entrate cassa mese" value={formatEuro(monthCash.in)} />
          <Kpi label="Uscite cassa mese" value={formatEuro(monthCash.out)} danger />
          <Kpi label="Pagamenti mese" value={formatEuro(monthPayments)} />
          <Kpi label="Scaduti" value={String(overdue.length)} danger={overdue.length > 0} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Saldo cassa oggi" value={formatEuro(dayCash.balance)} highlight={dayCash.balance >= 0} />
          <Kpi label="Movimenti oggi" value={`${dayCash.in > 0 || dayCash.out > 0 ? "Sì" : "—"}`} />
        </div>

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

        {/* Top beneficiari */}
        {topBen.length > 0 && (
          <section className="bg-card rounded-xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Top 5 beneficiari (totale storico)</p>
            <div className="space-y-1.5">
              {topBen.map(b => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span className="truncate">{b.name}</span>
                  <span className="font-semibold">{formatEuro(b.total)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top B2B */}
        {topB2B.length > 0 && (
          <section className="bg-card rounded-xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Top clienti B2B</p>
            <div className="space-y-1.5">
              {topB2B.map(t => (
                <div key={t.client.id} className="flex justify-between text-sm">
                  <span>{t.client.name}</span>
                  <span className="font-semibold">{formatEuro(t.total)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link to="/incassi" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Cassa →</Link>
          <Link to="/pagamenti" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Pagamenti →</Link>
          <Link to="/b2b" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">B2B →</Link>
          <Link to="/report" className="bg-card rounded-xl p-3 text-center text-sm font-semibold text-brand-green">Report →</Link>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight, danger, success, muted }: { label: string; value: string; highlight?: boolean; danger?: boolean; success?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : success ? "text-success" : muted ? "text-muted-foreground" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
