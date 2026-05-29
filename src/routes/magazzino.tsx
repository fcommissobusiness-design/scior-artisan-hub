import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, formatDate } from "@/components/AppShell";

export const Route = createFileRoute("/magazzino")({ component: MagazzinoPage });

interface StockRow {
  productId: string;
  name: string;
  unit: "kg" | "pz";
  stock: number;
  lastRestock?: string;
  expiry?: string;
}

function computeExpiry(lastRestock?: string, shelfLifeDays?: number): string | undefined {
  if (!lastRestock || !shelfLifeDays) return undefined;
  const d = new Date(lastRestock);
  d.setDate(d.getDate() + shelfLifeDays);
  return d.toISOString();
}

function MagazzinoPage() {
  const { products, updateProduct } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState(false);
  const [q, setQ] = useState("");

  const rows: StockRow[] = useMemo(() => {
    return products
      .filter(p => p.stock !== undefined)
      .map(p => ({
        productId: p.id,
        name: p.name,
        unit: p.unit,
        stock: p.stock ?? 0,
        lastRestock: p.lastRestock,
        expiry: (p as any).stockExpiry ?? computeExpiry(p.lastRestock, p.shelfLifeDays),
      }))
      .filter(r => !q.trim() || r.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, q]);

  return (
    <div>
      <TopBar title="Magazzino" subtitle="Inventario corrente" />

      <div className="px-4 md:px-6 pt-4 flex gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <button onClick={() => setOpenSetup(true)}
          className="bg-brand-green text-brand-cream rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap">
          Imposta Magazzino
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-1.5">
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nessun prodotto a magazzino. Usa "Imposta Magazzino" per iniziare.
          </p>
        )}
        {rows.map(r => {
          const expiringSoon = r.expiry && new Date(r.expiry).getTime() - Date.now() < 3 * 86400000;
          return (
            <div key={r.productId} className="bg-card rounded-xl p-3 flex items-center gap-3">
              <Link to="/prodotti" className="flex-1 min-w-0">
                <p className="font-display text-sm text-brand-green truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.lastRestock ? `ingresso ${formatDate(r.lastRestock)}` : "—"}
                  {r.expiry ? ` · scad. ${formatDate(r.expiry)}` : ""}
                </p>
              </Link>
              <div className="text-right shrink-0">
                <p className={`font-display text-lg ${r.stock <= 0 ? "text-danger" : expiringSoon ? "text-warning" : "text-brand-green"}`}>
                  {r.stock} <span className="text-xs">{r.unit}</span>
                </p>
              </div>
              <button onClick={() => setEditId(r.productId)}
                className="text-xs text-brand-green font-semibold px-2">Modifica</button>
            </div>
          );
        })}
      </div>

      {editId && (() => {
        const p = products.find(x => x.id === editId);
        if (!p) return null;
        return (
          <StockEditSheet productId={p.id} onClose={() => setEditId(null)}
            onSave={(patch) => { updateProduct(p.id, patch); setEditId(null); }} />
        );
      })()}

      {openSetup && (
        <StockSetupSheet onClose={() => setOpenSetup(false)} />
      )}
    </div>
  );
}

function StockEditSheet({ productId, onClose, onSave }: {
  productId: string; onClose: () => void;
  onSave: (patch: any) => void;
}) {
  const { products } = useStore();
  const p = products.find(x => x.id === productId)!;
  const [stock, setStock] = useState<string>(p.stock?.toString() ?? "");
  const [lastRestock, setLastRestock] = useState<string>((p.lastRestock ?? new Date().toISOString()).slice(0, 10));
  const initialExp = (p as any).stockExpiry ?? computeExpiry(p.lastRestock, p.shelfLifeDays);
  const [expiry, setExpiry] = useState<string>(initialExp ? initialExp.slice(0, 10) : "");

  const save = () => {
    onSave({
      stock: stock === "" ? undefined : Number(stock),
      lastRestock: lastRestock ? new Date(lastRestock).toISOString() : undefined,
      stockExpiry: expiry ? new Date(expiry).toISOString() : undefined,
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={p.name}
      footer={<button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantità (${p.unit})`}>
          <input type="number" step="0.1" value={stock} onChange={e => setStock(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data ingresso">
          <input type="date" value={lastRestock} onChange={e => setLastRestock(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Scadenza">
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3 col-span-2" />
        </Field>
      </div>
    </Sheet>
  );
}

function StockSetupSheet({ onClose }: { onClose: () => void }) {
  const { products, updateProduct } = useStore();
  const [productId, setProductId] = useState("");
  const [stock, setStock] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiry, setExpiry] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const { suppliers } = useStore();

  const save = () => {
    if (!productId) { alert("Seleziona un prodotto"); return; }
    updateProduct(productId, {
      stock: stock ? Number(stock) : 0,
      stockMin: stockMin ? Number(stockMin) : undefined,
      lastRestock: new Date(entryDate).toISOString(),
      ...(expiry ? { stockExpiry: new Date(expiry).toISOString() } as any : {}),
      ...(supplierId ? { supplierId } : {}),
    });
    // reset per inserimento multiplo
    setProductId(""); setStock(""); setExpiry(""); setStockMin(""); setSupplierId("");
  };

  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  return (
    <Sheet open={true} onClose={onClose} title="Imposta Magazzino"
      footer={
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 bg-brand-green text-brand-cream rounded-xl py-3 font-semibold">Aggiungi al magazzino</button>
          <button onClick={onClose} className="px-4 rounded-xl border border-border text-sm">Chiudi</button>
        </div>
      }>
      <p className="text-xs text-muted-foreground">
        Inserisci la situazione attuale del magazzino. Ripeti per ogni prodotto.
      </p>
      <Field label="Prodotto">
        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="">— scegli —</option>
          {sorted.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantità">
          <input type="number" step="0.1" value={stock} onChange={e => setStock(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Soglia minima">
          <input type="number" step="0.1" value={stockMin} onChange={e => setStockMin(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data ingresso">
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Scadenza">
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <Field label="Fornitore (opzionale)">
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3">
          <option value="">—</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </Sheet>
  );
}
