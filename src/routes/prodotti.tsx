import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro } from "@/components/AppShell";
import { calcMargin, type ProductCategory } from "@/lib/data";

export const Route = createFileRoute("/prodotti")({ component: ProdottiPage });

const CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala", "Freschi di Pecora", "Formaggi Stagionati",
  "Salumi", "Dispensa", "Pane", "Latte", "Bevande", "Vini",
];

function marginColor(m: number | null) {
  if (m === null) return "text-muted-foreground";
  if (m < 0) return "text-danger";
  if (m < 15) return "text-danger";
  if (m < 30) return "text-warning";
  return "text-success";
}

function ProdottiPage() {
  const { products, updateProduct } = useStore();
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(true);

  const negativi = products.filter(p => {
    const m = calcMargin(p);
    return m !== null && m < 0;
  });

  const grouped = useMemo(() => {
    const list = products.filter(p => (filter === "all" || p.category === filter) && (showInactive || p.active));
    const map = new Map<ProductCategory, typeof products>();
    for (const cat of CATEGORIES) {
      const items = list.filter(p => p.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [products, filter, showInactive]);

  return (
    <div>
      <TopBar title="Prodotti" subtitle={`${products.length} totali · ${products.filter(p=>p.active).length} attivi`} />

      {negativi.length > 0 && (
        <div className="mx-4 mt-4 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          <strong>Alert:</strong> {negativi.length} prodotto/i sotto costo: {negativi.map(p => p.name).join(", ")}
        </div>
      )}

      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === "all" ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
          Tutte
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${filter === c ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/70"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="px-4 pb-2">
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostra non attivi
        </label>
      </div>

      <div className="p-4 space-y-5">
        {[...grouped.entries()].map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-display text-lg text-brand-green mb-2">{cat}</h2>
            <div className="space-y-2">
              {items.map(p => {
                const margin = calcMargin(p);
                return (
                  <div key={p.id} className={`bg-card rounded-xl p-3 shadow-sm ${!p.active ? "opacity-60" : ""}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm leading-tight text-brand-green">{p.name}</p>
                          {p.badge && <span className="text-[9px] bg-brand-gold text-white px-1.5 py-0.5 rounded font-bold">{p.badge}</span>}
                        </div>
                        <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                          <span>Costo: {p.cost == null ? "n.d." : formatEuro(p.cost) + "/" + p.unit}</span>
                          <span className="text-foreground font-semibold">{formatEuro(p.price)}/{p.unit}</span>
                        </div>
                        <p className={`text-xs font-bold mt-0.5 ${marginColor(margin)}`}>
                          Margine: {margin === null ? "n/d" : margin.toFixed(1) + "%"}
                          {margin !== null && margin < 0 && " — sotto costo"}
                        </p>
                      </div>
                      <button
                        onClick={() => updateProduct(p.id, { active: !p.active })}
                        className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${p.active ? "bg-success" : "bg-muted-foreground/30"}`}
                      >
                        <div className={`w-6 h-6 rounded-full bg-white transition-transform ${p.active ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
