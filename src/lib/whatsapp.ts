// Centro WhatsApp: normalizzazione numeri + template messaggi + apertura chat
import type { Order, Client, Bundle, Delivery, Product, CasualSale } from "./data";

export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  // se inizia per +, mantieni
  if (digits.startsWith("+")) return digits.slice(1).replace(/\D/g, "");
  // se inizia per 00, sostituisci
  if (digits.startsWith("00")) return digits.slice(2);
  // se inizia per 3 (numero IT mobile), prepend 39
  if (/^3\d{8,10}$/.test(digits)) return "39" + digits;
  // se inizia per 39, ok
  if (digits.startsWith("39")) return digits;
  return digits;
}

export function whatsappUrl(phone: string, message: string): string {
  const n = normalizePhone(phone);
  const text = encodeURIComponent(message);
  if (!n) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${n}?text=${text}`;
}

export function openWhatsApp(phone: string, message: string) {
  if (typeof window !== "undefined") {
    window.open(whatsappUrl(phone, message), "_blank", "noopener,noreferrer");
  }
}

export function telUrl(phone: string): string {
  const n = normalizePhone(phone);
  return n ? `tel:+${n}` : "tel:";
}

export function mapsUrl(address: string): string {
  const a = (address || "").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
}

export function openMaps(address: string) {
  if (!address?.trim() || typeof window === "undefined") return;
  window.open(mapsUrl(address), "_blank", "noopener,noreferrer");
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" });
const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

export type TemplateId =
  | "conferma_ordine"
  | "promemoria_ritiro"
  | "ordine_pronto"
  | "consegna_in_arrivo"
  | "promo_bundle"
  | "cliente_inattivo"
  | "premio_disponibile"
  | "ringraziamento"
  | "libero";

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  conferma_ordine: "Conferma ordine",
  promemoria_ritiro: "Promemoria ritiro",
  ordine_pronto: "Ordine pronto",
  consegna_in_arrivo: "Consegna in arrivo",
  promo_bundle: "Promo bundle",
  cliente_inattivo: "Cliente inattivo",
  premio_disponibile: "Premio fedeltà",
  ringraziamento: "Ringraziamento",
  libero: "Messaggio libero",
};

export interface MessageContext {
  client?: Client;
  order?: Order;
  bundle?: Bundle;
  delivery?: Delivery;
  productNames?: string[];
  custom?: string;
}

export function buildMessage(template: TemplateId, ctx: MessageContext): string {
  const nome = ctx.client?.name?.split(" ")[0] ?? "";
  const items = ctx.productNames?.length ? `\n\n• ${ctx.productNames.join("\n• ")}` : "";
  switch (template) {
    case "conferma_ordine":
      return `Buongiorno ${nome},\nle confermiamo il suo ordine per ${ctx.order ? formatDateLong(ctx.order.pickupDate) + " alle " + formatTime(ctx.order.pickupDate) : "la data concordata"}.${items}${ctx.order ? `\n\nTotale: ${eur(ctx.order.total)}` : ""}\n\nGrazie,\nCaseificio Sciorio dal 1947`;
    case "promemoria_ritiro":
      return `Ciao ${nome}, le ricordiamo il ritiro del suo ordine ${ctx.order ? "oggi alle " + formatTime(ctx.order.pickupDate) : "in giornata"}.\nA presto in caseificio!`;
    case "ordine_pronto":
      return `${nome ? nome + ", il" : "Il"} suo ordine è pronto e l'aspetta in caseificio${ctx.order ? " (ritiro previsto " + formatTime(ctx.order.pickupDate) + ")" : ""}. A presto!\nCaseificio Sciorio`;
    case "consegna_in_arrivo":
      return `${nome ? nome + ", la" : "La"} consegna è in arrivo${ctx.delivery ? " nella fascia " + ctx.delivery.timeSlot : ""}. Ci vediamo a breve!`;
    case "promo_bundle":
      return ctx.bundle
        ? `Buongiorno${nome ? " " + nome : ""},\nquesta settimana proponiamo "${ctx.bundle.name}":\n\n• ${ctx.bundle.ingredients.join("\n• ")}\n\nPrezzo offerta: ${eur(ctx.bundle.offerPrice ?? ctx.bundle.fullPrice)} (anziché ${eur(ctx.bundle.fullPrice)})\nDisponibilità: ${ctx.bundle.availability}\n\nCaseificio Sciorio dal 1947`
        : `Buongiorno${nome ? " " + nome : ""}, abbiamo una nuova proposta per lei. Le interessa saperne di più?`;
    case "cliente_inattivo":
      return `Buongiorno ${nome},\nci manca! Per il suo ritorno in caseificio le riserviamo una piccola sorpresa: ricotta di bufala in omaggio sul prossimo ordine.\nA presto,\nCaseificio Sciorio`;
    case "premio_disponibile":
      return `${nome ? nome + ", complimenti" : "Complimenti"}! Ha completato la cartolina fedeltà: 1kg di mozzarella di bufala in omaggio sul suo prossimo ritiro.\nLa aspettiamo,\nCaseificio Sciorio`;
    case "libero":
      return ctx.custom ?? "";
  }
}

export function productName(p?: Product): string {
  return p?.name ?? "";
}
