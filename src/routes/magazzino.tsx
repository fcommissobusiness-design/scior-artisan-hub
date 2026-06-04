import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Field, formatDate } from "@/components/AppShell";

export const Route = createFileRoute("/magazzino")({ component: MagazzinoPage });

const DEFAULT_EXPIRY_HOURS = 72;
function defaultExpiryFrom(entryISO: string): string {
  const d = new Date(entryISO);
  d.setHours(d.getHours() + DEFAULT_EXPIRY_HOURS);
  return d.toISOString();
}

interface StockRow {
  productId: string;
  name: string;
  unit: "kg" | "pz";
  stock: number;
  lastRestock?: string;
  expiry?: string;
  lotCode?: string;
  lotId?: string;
}

function computeExpiry(lastRestock?: string, shelfLifeDays?: number): string | undefined {
  if (!lastRestock || !shelfLifeDays) return undefined;
  const d = new Date(lastRestock);
  d.setDate(d.getDate() + shelfLifeDays);
  return d.toISOString();
}

function MagazzinoPage() {
  const { products, lots, updateProduct, updateLot, deleteLot } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [editLotId, setEditLotId] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ kind: "lot" | "product"; id: string; label: string } | null>(null);
  const [q, setQ] = useState("");

  const rows: StockRow[] = useMemo(() => {
    const out: StockRow[] = [];
    const productsById = new Map(products.map(p => [p.id, p]));
    // Aggrega per (product, lotCode) — stesso lotto = somma quantità
    const byKey = new Map<string, { lots: typeof lots; product: typeof products[number] }>();
    for (const l of lots) {
      if (l.qtyRemaining <= 0) continue;
      const p = productsById.get(l.productId);
      if (!p) continue;
      const key = `${l.productId}::${l.code}`;
      const cur = byKey.get(key);
      if (cur) cur.lots.push(l);
      else byKey.set(key, { lots: [l], product: p });
    }
    for (const { lots: ls, product } of byKey.values()) {
      const sum = ls.reduce((s, l) => s + l.qtyRemaining, 0);
      const earliest = ls.reduce((min, l) => +new Date(l.expiryDate) < +new Date(min.expiryDate) ? l : min, ls[0]);
      out.push({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        stock: +sum.toFixed(3),
        lastRestock: earliest.productionDate,
        expiry: earliest.expiryDate,
        lotCode: earliest.code,
        lotId: ls.length === 1 ? earliest.id : undefined,
      });
    }
    // Prodotti senza lotti ma con stock storico legacy
    const productsWithLots = new Set(lots.filter(l => l.qtyRemaining > 0).map(l => l.productId));
    for (const p of products) {
      if (p.stock === undefined || productsWithLots.has(p.id)) continue;
      out.push({
        productId: p.id,
        name: p.name,
        unit: p.unit,
        stock: p.stock,
        lastRestock: p.lastRestock,
        expiry: (p as any).stockExpiry ?? computeExpiry(p.lastRestock, p.shelfLifeDays),
      });
    }
    return out
      .filter(r => !q.trim() || r.name.toLowerCase().includes(q.toLowerCase()) || (r.lotCode ?? "").toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        if (a.expiry && b.expiry) return +new Date(a.expiry) - +new Date(b.expiry);
        return a.name.localeCompare(b.name);
      });
  }, [products, lots, q]);

  return (
    <div>
      <TopBar title="Magazzino" subtitle="Inventario corrente per lotti" />

      <div className="px-4 md:px-6 pt-4 flex gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca prodotto o lotto..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        <Link to="/prodotti"
          className="bg-card border border-border text-brand-green rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap">
          + Nuovo prodotto
        </Link>
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
        {rows.map((r, idx) => {
          const msToExpiry = r.expiry ? new Date(r.expiry).getTime() - Date.now() : Infinity;
          const expired = msToExpiry < 0;
          const expiringSoon = !expired && msToExpiry < 3 * 86400000;
          return (
            <div key={`${r.productId}-${r.lotCode ?? "legacy"}-${idx}`} className="bg-card rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-brand-green truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.lotCode ? <span className="font-mono">Lotto {r.lotCode} · </span> : null}
                  {r.lastRestock ? `ingresso ${formatDate(r.lastRestock)}` : "—"}
                  {r.expiry ? ` · scad. ${formatDate(r.expiry)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-display text-lg ${r.stock <= 0 || expired ? "text-danger" : expiringSoon ? "text-warning" : "text-brand-green"}`}>
                  {r.stock} <span className="text-xs">{r.unit}</span>
                </p>
                {expired && <p className="text-[10px] text-danger font-semibold">SCADUTO</p>}
                {!expired && expiringSoon && <p className="text-[10px] text-warning font-semibold">in scadenza</p>}
              </div>
              {r.lotId ? (
                <button onClick={() => setEditLotId(r.lotId!)}
                  className="text-xs text-brand-green font-semibold px-2">Modifica</button>
              ) : (
                <button onClick={() => setEditId(r.productId)}
                  className="text-xs text-brand-green font-semibold px-2">Modifica</button>
              )}
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

      {editLotId && (() => {
        const l = lots.find(x => x.id === editLotId);
        if (!l) return null;
        const p = products.find(x => x.id === l.productId);
        return (
          <LotEditSheet lot={l} productName={p?.name ?? "Prodotto"} unit={p?.unit ?? "pz"}
            onClose={() => setEditLotId(null)}
            onSave={(patch) => { updateLot(l.id, patch); setEditLotId(null); }} />
        );
      })()}

      {openSetup && (
        <StockSetupSheet onClose={() => setOpenSetup(false)} />
      )}
    </div>
  );
}

function LotEditSheet({ lot, productName, unit, onClose, onSave }: {
  lot: { id: string; code: string; productionDate: string; expiryDate: string; qtyRemaining: number };
  productName: string;
  unit: "kg" | "pz";
  onClose: () => void;
  onSave: (patch: any) => void;
}) {
  const [qty, setQty] = useState<string>(lot.qtyRemaining.toString());
  const [entry, setEntry] = useState<string>(lot.productionDate.slice(0, 10));
  const [expiry, setExpiry] = useState<string>(lot.expiryDate.slice(0, 10));

  const save = () => {
    onSave({
      qtyRemaining: qty === "" ? 0 : Number(qty),
      productionDate: new Date(entry).toISOString(),
      expiryDate: new Date(expiry).toISOString(),
    });
  };

  return (
    <Sheet open={true} onClose={onClose} title={`${productName} · ${lot.code}`}
      footer={<button onClick={save} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva</button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantità residua (${unit})`}>
          <input type="number" step="0.1" value={qty} onChange={e => setQty(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Data ingresso/produzione">
          <input type="date" value={entry} onChange={e => setEntry(e.target.value)}
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

function StockEditSheet({ productId, onClose, onSave }: {
  productId: string; onClose: () => void;
  onSave: (patch: any) => void;
}) {
  const { products } = useStore();
  const p = products.find(x => x.id === productId)!;
  const [stock, setStock] = useState<string>(p.stock?.toString() ?? "");
  const [lastRestock, setLastRestock] = useState<string>((p.lastRestock ?? new Date().toISOString()).slice(0, 10));
  const initialExp = (p as any).stockExpiry
    ?? computeExpiry(p.lastRestock, p.shelfLifeDays)
    ?? defaultExpiryFrom(p.lastRestock ?? new Date().toISOString());
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
  const [supplierId, setSupplierId] = useState("");
  const { suppliers } = useStore();

  const save = () => {
    if (!productId) { alert("Seleziona un prodotto"); return; }
    const entryISO = new Date(entryDate).toISOString();
    const expiryISO = expiry ? new Date(expiry).toISOString() : defaultExpiryFrom(entryISO);
    updateProduct(productId, {
      stock: stock ? Number(stock) : 0,
      lastRestock: entryISO,
      ...({ stockExpiry: expiryISO } as any),
      ...(supplierId ? { supplierId } : {}),
    });
    // reset per inserimento multiplo
    setProductId(""); setStock(""); setExpiry(""); setSupplierId("");
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
        <Field label="Data ingresso">
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Scadenza (default +72h)">
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
            placeholder="Default: 72h dall'ingresso"
            className="w-full bg-card border border-border rounded-lg p-3 col-span-2" />
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
