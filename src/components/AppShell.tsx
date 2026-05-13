import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/store";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/ordini", label: "Ordini" },
  { to: "/clienti", label: "Clienti" },
  { to: "/prodotti", label: "Prodotti" },
  { to: "/offerte", label: "Offerte" },
] as const;

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

  if (!authed) return <PinScreen onOk={login} />;

  return (
    <div className="min-h-screen bg-brand-cream pb-20 max-w-[480px] mx-auto relative">
      {children}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-brand-green border-t border-brand-green-dark grid grid-cols-5 z-50">
        {NAV.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center justify-center py-3 text-[11px] font-medium tracking-wide ${active ? "text-brand-gold" : "text-brand-cream/70"}`}>
              <span className={`w-1.5 h-1.5 rounded-full mb-1 ${active ? "bg-brand-gold" : "bg-transparent"}`} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="bg-brand-green text-brand-cream px-5 pt-6 pb-5 sticky top-0 z-40">
      <h1 className="font-display text-2xl text-brand-gold">{title}</h1>
      {subtitle && <p className="text-xs opacity-75 mt-0.5">{subtitle}</p>}
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
