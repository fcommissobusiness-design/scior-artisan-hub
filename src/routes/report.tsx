import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate } from "@/components/AppShell";
import { makeTimeFrame, inFrame, TIME_FRAME_OPTIONS, type TimeFrameId } from "@/lib/timeframe";
import {
  productSalesStats, clientLTV, daysInactive, bundleStatsFromOrders,
} from "@/lib/metrics";

export const Route = createFileRoute("/report")({ component: ReportPage });

function ReportPage() {
  const { orders, casualSales, products, clients, bundles } = useStore();
  const [tfId, setTfId] = useState<TimeFrameId>("thisMonth");
  const tf = useMemo(() => makeTimeFrame(tfId), [tfId]);

  const ordersF = orders.filter(o => inFrame(o.pickupDate, tf) && o.status === "ritirato");
  const salesF = casualSales.filter(s => inFrame(s.date, tf));

  const fatturato = ordersF.reduce((s, o) => s + o.total, 0) + salesF.reduce((s, x) => s + x.total, 0);
  const margineTot = useMemo(() => {
    const m = (items: { productId: string; qty: number }[]) =>
      items.reduce((s, i) => {
        const p = products.find(p => p.id === i.productId);
        if (!p || p.cost == null) return s;
        return s + (p.price - p.cost) * i.qty;
      }, 0);
    return ordersF.reduce((s, o) => s + m(o.items), 0) + salesF.reduce((s, x) => s + m(x.items), 0);
  }, [ordersF, salesF, products]);

  const scontrinoMedio = (ordersF.length + salesF.length) === 0 ? 0 : fatturato / (ordersF.length + salesF.length);

  const stats = useMemo(() => productSalesStats(ordersF, salesF, products), [ordersF, salesF, products]);
  const topProdotti = [...stats].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const topMargini = [...stats].sort((a, b) => b.profit - a.profit).slice(0, 8);

  const trendMozza = stats.filter(s => s.product.id.includes("mozzarella"))
    .reduce((s, x) => s + x.qty, 0);

  const topClienti = useMemo(() => clients
    .map(c => ({ c, ltv: clientLTV(orders, casualSales, c.id) }))
    .sort((a, b) => b.ltv - a.ltv).slice(0, 10), [clients, orders, casualSales]);

  const inattivi = useMemo(() => clients
    .map(c => ({ c, d: daysInactive(orders, casualSales, c) }))
    .filter(x => x.d !== null && x.d > 60)
    .sort((a, b) => (b.d ?? 0) - (a.d ?? 0)).slice(0, 10), [clients, orders, casualSales]);

  void bundleStatsFromOrders(orders, bundles);

  return (
    <div>
      <TopBar title="Report" subtitle={tf.label}
        right={
          <select value={tfId} onChange={(e) => setTfId(e.target.value as TimeFrameId)}
            className="bg-brand-green-dark text-brand-cream text-xs rounded-lg px-2 py-2 border border-brand-gold/30">
            {TIME_FRAME_OPTIONS.filter(o => o.id !== "custom").map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Fatturato" value={formatEuro(fatturato)} highlight />
          <Kpi label="Margine totale" value={formatEuro(margineTot)} />
          <Kpi label="Scontrino medio" value={formatEuro(scontrinoMedio)} />
          <Kpi label="Kg mozzarella" value={trendMozza.toFixed(1)} />
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-2">Top prodotti per fatturato</h2>
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-green text-brand-cream text-xs uppercase">
                <tr><th className="text-left p-2">Prodotto</th><th className="text-right p-2">Q.tà</th><th className="text-right p-2">Fatt.</th><th className="text-right p-2">Margine</th></tr>
              </thead>
              <tbody>
                {topProdotti.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nessun dato.</td></tr>}
                {topProdotti.map(s => (
                  <tr key={s.product.id} className="border-t border-border">
                    <td className="p-2">{s.product.name}</td>
                    <td className="text-right p-2 font-mono">{s.qty.toFixed(s.product.unit === "kg" ? 1 : 0)} {s.product.unit}</td>
                    <td className="text-right p-2 font-semibold text-brand-green">{formatEuro(s.revenue)}</td>
                    <td className="text-right p-2 text-success">{formatEuro(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-2">Top clienti per LTV</h2>
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-green text-brand-cream text-xs uppercase">
                <tr><th className="text-left p-2">Cliente</th><th className="text-left p-2">Segmento</th><th className="text-right p-2">LTV</th></tr>
              </thead>
              <tbody>
                {topClienti.map(({ c, ltv }) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">{c.segment}</td>
                    <td className="text-right p-2 font-semibold text-brand-green">{formatEuro(ltv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-2">Top margini prodotto</h2>
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-green text-brand-cream text-xs uppercase">
                <tr><th className="text-left p-2">Prodotto</th><th className="text-right p-2">Margine €</th></tr>
              </thead>
              <tbody>
                {topMargini.map(s => (
                  <tr key={s.product.id} className="border-t border-border">
                    <td className="p-2">{s.product.name}</td>
                    <td className="text-right p-2 font-semibold text-success">{formatEuro(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {inattivi.length > 0 && (
          <section>
            <h2 className="font-display text-lg text-brand-green mb-2">Clienti inattivi (60+ giorni)</h2>
            <div className="bg-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-green text-brand-cream text-xs uppercase">
                  <tr><th className="text-left p-2">Cliente</th><th className="text-left p-2">Telefono</th><th className="text-right p-2">Inattivo da</th><th className="text-right p-2">Ultimo</th></tr>
                </thead>
                <tbody>
                  {inattivi.map(({ c, d }) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-xs text-muted-foreground">{c.phone}</td>
                      <td className="text-right p-2 font-semibold">{d}gg</td>
                      <td className="text-right p-2 text-xs text-muted-foreground">{c.lastOrder ? formatDate(c.lastOrder) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
