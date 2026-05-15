import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, formatDate } from "@/components/AppShell";
import { lowStockProducts, outOfStockProducts } from "@/lib/metrics";

export const Route = createFileRoute("/magazzino")({ component: MagazzinoPage });

function MagazzinoPage() {
  const { products, suppliers, updateProduct } = useStore();
  const [tab, setTab] = useState<"all" | "low" | "out" | "tracked">("tracked");
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const tracked = useMemo(() => products.filter(p => p.stock !== undefined), [products]);
  const low = useMemo(() => lowStockProducts(products), [products]);
  const out = useMemo(() => outOfStockProducts(products), [products]);

  const list = useMemo(() => {
    let base = products;
    if (tab === "tracked") base = tracked;
    if (tab === "low") base = low;
    if (tab === "out") base = out;
    if (q.trim()) base = base.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, tracked, low, out, tab, q]);

  return (
    <div>
      <TopBar title="Magazzino" subtitle={`${tracked.length} tracciati · ${low.length} sotto soglia · ${out.length} esauriti`} />

      <div className="p-4 md:p-6 grid grid-cols-3 gap-3">
        <Kpi label="Tracciati" value={String(tracked.length)} />
        <Kpi label="Sotto soglia" value={String(low.length)} warn={low.length > 0} />
        <Kpi label="Esauriti" value={String(out.length)} danger={out.length > 0} />
      </div>

      <div className="px-4 md:px-6 flex gap-2 pb-2 overflow-x-auto">
        {(["tracked", "low", "out", "all"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {t === "tracked" ? "Tracciati" : t === "low" ? "Sotto soglia" : t === "out" ? "Esauriti" : "Tutti"}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca..."
          className="ml-auto bg-card border border-border rounded-lg px-3 py-1.5 text-sm" />
      </div>

      <div className="p-4 md:p-6 space-y-2">
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessun prodotto.</p>}
        {list.map(p => {
          const sup = suppliers.find(s => s.id === p.supplierId);
          const isLow = p.stock !== undefined && p.stockMin !== undefined && p.stock <= p.stockMin;
          const isOut = p.stock !== undefined && p.stock <= 0;
          return (
            <button key={p.id} onClick={() => setEditId(p.id)}
              className="w-full text-left bg-card rounded-xl p-3 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="font-display text-base text-brand-green truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {sup ? `${sup.name} · ` : ""}{p.lastRestock ? `ultimo carico ${formatDate(p.lastRestock)}` : "nessun carico"}
                </p>
              </div>
              <div className="text-right shrink-0">
                {p.stock !== undefined ? (
                  <p className={`font-display text-xl ${isOut ? "text-danger" : isLow ? "text-warning" : "text-brand-green"}`}>
                    {p.stock} <span className="text-xs">{p.unit}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">non tracciato</p>
                )}
                {p.stockMin !== undefined && <p className="text-[10px] text-muted-foreground">min {p.stockMin}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {editId && (() => {
        const p = products.find(x => x.id === editId);
        if (!p) return null;
        return <StockSheet productId={p.id} onClose={() => setEditId(null)}
          onSave={(patch) => { updateProduct(p.id, patch); setEditId(null); }} />;
      })()}
    </div>
  );
}

function Kpi({ label, value, warn, danger }: { label: string; value: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl mt-1 ${danger ? "text-danger" : warn ? "text-warning" : "text-brand-green"}`}>{value}</p>
    </div>
  );
}

function StockSheet({ productId, onClose, onSave }: {
  productId: string; onClose: () => void;
  onSave: (patch: Partial<{ stock: number; stockMin: number; supplierId?: string; lastRestock?: string }>) => void;
}) {
  const { products, suppliers } = useStore();
  const p = products.find(x => x.id === productId)!;
  const [stock, setStock] = useState<string>(p.stock?.toString() ?? "");
  const [stockMin, setStockMin] = useState<string>(p.stockMin?.toString() ?? "");
  const [supplierId, setSupplierId] = useState(p.supplierId ?? "");
  const [restock, setRestock] = useState(false);

  const save = () => {
    onSave({
      stock: stock === "" ? undefined : Number(stock),
      stockMin: stockMin === "" ? undefined : Number(stockMin),
      supplierId: supplierId || undefined,
      lastRestock: restock ? new Date().toISOString() : p.lastRestock,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={p.name}
      footer={
        <button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Giacenza (${p.unit})`}>
          <input type="number" step="0.1" value={stock} onChange={e => setStock(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Soglia minima">
          <input type="number" step="0.1" value={stockMin} onChange={e => setStockMin(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Fornitore">
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="">— Nessuno —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} />
        Segna come carico oggi
      </label>
      {p.lastRestock && (
        <p className="text-xs text-muted-foreground">Ultimo carico: {formatDate(p.lastRestock)}</p>
      )}
    </Sheet>
  );
}
