import { useEffect, useState } from "react";
import {
  SEED_PRODUCTS, SEED_CLIENTS, SEED_ORDERS, SEED_BUNDLES, SEED_CASUAL_SALES,
  type Product, type Client, type Order, type Bundle, type CasualSale,
} from "./data";

const KEY = "sciorio-hq-v2";
const PIN_KEY = "sciorio-hq-auth";

interface Store {
  products: Product[];
  clients: Client[];
  orders: Order[];
  bundles: Bundle[];
  casualSales: CasualSale[];
}

const SEED: Store = {
  products: SEED_PRODUCTS,
  clients: SEED_CLIENTS,
  orders: SEED_ORDERS,
  bundles: SEED_BUNDLES,
  casualSales: SEED_CASUAL_SALES,
};

function load(): Store {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...SEED, ...parsed, casualSales: parsed.casualSales ?? SEED_CASUAL_SALES };
    }
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
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

const uid = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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

    // PRODUCTS
    addProduct: (p: Omit<Product, "id">) => {
      const id = uid("p_");
      setStore({ ...store, products: [{ ...p, id }, ...store.products] });
    },
    updateProduct: (id: string, patch: Partial<Product>) =>
      setStore({ ...store, products: store.products.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    deleteProduct: (id: string) =>
      setStore({ ...store, products: store.products.filter((p) => p.id !== id) }),

    // ORDERS
    addOrder: (o: Omit<Order, "id" | "createdAt">) => {
      const order: Order = { ...o, id: uid("o_"), createdAt: new Date().toISOString() };
      setStore({ ...store, orders: [order, ...store.orders] });
      return order;
    },
    updateOrder: (id: string, patch: Partial<Order>) =>
      setStore({ ...store, orders: store.orders.map((o) => o.id === id ? { ...o, ...patch } : o) }),
    deleteOrder: (id: string) =>
      setStore({ ...store, orders: store.orders.filter((o) => o.id !== id) }),

    // BUNDLES
    addBundle: (b: Omit<Bundle, "id">) => {
      setStore({ ...store, bundles: [{ ...b, id: uid("b_") }, ...store.bundles] });
    },
    updateBundle: (id: string, patch: Partial<Bundle>) =>
      setStore({ ...store, bundles: store.bundles.map((b) => b.id === id ? { ...b, ...patch } : b) }),
    deleteBundle: (id: string) =>
      setStore({ ...store, bundles: store.bundles.filter((b) => b.id !== id) }),

    // CLIENTS
    addClient: (c: Omit<Client, "id">) => {
      const client: Client = { ...c, id: uid("c_") };
      setStore({ ...store, clients: [client, ...store.clients] });
      return client;
    },
    updateClient: (id: string, patch: Partial<Client>) =>
      setStore({ ...store, clients: store.clients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    deleteClient: (id: string) =>
      setStore({ ...store, clients: store.clients.filter((c) => c.id !== id) }),

    // CASUAL SALES
    addCasualSale: (s: Omit<CasualSale, "id">) => {
      const sale: CasualSale = { ...s, id: uid("s_") };
      setStore({ ...store, casualSales: [sale, ...store.casualSales] });
      return sale;
    },
    deleteCasualSale: (id: string) =>
      setStore({ ...store, casualSales: store.casualSales.filter((s) => s.id !== id) }),

    reset: () => {
      if (typeof window !== "undefined") localStorage.removeItem(KEY);
      cache = null;
      setStore(load());
    },
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
