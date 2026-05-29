import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/store";

type NavItem = { to: string; label: string; short: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Operativo", items: [
    { to: "/", label: "Dashboard", short: "Home" },
    { to: "/ordini", label: "Ordini", short: "Ordini" },
    { to: "/consegne", label: "Consegne", short: "Conseg." },
    { to: "/clienti", label: "Clienti", short: "Clienti" },
    { to: "/produzione", label: "Produzione", short: "Prod." },
  ]},
  { label: "Magazzino & Qualità", items: [
    { to: "/magazzino", label: "Magazzino", short: "Mag." },
    { to: "/food-safety", label: "Food Safety", short: "Food" },
    { to: "/entrate-merci", label: "Scarico Prodotti", short: "Scarico" },
    { to: "/prodotti", label: "Prodotti", short: "Prod." },
    { to: "/offerte", label: "Offerte", short: "Offerte" },
  ]},
  { label: "Vendite", items: [
    { to: "/ecommerce", label: "E-commerce", short: "Ecom" },
    { to: "/b2b", label: "B2B", short: "B2B" },
  ]},
  { label: "Finanza", items: [
    { to: "/finanza", label: "Finanza", short: "Fin." },
    { to: "/incassi", label: "Cassa & Incassi", short: "Cassa" },
    { to: "/pagamenti", label: "Pagamenti", short: "Pag." },
    { to: "/fornitori", label: "Fornitori", short: "Forn." },
    { to: "/fiscale", label: "Riepilogo fiscale", short: "Fisc." },
    { to: "/report", label: "Report", short: "Report" },
  ]},
  { label: "Sistema", items: [
    { to: "/admin", label: "Amministrazione", short: "Admin" },
  ]},
];

const MOBILE_PRIMARY: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Home" },
  { to: "/ordini", label: "Ordini", short: "Ordini" },
  { to: "/consegne", label: "Consegne", short: "Conseg." },
  { to: "/clienti", label: "Clienti", short: "Clienti" },
  { to: "/food-safety", label: "Food Safety", short: "Food" },
];

function PinScreen({ onOk }: { onOk: (pin: string) => boolean }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const press = (d: string) => {
    setErr(false);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (!onOk(next)) { setErr(true); setTimeout(() => setPin(""), 400); }
    }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-green text-brand-cream px-6">
      <h1 className="font-display text-3xl text-brand-gold mb-1">Sciorio HQ</h1>
      <p className="text-sm opacity-80 mb-10">Caseificio Sciorio dal 1947</p>
      <p className="mb-4 text-sm">Inserisci il PIN</p>
      <div className="flex gap-3 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 border-brand-gold ${pin.length > i ? "bg-brand-gold" : ""} ${err ? "animate-pulse border-danger" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-64">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <button key={d} onClick={() => press(d)} className="h-16 rounded-xl bg-brand-green-dark text-2xl font-display text-brand-cream active:bg-brand-gold/30">{d}</button>
        ))}
        <div />
        <button onClick={() => press("0")} className="h-16 rounded-xl bg-brand-green-dark text-2xl font-display text-brand-cream active:bg-brand-gold/30">0</button>
        <button onClick={() => setPin(pin.slice(0, -1))} className="h-16 rounded-xl text-sm text-brand-cream/70">Annulla</button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { authed, login } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  if (!authed) return <PinScreen onOk={login} />;

  const isActive = (to: string) => to === "/" ? path === "/" : path.startsWith(to);

  return (
    <div className="min-h-screen bg-brand-cream md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 bg-brand-green text-brand-cream sticky top-0 h-screen p-4 z-40 overflow-y-auto">
        <div className="px-2 py-3 mb-4 border-b border-brand-cream/10">
          <h1 className="font-display text-2xl text-brand-gold leading-none">Sciorio HQ</h1>
          <p className="text-[11px] opacity-70 mt-1">Caseificio dal 1947</p>
        </div>
        <nav className="flex flex-col gap-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="text-[10px] uppercase tracking-wider text-brand-cream/50 px-3 mb-1">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = isActive(n.to);
                  return (
                    <Link key={n.to} to={n.to}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? "bg-brand-gold/20 text-brand-gold" : "text-brand-cream/80 hover:bg-brand-cream/5"}`}>
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Contenuto */}
      <main className="flex-1 pb-24 md:pb-8 md:max-w-6xl md:mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-green border-t border-brand-green-dark grid grid-cols-6 z-50 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_PRIMARY.map((n) => {
          const active = isActive(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium tracking-wide transition-colors ${active ? "text-brand-gold" : "text-brand-cream/70 active:text-brand-cream"}`}>
              <span className={`w-1.5 h-1.5 rounded-full mb-1 transition-colors ${active ? "bg-brand-gold" : "bg-transparent"}`} />
              {n.short}
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-2.5 text-[10px] font-medium tracking-wide transition-colors ${moreOpen ? "text-brand-gold" : "text-brand-cream/70 active:text-brand-cream"}`}>
          <span className="w-1.5 h-1.5 rounded-full mb-1 bg-transparent" />
          Più
        </button>
      </nav>

      {/* Più sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="bg-brand-cream w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="font-display text-lg text-brand-green mb-3">Tutte le sezioni</p>
            <div className="space-y-3">
              {NAV_GROUPS.map(g => (
                <div key={g.label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map(n => {
                      const active = isActive(n.to);
                      return (
                        <Link key={n.to} to={n.to} onClick={() => setMoreOpen(false)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium ${active ? "bg-brand-green text-brand-cream" : "bg-card text-foreground/80"}`}>
                          {n.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="bg-brand-green text-brand-cream px-5 md:px-8 pt-6 pb-5 md:rounded-b-2xl md:mt-4 md:mx-4 sticky md:static top-0 z-40 flex items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-brand-gold">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm opacity-75 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

export function formatEuro(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

/* Sheet/modal responsive: bottom-sheet su mobile, dialog centrato su desktop, footer sticky. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-brand-cream w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-brand-green text-brand-cream px-5 py-4 flex justify-between items-center shrink-0">
          <h2 className="font-display text-xl text-brand-gold">{title}</h2>
          <button onClick={onClose} className="text-brand-cream text-2xl leading-none px-2">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-brand-cream px-4 md:px-6 py-3 md:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Fab({ onClick, label = "+" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      className="fixed md:!bottom-8 right-4 md:right-8 w-14 h-14 rounded-full bg-brand-gold text-white text-3xl shadow-lg z-40 flex items-center justify-center font-light hover:scale-105 active:scale-95 transition-transform">
      {label}
    </button>
  );
}
