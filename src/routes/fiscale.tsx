import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatDate } from "@/components/AppShell";

export const Route = createFileRoute("/fiscale")({ component: FiscalePage });

function FiscalePage() {
  const { orders, casualSales, supplierPayments } = useStore();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const inMonth = (iso: string) => iso.slice(0, 7) === month;

  const data = useMemo(() => {
    const ord = orders.filter(o => o.status === "ritirato" && inMonth(o.pickupDate));
    const sal = casualSales.filter(s => inMonth(s.date));
    const pay = supplierPayments.filter(p => p.status === "pagato" && inMonth(p.date) && p.document === "fattura");

    const revenue = ord.reduce((s, o) => s + o.total, 0) + sal.reduce((s, x) => s + x.total, 0);
    const documented = pay.reduce((s, p) => s + p.amount, 0);

    return {
      ordersCount: ord.length, salesCount: sal.length, revenue,
      paymentsWithDoc: pay.length, documented, payments: pay,
    };
  }, [orders, casualSales, supplierPayments, month]);

  return (
    <div>
      <TopBar title="Riepilogo fiscale" subtitle="Solo riepilogo operativo — non sostituisce contabilità" />

      <div className="p-4 md:p-6 space-y-4">
        <div className="bg-warning/15 border border-warning/40 rounded-xl p-3 text-xs text-warning">
          ⚠ Questo è un riepilogo operativo per orientamento. Non sostituisce la contabilità ufficiale del commercialista.
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs uppercase font-bold text-muted-foreground">Mese</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Ordini ritirati" value={String(data.ordersCount)} />
          <Kpi label="Scontrini" value={String(data.salesCount)} />
          <Kpi label="Ricavi totali" value={formatEuro(data.revenue)} highlight />
          <Kpi label="Spese con fattura" value={formatEuro(data.documented)} />
        </div>

        <section className="bg-card rounded-xl p-4">
          <p className="text-xs uppercase font-bold text-brand-green mb-3">Documenti del mese</p>
          {data.payments.length === 0 && <p className="text-sm text-muted-foreground">Nessun pagamento con fattura registrato.</p>}
          <div className="space-y-1.5">
            {data.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm border-b border-border last:border-0 py-1">
                <div className="min-w-0">
                  <p className="truncate">{p.beneficiary}</p>
                  <p className="text-[11px] text-muted-foreground">{p.category} · {formatDate(p.date)}</p>
                </div>
                <span className="font-semibold shrink-0">{formatEuro(p.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card rounded-xl p-4">
          <p className="text-xs uppercase font-bold text-brand-green mb-3">Promemoria operativi</p>
          <ul className="text-sm space-y-1 text-foreground/80 list-disc pl-4">
            <li>Conserva tutte le fatture passive del mese (anche digitali)</li>
            <li>Verifica corrispondenza scontrini → registratore di cassa</li>
            <li>Inoltra al commercialista entro il 10 del mese successivo</li>
            <li>Controlla scadenze IVA e contributi</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}
