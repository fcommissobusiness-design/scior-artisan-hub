## Multiutente Base — Sciorio HQ

Implementazione ruoli **Amministratore / Collaboratore** riusando al massimo Auth, Sync Cloud, `user_state` e infrastruttura esistente. Nessun Resend attivo (predisposto ma inattivo). Nessun refactor massivo.

---

### 1. Modello dati (una sola migration)

Il nodo architetturale: oggi ogni utente ha la sua riga `user_state` (dati privati). Per il multiutente serve che **tutti i collaboratori di un'attività leggano/scrivano la stessa riga** — quella dell'**owner** (il primo utente).

Nuove tabelle in `public`:

- **`account_members`** — mappa utente → account (owner) + ruolo
  - `user_id uuid PK` (→ `auth.users`)
  - `owner_id uuid NOT NULL` (l'admin fondatore = "account id")
  - `role text CHECK IN ('admin','collaborator')`
  - `created_at`, `last_seen_at`
  - Il primo signup di un utente crea `owner_id = user_id, role='admin'` via trigger.

- **`account_invitations`**
  - `id uuid PK`, `owner_id`, `email citext`, `role`, `token uuid UNIQUE`
  - `status text ('invited','accepted','revoked')`
  - `invited_by`, `invited_at`, `accepted_at`, `accepted_user_id`

RLS + GRANT completi. `has_role(uid, owner_id, role)` come security-definer per evitare ricorsione.

**Modifica chiave a `user_state`:** aggiungere policy che consente `SELECT/UPDATE` anche ai membri dell'account (via `account_members.owner_id = user_state.user_id`). Nessuna copia dei dati: si continua a scrivere sulla riga dell'owner.

### 2. Cloud Sync (modifica minima)

`useCloudSync(userId)` diventa `useCloudSync(userId, ownerId)`. Idrata e pusha su `user_state.user_id = ownerId`. Il realtime channel ascolta `user_id=eq.${ownerId}`. Zero cambi al resto della logica (`store.ts`, snapshot, debounce, flush).

`AppShell` carica prima la membership dell'utente (`account_members`), poi passa l'`ownerId` a `useCloudSync`. Se manca la riga (utente storico pre-migrazione), la crea al volo come `owner_id = self, role='admin'`.

### 3. Ruoli e route gating

Nuovo hook `useCurrentRole()` esposto da `AppShell` via context. Set delle route consentite ai collaboratori:

```
/  /ordini  /consegne  /clienti  /offerte
/magazzino  /prodotti  /previsioni  /entrate-merci  /fornitori
+ /admin/collaboratori (solo lettura del proprio profilo? no: bloccata)
```

Tutte le altre voci restano **visibili** nella sidebar (marker "🔒"). Se un collaboratore ci clicca, `AppShell` intercetta e mostra un **banner** al posto del contenuto:

> Non disponi dei permessi necessari per accedere a questa sezione.
> [Contatta un amministratore] (chiude il banner)

Stessa protezione via URL diretto (controllo su `path` in `AppShell`, come già fatto per `WIP_ROUTES`).

### 4. Schermata Gestione Team

Nuova voce nella sidebar sotto **Amministrazione** (visibile solo agli admin): `/admin/collaboratori`.

Contenuti:
- Pulsante **Invita persona** → modal (Email + Ruolo select) → **Invia invito**
- Tabella membri: Email · Ruolo · Data invito · Status (Invitato/Registrato/Attivo) · Ultimo accesso
- Azioni per riga (menu): Promuovi admin · Declassa · Revoca · Rimuovi · Reinvia invito
- Guardrail:
  - Primo admin (l'`owner_id` stesso) non rimovibile/declassabile
  - Blocco se l'azione lascerebbe zero admin

### 5. Inviti (email predisposta, inattiva)

Server functions in `src/lib/invitations.functions.ts`:
- `createInvitation({email, role})` — admin only, inserisce riga, genera token
- `getInvitationByToken(token)` — public, per pagina di accettazione
- `acceptInvitation({token, password})` — crea utente Supabase (signUp), inserisce `account_members` con `owner_id` dell'invito, marca `accepted`
- `listMembers()`, `updateMemberRole()`, `removeMember()`, `revokeInvitation()`, `resendInvitation()`

**Email**: helper `sendInvitationEmail(email, link)` in `src/lib/email/invitations.ts`. Corpo predisposto (subject "Sei stato invitato su ScalaShop", testo + link). Attualmente **no-op** con `console.log` + flag `EMAIL_PROVIDER_ENABLED=false`. Quando Resend verrà collegato basterà popolare la funzione.

Il link generato viene comunque mostrato all'admin nella UI dopo la creazione ("copia link invito") — così il flow è testabile senza email reale.

### 6. Pagina di accettazione

Nuova route pubblica `/invito/$token`:
- Legge invito via server fn pubblica
- Mostra email precompilata (readonly) + campo password
- Su submit → `acceptInvitation` → login automatico → redirect a `/`
- Nessun onboarding, nessuna creazione dati: entra dritto nell'attività esistente

### 7. Persistenza & multi-device

Nessuna modifica: Supabase auth già persiste la sessione. Login normale funziona già. Il realtime già gestisce la sync tra device — ora tra utenti diversi dello stesso account.

### 8. Aspetti tecnici principali

- **Migrazione utenti esistenti**: trigger `on auth.users insert` + backfill una tantum che crea `account_members(user_id=self, owner_id=self, role='admin')` per ogni utente già registrato.
- **RLS `user_state`**: policy aggiuntiva `USING (user_id IN (SELECT owner_id FROM account_members WHERE user_id = auth.uid()))` per SELECT/UPDATE.
- **Signup libero disabilitato**: solo via invito. `supabase--configure_auth disable_signup=true`. L'accept-invito usa `signUp` che il server valida contro il token (server fn con `supabaseAdmin.auth.admin.createUser`).
- **Realtime**: il channel filtra sull'`ownerId`, così tutti i collaboratori ricevono le stesse UPDATE.

### 9. File toccati (stimati)

Nuovi:
- `supabase/migrations/<ts>_multiuser.sql`
- `src/lib/account.ts` (hook membership + role context)
- `src/lib/invitations.functions.ts` (+ tipo)
- `src/lib/email/invitations.ts` (placeholder)
- `src/routes/admin.collaboratori.tsx`
- `src/routes/invito.$token.tsx`
- `src/components/AccessDeniedBanner.tsx`

Modificati (minimi):
- `src/lib/cloudSync.ts` — accetta `ownerId`
- `src/components/AppShell.tsx` — carica membership, passa ownerId, gate route, voce sidebar admin, banner blocco
- `src/routes/admin.tsx` — link a Collaboratori

### 10. Verifiche finali

Al termine testerò con Playwright/psql: creazione invito, link copiabile, accept-invito → login, sync condivisa tra due sessioni, blocco route del collaboratore, azioni admin (promuovi/declassa/revoca/rimuovi), guardrail ultimo admin, persistenza login.

---

Confermi? Segnalami eventuali aggiustamenti (es. path della voce sidebar, testo esatto del banner, se vuoi che l'invito mostri anche il link copiabile in UI durante questa fase senza email).