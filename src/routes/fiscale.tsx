import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { TopBar, Sheet, Fab, Field, formatEuro } from "@/components/AppShell";
import { OrderSheet } from "@/routes/ordini";
import { NewSaleSheet } from "@/routes/index";
import { PaySheet } from "@/routes/pagamenti";
import type { SupplierPayment } from "@/lib/data";

export const Route = createFileRoute("/fiscale")({ component: FiscalePage });

// ============ Configurazione fiscale (persistita su localStorage) ============

type FormaGiuridica = "ditta_individuale" | "snc" | "srl" | "srls" | "altro";
type RegimeFiscale = "forfettario" | "semplificato" | "ordinario";

type FiscalConfig = {
  formaGiuridica: FormaGiuridica;
  regime: RegimeFiscale;
  partitaIva: string;
  ragioneSociale: string;
  coeffRedditivita: number; // 0-100, usato solo per forfettario (es. 40)
  aliqForfettario: number;  // 5 o 15
  aliqContributi: number;   // % stimata contributi (es. 25)
};

const FISCAL_KEY = "sciorio.fiscalConfig.v1";

const DEFAULT_CONFIG: FiscalConfig = {
  formaGiuridica: "ditta_individuale",
  regime: "forfettario",
  partitaIva: "",
  ragioneSociale: "",
  coeffRedditivita: 40,
  aliqForfettario: 15,
  aliqContributi: 24,
};

function loadConfig(): FiscalConfig | null {
  try {
    const raw = localStorage.getItem(FISCAL_KEY);
    if (!raw) return null;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as FiscalConfig;
  } catch { return null; }
}

function saveConfig(c: FiscalConfig) {
  localStorage.setItem(FISCAL_KEY, JSON.stringify(c));
}

// ============ Stima fiscale ============

function stimaFiscale(cfg: FiscalConfig, ricavi: number, costi: number) {
  let imponibile: number;
  let aliquotaIrpef: number;

  if (cfg.regime === "forfettario") {
    imponibile = ricavi * (cfg.coeffRedditivita / 100);
    aliquotaIrpef = cfg.aliqForfettario / 100;
  } else {
    imponibile = Math.max(0, ricavi - costi);
    // stima IRPEF media semplificata per regime ordinario/semplificato
    aliquotaIrpef = cfg.formaGiuridica === "srl" || cfg.formaGiuridica === "srls" ? 0.24 : 0.27;
  }

  const tasse = Math.max(0, imponibile * aliquotaIrpef);
  const contributi = Math.max(0, imponibile * (cfg.aliqContributi / 100));
  return { imponibile, tasse, contributi, totale: tasse + contributi };
}

// ============ Helpers periodo ============

function inMonthYear(iso: string, ym: string) {
  return iso.slice(0, 7) === ym;
}
function inYear(iso: string, y: string) {
  return iso.slice(0, 4) === y;
}



// ============================================================

