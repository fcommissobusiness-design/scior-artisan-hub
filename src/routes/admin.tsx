import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro } from "@/components/AppShell";
import { calcMargin } from "@/lib/data";
import { makeTimeFrame, inFrame } from "@/lib/timeframe";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { orders, casualSales, products, clients } = useStore();

  const tfMonth = makeTimeFrame("thisMonth");
  const tfLastMonth = makeTimeFrame("lastMonth");

  const now = new Date();
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const stats = useMemo(() => {
    const ordersM = orders.filter((o) => inFrame(o.pickupDate, tfMonth));
    const salesM = casualSales.filter((s) => inFrame(s.date, tfMonth));
    const generato =
      ordersM.filter((o) => o.status === "ritirato").reduce((s, o) => s + o.total, 0) +
      salesM.reduce((s, o) => s + o.total, 0);
    const stimato = ordersM.filter((o) => o.status === "in_attesa").reduce((s, o) => s + o.total, 0);

    // margine: per ogni riga -> margine prodotto * qty
    const productById = (id: string) => products.find((p) => p.id === id);
    const marginFromItems = (items: { productId: string; qty: number }[]) =>
      items.reduce((sum, i) => {
        const p = productById(i.productId);
        if (!p || p.cost == null) return sum;
        return sum + (p.price - p.cost) * i.qty;
      }, 0);

    const marginGenerato =
      ordersM.filter((o) => o.status === "ritirato").reduce((s, o) => s + marginFromItems(o.items), 0) +
      salesM.reduce((s, o) => s + marginFromItems(o.items), 0);

    const proiezione = dayOfMonth > 0 ? (generato / dayOfMonth) * totalDaysInMonth : 0;
    const proiezioneMargine = dayOfMonth > 0 ? (marginGenerato / dayOfMonth) * totalDaysInMonth : 0;

    // Mese precedente per confronto
    const ordersLM = orders.filter((o) => inFrame(o.pickupDate, tfLastMonth));
    const salesLM = casualSales.filter((s) => inFrame(s.date, tfLastMonth));
    const generatoLM =
      ordersLM.filter((o) => o.status === "ritirato").reduce((s, o) => s + o.total, 0) +
      salesLM.reduce((s, o) => s + o.total, 0);

    // Top prodotti del mese
    const counts = new Map<string, { qty: number; revenue: number }>();
    for (const o of ordersM.filter(o => o.status === "ritirato")) {
      for (const i of o.items) {
        const cur = counts.get(i.productId) ?? { qty: 0, revenue: 0 };
        const p = productById(i.productId);
        cur.qty += i.qty;
        cur.revenue += (p?.price ?? 0) * i.qty;
        counts.set(i.productId, cur);
      }
    }
    for (const s of salesM) {
      for (const i of s.items) {
        const cur = counts.get(i.productId) ?? { qty: 0, revenue: 0 };
        const p = productById(i.productId);
        cur.qty += i.qty;
        cur.revenue += (p?.price ?? 0) * i.qty;
        counts.set(i.productId, cur);
      }
    }
    const topProducts = [...counts.entries()]
      .map(([id, v]) => ({ product: productById(id), ...v }))
      .filter((x) => x.product)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      generato, stimato, proiezione, marginGenerato, proiezioneMargine,
      generatoLM, ordersM: ordersM.length, salesM: salesM.length,
      topProducts,
    };
  }, [orders, casualSales, products, dayOfMonth, totalDaysInMonth]);

  const sottoCosto = products.filter(p => {
    const m = calcMargin(p);
    return m !== null && m < 0;
  });

  const monthLabel = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <div>
      <TopBar title="Amministrazione" subtitle={`Quadro fiscale e contabile · ${monthLabel}`} />

      <div className="p-4 md:p-6 space-y-6">
        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Mese in corso</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BigCard label="Fatturato generato" value={formatEuro(stats.generato)} sub={`${stats.ordersM} ordini · ${stats.salesM} scontrini`} highlight />
            <BigCard label="Proiezione fine mese" value={formatEuro(stats.proiezione)} sub={`giorno ${dayOfMonth}/${totalDaysInMonth} — stima lineare`} />
            <BigCard label="Margine progressivo" value={formatEuro(stats.marginGenerato)} sub={`proiezione: ${formatEuro(stats.proiezioneMargine)}`} />
            <BigCard label="Fatt. stimato in attesa" value={formatEuro(stats.stimato)} sub="ordini in attesa nel mese" />
            <BigCard label="Mese precedente" value={formatEuro(stats.generatoLM)} sub="riferimento" />
            <BigCard label="Clienti totali" value={clients.length.toString()} sub={`${clients.filter(c=>c.segment==='top').length} top fidelizzati`} />
          </div>
        </section>

        {sottoCosto.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
            <strong>Alert margini:</strong> {sottoCosto.length} prodotto/i con margine negativo: {sottoCosto.map(p => p.name).join(", ")}.
          </div>
        )}

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Top prodotti del mese</h2>
          <div className="bg-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-green text-brand-cream text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Prodotto</th>
                  <th className="text-right p-3">Quantità</th>
                  <th className="text-right p-3">Fatturato</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.length === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nessuna vendita registrata nel mese.</td></tr>
                )}
                {stats.topProducts.map((row) => (
                  <tr key={row.product!.id} className="border-t border-border">
                    <td className="p-3">{row.product!.name}</td>
                    <td className="text-right p-3 font-mono">{row.qty.toFixed(row.product!.unit === "kg" ? 1 : 0)} {row.product!.unit}</td>
                    <td className="text-right p-3 font-semibold text-brand-green">{formatEuro(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground italic">
          Proiezione lineare: <code>(fatturato_progressivo / giorni_trascorsi) × giorni_totali_mese</code>.
          Non sostituisce un commercialista. Esportazione fiscale non inclusa in questa fase.
        </p>
      </div>
    </div>
  );
}

function BigCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-3xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${highlight ? "text-brand-cream/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}
