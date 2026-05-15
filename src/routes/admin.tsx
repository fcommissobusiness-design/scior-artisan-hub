import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useStore, getPin, setPin } from "@/lib/store";
import { TopBar, formatEuro, Sheet, Field } from "@/components/AppShell";
import { calcMargin } from "@/lib/data";
import { makeTimeFrame, inFrame } from "@/lib/timeframe";
import {
  exportClients, exportOrders, exportProducts, exportDeliveries,
  exportSuppliers, exportCashEntries, exportProductions, exportStock, exportPayments,
  downloadFullBackup, validateBackup, applyBackup,
  maybeAutoBackup, getAutoBackupInfo, downloadAutoBackup, deleteAutoBackup,
  getStorageStats,
} from "@/lib/backup";

const APP_VERSION = "0.4.0";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const store = useStore();
  const {
    orders, casualSales, products, clients, deliveries, suppliers,
    cashEntries, productions, supplierPayments, importJson, reset, storageInfo,
  } = store;
  const [openPin, setOpenPin] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { maybeAutoBackup(); }, []);
  const autoInfo = useMemo(() => getAutoBackupInfo(), [autoTick]);
  const storageStats = useMemo(() => getStorageStats(), [autoTick, orders, clients, products]);

  const tfMonth = makeTimeFrame("thisMonth");
  const tfLastMonth = makeTimeFrame("lastMonth");
  const now = new Date();
  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const stats = useMemo(() => {
    const ordersM = orders.filter(o => inFrame(o.pickupDate, tfMonth));
    const salesM = casualSales.filter(s => inFrame(s.date, tfMonth));
    const productById = (id: string) => products.find(p => p.id === id);
    const marginFromItems = (items: { productId: string; qty: number }[]) =>
      items.reduce((sum, i) => {
        const p = productById(i.productId);
        if (!p || p.cost == null) return sum;
        return sum + (p.price - p.cost) * i.qty;
      }, 0);

    const generato = ordersM.filter(o => o.status === "ritirato").reduce((s, o) => s + o.total, 0)
                   + salesM.reduce((s, o) => s + o.total, 0);
    const stimato = ordersM.filter(o => o.status === "in_attesa" || o.status === "pronto").reduce((s, o) => s + o.total, 0);
    const marginGenerato = ordersM.filter(o => o.status === "ritirato").reduce((s, o) => s + marginFromItems(o.items), 0)
                         + salesM.reduce((s, o) => s + marginFromItems(o.items), 0);
    const proiezione = dayOfMonth > 0 ? (generato / dayOfMonth) * totalDaysInMonth : 0;
    const proiezioneMargine = dayOfMonth > 0 ? (marginGenerato / dayOfMonth) * totalDaysInMonth : 0;

    const ordersLM = orders.filter(o => inFrame(o.pickupDate, tfLastMonth));
    const salesLM = casualSales.filter(s => inFrame(s.date, tfLastMonth));
    const generatoLM = ordersLM.filter(o => o.status === "ritirato").reduce((s, o) => s + o.total, 0)
                     + salesLM.reduce((s, o) => s + o.total, 0);

    return { generato, stimato, marginGenerato, proiezione, proiezioneMargine, generatoLM,
             ordersM: ordersM.length, salesM: salesM.length };
  }, [orders, casualSales, products, dayOfMonth, totalDaysInMonth]);

  const sottoCosto = products.filter(p => { const m = calcMargin(p); return m !== null && m < 0; });
  const monthLabel = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const info = storageInfo();

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sciorio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup esportato.");
    setTimeout(() => setMsg(null), 2000);
  };

  const onFileChosen = async (file: File) => {
    try {
      const text = await file.text();
      importJson(text);
      setMsg("Backup importato con successo.");
    } catch (e: any) {
      setMsg("Errore import: " + e.message);
    }
    setOpenImport(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div>
      <TopBar title="Amministrazione" subtitle={`Quadro fiscale e contabile · ${monthLabel}`} />

      <div className="p-4 md:p-6 space-y-6">
        {msg && <div className="bg-success/15 text-success rounded-lg p-3 text-sm">{msg}</div>}

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Mese in corso</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BigCard label="Fatturato generato" value={formatEuro(stats.generato)} sub={`${stats.ordersM} ordini · ${stats.salesM} scontrini`} highlight />
            <BigCard label="Proiezione fine mese" value={formatEuro(stats.proiezione)} sub={`giorno ${dayOfMonth}/${totalDaysInMonth}`} />
            <BigCard label="Margine progressivo" value={formatEuro(stats.marginGenerato)} sub={`proiezione: ${formatEuro(stats.proiezioneMargine)}`} />
            <BigCard label="Fatt. stimato in attesa" value={formatEuro(stats.stimato)} sub="ordini in attesa + pronti" />
            <BigCard label="Mese precedente" value={formatEuro(stats.generatoLM)} sub="riferimento" />
            <BigCard label="Clienti totali" value={clients.length.toString()} sub={`${clients.filter(c => c.segment === "top").length} top`} />
          </div>
        </section>

        {sottoCosto.length > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
            <strong>Alert margini:</strong> {sottoCosto.length} prodotto/i sotto costo: {sottoCosto.map(p => p.name).join(", ")}.
          </div>
        )}

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Manutenzione</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionCard title="Cambia PIN" desc="Modifica il codice di accesso a 4 cifre."
              cta="Cambia PIN" onClick={() => setOpenPin(true)} />
            <ActionCard title="Esporta backup JSON" desc="Scarica una copia completa di tutti i dati."
              cta="Esporta" onClick={doExport} />
            <ActionCard title="Importa backup JSON" desc="Sostituisce i dati attuali con quelli del file."
              cta="Importa" onClick={() => setOpenImport(true)} />
            <ActionCard title="Azzera dati" desc="Riporta il gestionale ai dati di esempio. Operazione irreversibile."
              cta="Azzera" danger onClick={() => setOpenReset(true)} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Stato archivio</h2>
          <div className="bg-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Spazio usato" value={`${info.kb} KB`} />
            <Info label="Versione app" value={APP_VERSION} />
            <Info label="Prodotti" value={info.counts.products.toString()} />
            <Info label="Clienti" value={info.counts.clients.toString()} />
            <Info label="Ordini" value={info.counts.orders.toString()} />
            <Info label="Bundle" value={info.counts.bundles.toString()} />
            <Info label="Scontrini" value={info.counts.casualSales.toString()} />
            <Info label="Consegne" value={info.counts.deliveries.toString()} />
          </div>
        </section>

        <p className="text-xs text-muted-foreground italic">
          Proiezione lineare: <code>(fatturato_progressivo / giorni_trascorsi) × giorni_totali_mese</code>.
          Non sostituisce un commercialista.
        </p>
      </div>

      {openPin && <PinChangeSheet onClose={() => setOpenPin(false)} onDone={() => { setOpenPin(false); setMsg("PIN aggiornato."); setTimeout(() => setMsg(null), 2000); }} />}

      {openImport && (
        <Sheet open={true} onClose={() => setOpenImport(false)} title="Importa backup JSON">
          <p className="text-sm">Seleziona un file di backup. Tutti i dati attuali verranno <strong className="text-danger">sostituiti</strong>.</p>
          <input ref={fileRef} type="file" accept=".json,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f); }}
            className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
        </Sheet>
      )}

      {openReset && (
        <Sheet open={true} onClose={() => setOpenReset(false)} title="Azzera dati"
          footer={
            <div className="flex gap-2">
              <button onClick={() => setOpenReset(false)} className="flex-1 bg-card border border-border rounded-xl py-3 font-semibold">Annulla</button>
              <button onClick={() => {
                if (confirm("Sicuro? Tutti i dati verranno cancellati e ripristinati dai dati di esempio.")) {
                  reset(); setOpenReset(false); setMsg("Dati ripristinati."); setTimeout(() => setMsg(null), 2000);
                }
              }}
                className="flex-1 bg-danger text-white rounded-xl py-3 font-semibold">Conferma reset</button>
            </div>
          }>
          <p className="text-sm">Verranno eliminati tutti i dati locali (ordini, clienti, scontrini, consegne, prodotti modificati, bundle modificati) e ripristinati ai dati di esempio.</p>
          <p className="text-sm text-warning font-semibold">Operazione irreversibile. Esporta prima un backup!</p>
        </Sheet>
      )}
    </div>
  );
}

function PinChangeSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    if (oldPin !== getPin()) return setErr("PIN attuale errato");
    if (!/^\d{4}$/.test(newPin)) return setErr("Il nuovo PIN deve essere di 4 cifre");
    if (newPin !== confirm) return setErr("Conferma non corrispondente");
    try { setPin(newPin); onDone(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <Sheet open={true} onClose={onClose} title="Cambia PIN"
      footer={<button onClick={submit} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma nuovo PIN</button>}
    >
      <Field label="PIN attuale">
        <input type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={(e) => setOldPin(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      <Field label="Nuovo PIN (4 cifre)">
        <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      <Field label="Conferma nuovo PIN">
        <input type="password" inputMode="numeric" maxLength={4} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      {err && <p className="text-sm text-danger">{err}</p>}
    </Sheet>
  );
}

function ActionCard({ title, desc, cta, onClick, danger }: { title: string; desc: string; cta: string; onClick: () => void; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-4 flex flex-col">
      <h3 className="font-display text-base text-brand-green">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 flex-1">{desc}</p>
      <button onClick={onClick}
        className={`mt-3 rounded-lg py-2 text-sm font-semibold ${danger ? "bg-danger text-white" : "bg-brand-green text-brand-cream"}`}>{cta}</button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-lg text-brand-green">{value}</p>
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
