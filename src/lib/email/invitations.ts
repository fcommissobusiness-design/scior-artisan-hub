/**
 * Placeholder provider-agnostic per l'invio email di invito.
 *
 * ATTUALMENTE INATTIVO: registra soltanto in console.
 * Quando Resend (o altro provider) verrà collegato a Sciorio HQ,
 * basterà popolare questa funzione senza toccare la logica multiutente.
 */

export const EMAIL_PROVIDER_ENABLED = false;

export interface InvitationEmailPayload {
  to: string;
  acceptUrl: string;
  role: "admin" | "collaborator";
  invitedBy?: string | null;
}

export async function sendInvitationEmail(payload: InvitationEmailPayload): Promise<{ sent: boolean }> {
  const subject = "Sei stato invitato su ScalaShop";
  const body = [
    `Ciao,`,
    ``,
    `Sei stato invitato a collaborare su ScalaShop${payload.invitedBy ? ` da ${payload.invitedBy}` : ""}.`,
    `Ruolo: ${payload.role === "admin" ? "Amministratore" : "Collaboratore"}`,
    ``,
    `Accetta l'invito:`,
    payload.acceptUrl,
  ].join("\n");

  if (!EMAIL_PROVIDER_ENABLED) {
    console.info("[invite-email:disabled]", { to: payload.to, subject, body });
    return { sent: false };
  }
  // Quando abilitato, qui andrà la chiamata al provider (es. Resend).
  console.info("[invite-email:sent]", { to: payload.to, subject });
  return { sent: true };
}
