import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, formatTime } from "@/components/AppShell";
import { calcMargin } from "@/lib/data";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { orders, products, clients, updateOrder } = useStore();
  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.pickupDate).toDateString() === today);
  const pending = todayOrders.filter((o) => o.status === "in_attesa");
  const ritirati = todayOrders.filter((o) => o.status === "ritirato");

  const kgMozza = todayOrders
    .filter((o) => o.status !== "annullato")
    .reduce((sum, o) => sum + o.items.filter((i) => i.productId.startsWith("mozzarella")).reduce((s, i) => s + i.qty, 0), 0);

  const fatturato = todayOrders
    .filter((o) => o.status !== "annullato")
    .reduce((s, o) => s + o.total, 0);

  const sottoCosto = products.filter((p) => {
    const m = calcMargin(p);
    return m !== null && m < 0;
  });

  const clientById = (id: string) => clients.find((c) => c.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);

  return (
    <div>
      <TopBar title="Sciorio HQ" subtitle="Caseificio Sciorio dal 1947" />
      <div className="p-4 space-y-4">
        {sottoCosto.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
            <strong>Attenzione:</strong> {sottoCosto.length} prodotto/i con margine negativo. <Link to="/prodotti" className="underline">Verifica</Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Ordini Oggi" value={todayOrders.length.toString()} sub={`${pending.length} in attesa · ${ritirati.length} ritirati`} />
          <Kpi label="Kg Mozzarella" value={kgMozza.toFixed(1)} sub="prenotati oggi" />
          <Kpi label="Fatturato Stimato" value={formatEuro(fatturato)} sub="oggi" />
          <Kpi label="Sotto Costo" value={sottoCosto.length.toString()} sub="prodotti in alert" danger={sottoCosto.length > 0} />
        </div>

        <section>
          <h2 className="font-display text-xl mb-3 text-brand-green">Ordini di oggi</h2>
          {pending.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center text-sm text-muted-foreground">Nessun ordine in attesa.</div>
          )}
          <div className="space-y-3">
            {pending.map((o) => {
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
                    Ritirato
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : "text-brand-green"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
