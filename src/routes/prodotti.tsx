import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field, Fab, formatDate } from "@/components/AppShell";
import { calcMargin, type Product, type ProductCategory } from "@/lib/data";
import { productSalesStats, marginColor } from "@/lib/metrics";

interface Search { f?: string }

export const Route = createFileRoute("/prodotti")({
  component: ProdottiPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ f: typeof s.f === "string" ? s.f : undefined }),
});

const CATEGORIES: ProductCategory[] = [
  "Freschi di Bufala", "Freschi di Pecora", "Formaggi Stagionati",
  "Salumi", "Dispensa", "Pane", "Latte", "Bevande", "Vini",
];

const BADGE_COLORS: Record<string, string> = {
  DOP: "bg-brand-gold text-white",
  IGP: "bg-warning text-white",
  DOC: "bg-brand-green text-brand-cream",
  DOCG: "bg-brand-green-dark text-brand-cream",
  BIO: "bg-success text-white",
};

function ProdottiPage() {
  const search = useSearch({ from: "/prodotti" }) as Search;
  const { products, orders, casualSales, updateProduct, addProduct, deleteProduct } = useStore();
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "sottocosto" | "stagionali" | "magnete" | "non_disponibili">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => { if (search.f === "sottocosto") setView("sottocosto"); }, [search.f]);

  const stats = useMemo(() => productSalesStats(orders, casualSales, products), [orders, casualSales, products]);
  const statsById = useMemo(() => new Map(stats.map(s => [s.product.id, s])), [stats]);

  const negativi = products.filter(p => { const m = calcMargin(p); return m !== null && m < 0; });

  const grouped = useMemo(() => {
    const list = products.filter(p => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!showInactive && !p.active) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (view === "sottocosto") { const m = calcMargin(p); return m !== null && m < 0; }
      if (view === "stagionali") return p.seasonal;
      if (view === "magnete") return p.magnet;
      if (view === "non_disponibili") return p.available === false;
      return true;
    });
    const map = new Map<ProductCategory, Product[]>();
    for (const cat of CATEGORIES) {
      const items = list.filter(p => p.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [products, filter, showInactive, q, view]);

  const topVendite = [...stats].sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topProfitti = [...stats].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const lentiZero = products.filter(p => p.active && !statsById.has(p.id)).slice(0, 8);

  return (
    <div>
      <TopBar title="Prodotti" subtitle={`${products.length} totali · ${products.filter(p => p.active).length} attivi`} />

      {negativi.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          <strong>Alert:</strong> {negativi.length} prodotto/i sotto costo: {negativi.map(p => p.name).join(", ")}
        </div>
      )}

      <div className="px-4 md:px-6 pt-3 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto..."
          className="w-full bg-card border border-border rounded-lg p-2.5 text-sm" />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
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
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all" as const, label: "Tutti" },
            { id: "sottocosto" as const, label: "Sotto costo" },
            { id: "stagionali" as const, label: "Stagionali" },
            { id: "magnete" as const, label: "Magnete" },
            { id: "non_disponibili" as const, label: "Esauriti" },
          ].map(b => (
            <button key={b.id} onClick={() => setView(b.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${view === b.id ? "bg-brand-gold text-white" : "bg-card text-foreground/70"}`}>
              {b.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-xs whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Inattivi
          </label>
        </div>
      </div>

      {view === "all" && filter === "all" && !q && (
        <div className="px-4 md:px-6 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <RankCard title="Più venduti" items={topVendite.map(s => ({ name: s.product.name, value: `${s.qty.toFixed(s.product.unit === "kg" ? 1 : 0)} ${s.product.unit}` }))} />
          <RankCard title="Più profittevoli" items={topProfitti.map(s => ({ name: s.product.name, value: formatEuro(s.profit) }))} />
          <RankCard title="Mai venduti" items={lentiZero.map(p => ({ name: p.name, value: "—" }))} />
        </div>
      )}

      <div className="p-4 md:p-6 space-y-5">
        {[...grouped.entries()].map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-display text-lg text-brand-green mb-2">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map(p => {
                const margin = calcMargin(p);
                const eur = p.cost == null ? null : p.price - p.cost;
                const stat = statsById.get(p.id);
                return (
                  <div key={p.id} className={`bg-card rounded-xl p-3 shadow-sm ${!p.active ? "opacity-60" : ""}`}>
                    <button onClick={() => setEditId(p.id)} className="w-full text-left">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm leading-tight text-brand-green flex-1">{p.name}</p>
                        {p.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${BADGE_COLORS[p.badge] ?? "bg-brand-gold text-white"}`}>{p.badge}</span>}
                        {p.seasonal && <span className="text-[9px] bg-warning/15 text-warning px-1.5 py-0.5 rounded font-bold">STAG.</span>}
                        {p.magnet && <span className="text-[9px] bg-brand-gold/15 text-brand-gold px-1.5 py-0.5 rounded font-bold">MAGNETE</span>}
                        {p.available === false && <span className="text-[9px] bg-danger/15 text-danger px-1.5 py-0.5 rounded font-bold">ESAURITO</span>}
                      </div>
                      <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Costo: {p.cost == null ? "n.d." : formatEuro(p.cost) + "/" + p.unit}</span>
                        <span className="text-foreground font-semibold">{formatEuro(p.price)}/{p.unit}</span>
                      </div>
                      <p className={`text-xs font-bold mt-0.5 ${marginColor(margin)}`}>
                        Margine: {margin === null ? "n/d" : `${margin.toFixed(1)}% · ${formatEuro(eur ?? 0)}`}
                        {margin !== null && margin < 0 && " — sotto costo"}
                      </p>
                      {stat && <p className="text-[11px] text-muted-foreground mt-0.5">Venduto: {stat.qty.toFixed(p.unit === "kg" ? 1 : 0)} {p.unit} · {formatEuro(stat.revenue)}</p>}
                    </button>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => updateProduct(p.id, { active: !p.active })}
                        className={`flex-1 text-[10px] rounded-lg py-1 font-semibold ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {p.active ? "Attivo" : "Non attivo"}
                      </button>
                      <button onClick={() => updateProduct(p.id, { available: !(p.available !== false) })}
                        className={`flex-1 text-[10px] rounded-lg py-1 font-semibold ${p.available !== false ? "bg-brand-green text-brand-cream" : "bg-danger/15 text-danger"}`}>
                        {p.available !== false ? "Disponibile" : "Esaurito"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Fab onClick={() => setOpenNew(true)} />

      {openNew && (
        <ProductSheet mode="new" onClose={() => setOpenNew(false)}
          onSave={(p) => { addProduct(p); setOpenNew(false); }} />
      )}
      {editId && (() => {
        const p = products.find(x => x.id === editId);
        if (!p) return null;
        return (
          <ProductSheet mode="edit" product={p} onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduct(p.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${p.name}?`)) { deleteProduct(p.id); setEditId(null); } }} />
        );
      })()}
    </div>
  );
}

