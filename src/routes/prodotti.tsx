import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field, Fab } from "@/components/AppShell";
import { calcMargin, type Product, type ProductCategory } from "@/lib/data";
import { suggestForProduct } from "@/lib/suggest";

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
  const { products, bundles, clients, updateProduct, addProduct, deleteProduct } = useStore();
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [suggestId, setSuggestId] = useState<string | null>(null);

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
        <div className="mx-4 md:mx-6 mt-4 bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
          <strong>Alert:</strong> {negativi.length} prodotto/i sotto costo: {negativi.map(p => p.name).join(", ")}
        </div>
      )}

      <div className="px-4 md:px-6 pt-3 pb-2 flex gap-2 overflow-x-auto">
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

      <div className="px-4 md:px-6 pb-2">
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostra non attivi
        </label>
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {[...grouped.entries()].map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-display text-lg text-brand-green mb-2">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map(p => {
                const margin = calcMargin(p);
                return (
                  <div key={p.id} className={`bg-card rounded-xl p-3 shadow-sm ${!p.active ? "opacity-60" : ""}`}>
                    <div className="flex justify-between items-start gap-3">
                      <button onClick={() => setEditId(p.id)} className="flex-1 min-w-0 text-left">
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
                      </button>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => updateProduct(p.id, { active: !p.active })}
                          className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${p.active ? "bg-success" : "bg-muted-foreground/30"}`}
                        >
                          <div className={`w-6 h-6 rounded-full bg-white transition-transform ${p.active ? "translate-x-5" : ""}`} />
                        </button>
                        <button onClick={() => setSuggestId(p.id)} className="text-[10px] bg-brand-green text-brand-cream rounded-full px-2 py-1 font-semibold whitespace-nowrap">Consiglio AI</button>
                      </div>
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
          <ProductSheet
            mode="edit" product={p} onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduct(p.id, patch); setEditId(null); }}
            onDelete={() => { if (confirm(`Eliminare ${p.name}?`)) { deleteProduct(p.id); setEditId(null); } }}
          />
        );
      })()}

      {suggestId && (() => {
        const p = products.find(x => x.id === suggestId);
        if (!p) return null;
        const sug = suggestForProduct(p, bundles, clients);
        return (
          <Sheet open={true} onClose={() => setSuggestId(null)} title={`Consiglio AI · ${p.name}`}>
            <SuggestBlock label="Quando proporlo" content={sug.quando} />
            <SuggestBlock label="A chi proporlo" content={sug.target.join(" · ")} />
            <SuggestBlock label="Bundle suggeriti" content={sug.bundle.join(" · ")} />
            <SuggestBlock label="Offerta consigliata" content={sug.offerta} />
            <p className="text-[11px] text-muted-foreground italic">Suggerimento generato automaticamente in base a categoria, prodotti e segmenti clienti.</p>
          </Sheet>
        );
      })()}
    </div>
  );
}

function SuggestBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[11px] uppercase text-brand-gold font-bold tracking-wide">{label}</p>
      <p className="text-sm mt-1 text-brand-green">{content}</p>
    </div>
  );
}

function ProductSheet({ mode, product, onClose, onSave, onDelete }: {
  mode: "new" | "edit";
  product?: Product;
  onClose: () => void;
  onSave: (p: any) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "Freschi di Bufala");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [cost, setCost] = useState<string>(product?.cost?.toString() ?? "");
  const [price, setPrice] = useState<string>(product?.price?.toString() ?? "");
  const [unit, setUnit] = useState<"kg" | "pz">(product?.unit ?? "kg");
  const [active, setActive] = useState<boolean>(product?.active ?? true);
  const [notes, setNotes] = useState(product?.notes ?? "");

  const c = cost === "" ? null : parseFloat(cost);
  const pr = parseFloat(price) || 0;
  const margin = c !== null && pr > 0 ? ((pr - c) / pr) * 100 : null;

  const save = () => {
    if (!name.trim() || pr <= 0) return;
    onSave({
      name: name.trim(), category,
      cost: c, price: pr, unit, active,
      badge: badge ? (badge as any) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Sheet
      open={true} onClose={onClose}
      title={mode === "new" ? "Nuovo Prodotto" : "Modifica Prodotto"}
      footer={
        <div className="flex gap-3 items-center">
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Margine: </span>
            <span className={`font-bold ${margin === null ? "text-muted-foreground" : margin < 0 ? "text-danger" : margin < 15 ? "text-danger" : margin < 30 ? "text-warning" : "text-success"}`}>
              {margin === null ? "n/d" : margin.toFixed(1) + "%"}
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
      <Field label="Attivo">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Visibile e proponibile
        </label>
      </Field>
      <Field label="Note">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
      </Field>
    </Sheet>
  );
}
