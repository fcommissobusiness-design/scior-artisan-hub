import { useEffect, useState } from "react";
import {
  SEED_PRODUCTS, SEED_CLIENTS, SEED_ORDERS, SEED_BUNDLES,
  type Product, type Client, type Order, type Bundle,
} from "./data";

const KEY = "sciorio-hq-v1";
const PIN_KEY = "sciorio-hq-auth";

interface Store {
  products: Product[];
  clients: Client[];
  orders: Order[];
  bundles: Bundle[];
}

function load(): Store {
  if (typeof window === "undefined") {
    return { products: SEED_PRODUCTS, clients: SEED_CLIENTS, orders: SEED_ORDERS, bundles: SEED_BUNDLES };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const initial = { products: SEED_PRODUCTS, clients: SEED_CLIENTS, orders: SEED_ORDERS, bundles: SEED_BUNDLES };
  localStorage.setItem(KEY, JSON.stringify(initial));
  return initial;
}

const listeners = new Set<() => void>();
let cache: Store | null = null;

function getStore(): Store {
  if (!cache) cache = load();
  return cache;
}

function setStore(next: Store) {
  cache = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const store = getStore();
  return {
    ...store,
    updateProduct: (id: string, patch: Partial<Product>) =>
      setStore({ ...store, products: store.products.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    addOrder: (o: Order) => setStore({ ...store, orders: [o, ...store.orders] }),
    updateOrder: (id: string, patch: Partial<Order>) =>
      setStore({ ...store, orders: store.orders.map((o) => o.id === id ? { ...o, ...patch } : o) }),
    updateBundle: (id: string, patch: Partial<Bundle>) =>
      setStore({ ...store, bundles: store.bundles.map((b) => b.id === id ? { ...b, ...patch } : b) }),
    updateClient: (id: string, patch: Partial<Client>) =>
      setStore({ ...store, clients: store.clients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    reset: () => { if (typeof window !== "undefined") localStorage.removeItem(KEY); cache = null; setStore(load()); },
  };
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PIN_KEY) === "1";
  });
  return {
    authed,
    login: (pin: string) => {
      if (pin === "1947") {
        localStorage.setItem(PIN_KEY, "1");
        setAuthed(true);
        return true;
      }
      return false;
    },
    logout: () => { localStorage.removeItem(PIN_KEY); setAuthed(false); },
  };
}