function RankCard({ title, items }: { title: string; items: { name: string; value: string }[] }) {
  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="font-display text-base text-brand-green mb-2">{title}</h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
      <ul className="text-xs space-y-1">
        {items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-2">
            <span className="truncate flex-1">{idx + 1}. {i.name}</span>
            <span className="font-semibold text-brand-green">{i.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductSheet({ mode, product, onClose, onSave, onDelete }: {
  mode: "new" | "edit"; product?: Product;
  onClose: () => void; onSave: (p: any) => void; onDelete?: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "Freschi di Bufala");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [cost, setCost] = useState<string>(product?.cost?.toString() ?? "");
  const [price, setPrice] = useState<string>(product?.price?.toString() ?? "");
  const [unit, setUnit] = useState<"kg" | "pz">(product?.unit ?? "kg");
  const [active, setActive] = useState<boolean>(product?.active ?? true);
  const [available, setAvailable] = useState<boolean>(product?.available !== false);
  const [seasonal, setSeasonal] = useState<boolean>(product?.seasonal ?? false);
  const [magnet, setMagnet] = useState<boolean>(product?.magnet ?? false);
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [stock, setStock] = useState<string>(product?.stock?.toString() ?? "");
  const [stockMin, setStockMin] = useState<string>(product?.stockMin?.toString() ?? "");
  const [supplierId, setSupplierId] = useState<string>(product?.supplierId ?? "");
  const [fresh, setFresh] = useState<boolean>(product?.fresh ?? false);
  const [shelfLifeDays, setShelfLifeDays] = useState<string>(product?.shelfLifeDays?.toString() ?? "");
  const [perishability, setPerishability] = useState<"bassa" | "media" | "alta">(product?.perishability ?? "media");
  const [trackUnsold, setTrackUnsold] = useState<boolean>(product?.trackUnsold ?? false);
  const { suppliers } = useStore();

  const c = cost === "" ? null : parseFloat(cost);
  const pr = parseFloat(price) || 0;
  const margin = c !== null && pr > 0 ? ((pr - c) / pr) * 100 : null;
  const marginEur = c !== null && pr > 0 ? pr - c : null;

  const save = () => {
    if (!name.trim() || pr <= 0) return;
    onSave({
      name: name.trim(), category, cost: c, price: pr, unit, active,
      available, seasonal, magnet,
      badge: badge ? (badge as any) : undefined,
      notes: notes.trim() || undefined,
      stock: stock === "" ? undefined : parseFloat(stock),
      stockMin: stockMin === "" ? undefined : parseFloat(stockMin),
      supplierId: supplierId || undefined,
      fresh, trackUnsold,
      shelfLifeDays: shelfLifeDays === "" ? undefined : parseFloat(shelfLifeDays),
      perishability: fresh ? perishability : undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Prodotto" : product?.name ?? "Prodotto"}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Margine: </span>
            <span className={`font-bold ${marginColor(margin)}`}>
              {margin === null ? "n/d" : `${margin.toFixed(1)}% · ${formatEuro(marginEur ?? 0)}`}
            </span>
          </div>
          {mode === "edit" && onDelete && (
            <button onClick={onDelete} className="text-danger border border-danger/40 rounded-xl px-3 py-3 text-sm font-semibold">Elimina</button>
          )}
          <button onClick={save} disabled={!name.trim() || pr <= 0}
            className="bg-brand-gold text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
            Conferma
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="w-full bg-card border border-border rounded-lg p-3">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Certificazione">
          <select value={badge} onChange={(e) => setBadge(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuna —</option>
            <option value="DOP">DOP</option>
            <option value="IGP">IGP</option>
            <option value="DOC">DOC</option>
            <option value="DOCG">DOCG</option>
            <option value="BIO">BIO</option>
          </select>
        </Field>
        <Field label="Unità">
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="w-full bg-card border border-border rounded-lg p-3">
            <option value="kg">kg</option>
            <option value="pz">pz</option>
          </select>
        </Field>
        <Field label="Costo (€)">
          <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Prezzo finale (€)">
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Toggle label="Attivo" value={active} onChange={setActive} />
        <Toggle label="Disponibile" value={available} onChange={setAvailable} />
        <Toggle label="Stagionale" value={seasonal} onChange={setSeasonal} />
        <Toggle label="Magnete" value={magnet} onChange={setMagnet} />
        <Toggle label="Fresco" value={fresh} onChange={setFresh} />
        <Toggle label="Tracc. invenduto" value={trackUnsold} onChange={setTrackUnsold} />
      </div>

      {fresh && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durata stimata (giorni)">
            <input type="number" step="1" value={shelfLifeDays} onChange={(e) => setShelfLifeDays(e.target.value)}
              placeholder="es. 2" className="w-full bg-card border border-border rounded-lg p-3" />
          </Field>
          <Field label="Deperibilità">
            <select value={perishability} onChange={(e) => setPerishability(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg p-3">
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Stock attuale">
          <input type="number" step="0.1" value={stock} onChange={(e) => setStock(e.target.value)}
            placeholder="es. 5" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Soglia minima">
          <input type="number" step="0.1" value={stockMin} onChange={(e) => setStockMin(e.target.value)}
            placeholder="es. 2" className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Fornitore">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="">— Nessuno —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>

      {(product?.priceHistory ?? []).length > 0 && (
        <Field label="Storico variazioni prezzo">
          <ul className="bg-card rounded-lg p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
            {(product?.priceHistory ?? []).slice().reverse().map((h, idx) => (
              <li key={idx} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                <span className="text-muted-foreground">{formatDate(h.date)}</span>
                <span>costo {h.cost == null ? "n.d." : formatEuro(h.cost)} · prezzo {formatEuro(h.price)}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </Sheet>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`rounded-lg p-3 text-xs font-semibold border ${value ? "bg-brand-green text-brand-cream border-brand-green" : "bg-card text-muted-foreground border-border"}`}>
      {label}: {value ? "sì" : "no"}
    </button>
  );
}