function FiscalePage() {
  const { orders, casualSales, supplierPayments, suppliers, products, addOrder, addCasualSale, addClient, addSupplierPayment } = useStore();

  const [config, setConfig] = useState<FiscalConfig | null>(() => loadConfig());
  const [openConfig, setOpenConfig] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [openSale, setOpenSale] = useState(false);
  const [openPay, setOpenPay] = useState(false);

  // periodo
  const now = new Date();
  const [mode, setMode] = useState<"month" | "year">("month");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(() => now.toISOString().slice(0, 7));

  const matches = (iso: string) => mode === "month" ? inMonthYear(iso, month) : inYear(iso, year);

  const data = useMemo(() => {
    const ord = orders.filter(o => o.status === "ritirato" && matches(o.pickupDate));
    const sal = casualSales.filter(s => matches(s.date));
    const pay = supplierPayments.filter(p => p.status === "pagato" && matches(p.date));

    const ricavi = ord.reduce((s, o) => s + o.total, 0) + sal.reduce((s, x) => s + x.total, 0);
    const costi = pay.reduce((s, p) => s + p.amount, 0);

    // margini reali dagli ordini/scontrini (lordo materie prime)
    const margFromItems = (items: { productId: string; qty: number }[]) =>
      items.reduce((sum, i) => {
        const p = products.find(x => x.id === i.productId);
        if (!p || p.cost == null) return sum;
        return sum + (p.price - p.cost) * i.qty;
      }, 0);
    const margineLordo = ord.reduce((s, o) => s + margFromItems(o.items), 0)
                       + sal.reduce((s, x) => s + margFromItems(x.items), 0);

    const utile = margineLordo - costi;

    return { ricavi, costi, utile, margineLordo, ordersCount: ord.length, salesCount: sal.length, paymentsCount: pay.length };
  }, [orders, casualSales, supplierPayments, products, mode, month, year]);

  const stima = useMemo(() => config ? stimaFiscale(config, data.ricavi, data.costi) : null, [config, data]);

  // primo accesso → pagina vuota con +
  if (!config) {
    return (
      <div>
        <TopBar title="Fiscalità" />
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Configura la fiscalità per ricevere stime automatiche su tasse, contributi e utile a partire dai dati del gestionale.
          </p>
          <button onClick={() => setOpenConfig(true)}
            className="w-16 h-16 rounded-full bg-brand-gold text-white text-3xl shadow-lg flex items-center justify-center font-light hover:scale-105 active:scale-95 transition-transform">
            +
          </button>
          <p className="text-xs text-muted-foreground mt-4">Configura fiscalità</p>
        </div>
        {openConfig && (
          <ConfigSheet initial={DEFAULT_CONFIG} onClose={() => setOpenConfig(false)}
            onSave={(c) => { saveConfig(c); setConfig(c); setOpenConfig(false); }} />
        )}
      </div>
    );
  }

  const years: string[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(String(y));

  return (
    <div>
      <TopBar title="Fiscalità" right={
        <button onClick={() => setOpenConfig(true)} className="text-xs bg-brand-cream/10 text-brand-cream rounded-lg px-3 py-1.5">
          Config
        </button>
      } />

      <div className="p-4 md:p-6 space-y-4">
        <div className="bg-warning/15 border border-warning/40 rounded-xl p-3 text-xs text-warning">
          ⚠ Valori indicativi. Non sostituiscono il commercialista.
        </div>

        {/* Selettore periodo */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-card border border-border rounded-lg overflow-hidden text-xs">
            <button onClick={() => setMode("month")} className={`px-3 py-1.5 ${mode === "month" ? "bg-brand-green text-brand-cream" : ""}`}>Mese</button>
            <button onClick={() => setMode("year")} className={`px-3 py-1.5 ${mode === "year" ? "bg-brand-green text-brand-cream" : ""}`}>Anno</button>
          </div>
          {mode === "month" ? (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs" />
          ) : (
            <select value={year} onChange={e => setYear(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <p className="text-[11px] text-muted-foreground ml-auto">
            {config.ragioneSociale || "—"} · {config.regime} · {config.formaGiuridica}
          </p>
        </div>

        {/* KPI principali */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Fatturato" value={formatEuro(data.ricavi)} />
          <Kpi label="Costi (uscite)" value={formatEuro(data.costi)} danger />
          <Kpi label="Utile stimato" value={formatEuro(data.utile)} highlight />
        </div>

        {/* Stima fiscale */}
        {stima && (
          <section className="bg-card rounded-xl p-4">
            <p className="text-xs uppercase font-bold text-brand-green mb-3">Stima fiscale</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Imponibile" value={formatEuro(stima.imponibile)} />
              <Kpi label="Tasse" value={formatEuro(stima.tasse)} danger />
              <Kpi label="Contributi" value={formatEuro(stima.contributi)} danger />
              <Kpi label="Totale fiscale" value={formatEuro(stima.totale)} highlight />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 italic">
              {config.regime === "forfettario"
                ? `Forfettario: imponibile = fatturato × ${config.coeffRedditivita}% · imposta ${config.aliqForfettario}% · contributi ${config.aliqContributi}%.`
                : `Imponibile = ricavi − costi · IRPEF stimata ${Math.round((stima.tasse / Math.max(1, stima.imponibile)) * 100)}% · contributi ${config.aliqContributi}%.`}
            </p>
          </section>
        )}

        {/* Riepilogo dati operativi */}
        <section className="bg-card rounded-xl p-4">
          <p className="text-xs uppercase font-bold text-brand-green mb-3">Dati del periodo</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Info label="Ordini ritirati" value={String(data.ordersCount)} />
            <Info label="Scontrini" value={String(data.salesCount)} />
            <Info label="Uscite pagate" value={String(data.paymentsCount)} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Dati letti automaticamente da Ordini, Scontrini e Uscite. Ogni nuova registrazione aggiorna la stima fiscale.
          </p>
        </section>
      </div>

      <Fab onClick={() => setPickerOpen(true)} />

      {pickerOpen && !openOrder && !openSale && !openPay && (
        <Sheet open={true} onClose={() => setPickerOpen(false)} title="Nuova registrazione">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button onClick={() => setOpenOrder(true)} className="py-6 rounded-xl bg-brand-green text-brand-cream font-semibold">Nuovo Ordine</button>
            <button onClick={() => setOpenSale(true)} className="py-6 rounded-xl bg-brand-gold text-white font-semibold">Nuovo Scontrino</button>
            <button onClick={() => setOpenPay(true)} className="py-6 rounded-xl bg-danger text-white font-semibold">Nuovo Pagamento</button>
          </div>
        </Sheet>
      )}

      {openOrder && (
        <OrderSheet mode="new"
          onClose={() => { setOpenOrder(false); setPickerOpen(false); }}
          onSave={(payload) => { addOrder(payload); setOpenOrder(false); setPickerOpen(false); }} />
      )}
      {openSale && (
        <NewSaleSheet open={true}
          onClose={() => { setOpenSale(false); setPickerOpen(false); }}
          onSave={(s, newClient) => {
            if (newClient) addClient(newClient);
            addCasualSale(s);
            setOpenSale(false); setPickerOpen(false);
          }} />
      )}
      {openPay && (
        <PaySheet mode="new" suppliers={suppliers}
          onClose={() => { setOpenPay(false); setPickerOpen(false); }}
          onSave={(d) => { addSupplierPayment(d as Omit<SupplierPayment, "id">); setOpenPay(false); setPickerOpen(false); }} />
      )}

      {openConfig && (
        <ConfigSheet initial={config} onClose={() => setOpenConfig(false)}
          onSave={(c) => { saveConfig(c); setConfig(c); setOpenConfig(false); }} />
      )}
    </div>
  );
}

function ConfigSheet({ initial, onClose, onSave }: { initial: FiscalConfig; onClose: () => void; onSave: (c: FiscalConfig) => void }) {
  const [c, setC] = useState<FiscalConfig>(initial);
  useEffect(() => {
    // imposta aliquota di default coerente col regime
    if (c.regime === "forfettario" && c.aliqForfettario === 0) setC(p => ({ ...p, aliqForfettario: 15 }));
  }, [c.regime]);

  const set = <K extends keyof FiscalConfig>(k: K, v: FiscalConfig[K]) => setC(p => ({ ...p, [k]: v }));

  return (
    <Sheet open={true} onClose={onClose} title="Configurazione fiscalità"
      footer={
        <button onClick={() => onSave(c)} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Salva configurazione</button>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Forma giuridica">
          <select value={c.formaGiuridica} onChange={e => set("formaGiuridica", e.target.value as FormaGiuridica)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="ditta_individuale">Ditta individuale</option>
            <option value="snc">SNC</option>
            <option value="srl">SRL</option>
            <option value="srls">SRLS</option>
            <option value="altro">Altro</option>
          </select>
        </Field>
        <Field label="Regime fiscale">
          <select value={c.regime} onChange={e => set("regime", e.target.value as RegimeFiscale)}
            className="w-full bg-card border border-border rounded-lg p-3">
            <option value="forfettario">Forfettario</option>
            <option value="semplificato">Semplificato</option>
            <option value="ordinario">Ordinario</option>
          </select>
        </Field>
        <Field label="Partita IVA">
          <input value={c.partitaIva} onChange={e => set("partitaIva", e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
        <Field label="Ragione sociale">
          <input value={c.ragioneSociale} onChange={e => set("ragioneSociale", e.target.value)}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>

        {c.regime === "forfettario" && (
          <>
            <Field label="Coeff. redditività (%)">
              <input type="number" value={c.coeffRedditivita} onChange={e => set("coeffRedditivita", Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg p-3" />
            </Field>
            <Field label="Aliquota imposta (%)">
              <select value={c.aliqForfettario} onChange={e => set("aliqForfettario", Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg p-3">
                <option value={5}>5% (start-up)</option>
                <option value={15}>15%</option>
              </select>
            </Field>
          </>
        )}

        <Field label="Aliquota contributi stimati (%)">
          <input type="number" value={c.aliqContributi} onChange={e => set("aliqContributi", Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-3" />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Stima orientativa, non sostituisce il commercialista. I valori vengono applicati al fatturato del periodo selezionato.
      </p>
    </Sheet>
  );
}

function Kpi({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-brand-green text-brand-cream" : "bg-card"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${highlight ? "text-brand-gold" : "text-muted-foreground"}`}>{label}</p>
      <p className={`font-display text-xl mt-1 ${danger ? "text-danger" : highlight ? "text-brand-gold" : "text-brand-green"}`}>{value}</p>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = MONTH_LABELS;
