# ConectAgente

*[Leia em português](README.md)*

A system that supports the work of Brazil's Community Health Agents (Agentes
Comunitários de Saúde): an app that works offline for field records, and a web
panel for coordinators to follow up.

The agent registers households and residents, records each home visit with what
was measured (blood pressure, glucose, weight, medication up to date, vaccination
card) and keeps the five follow-up records: general health, pregnancy, child care,
women's health and social situation. Everything is stored on the device and sent
to the server when there is a connection.

A scientific initiation (undergraduate research) project, designed for use by a
municipal health department. The data it holds is **sensitive personal data** as
defined in article 5, II of Brazil's data protection law (LGPD), and that drives
the project's security decisions.

---

## Running

Requires Node 20 or newer. The database suites also need PostgreSQL installed
(the server, not just the client).

```bash
# Field app
cd ConectAgente-mobile
npm ci
cp .env.example .env     # or use scripts/configurar-supabase.sh, below
npx expo run:android     # builds and installs on a device or emulator

# Web panel
cd ConectAgente-web
npm ci
cp .env.example .env     # fill in the three variables
npm run dev
```

### Connecting to Supabase

Instead of editing both `.env` files by hand:

```bash
bash scripts/configurar-supabase.sh \
  --url https://xxxxxxxxxxxx.supabase.co \
  --anon eyJhbGciOi...
```

The script checks the credentials against the server before writing any file:
if the address does not answer, the key is rejected, or the schema has not been
applied yet, it stops and writes nothing. A half-filled `.env` does not break the
app; it starts and sync fails silently, which is worse than not configuring it.

The values are on supabase.com, in the project, under Settings → API: "Project
URL" and the publishable key. Run `ConectAgente-web/supabase/setup-completo.sql`
in the Supabase SQL editor first.

The app opens and works even without `.env`: the local database is independent
of the server. What does not work without it is sync, and the app says so
instead of failing silently.

On first run the app creates an administrator with a **random** password, shown
only once under Sistema → Credenciais de acesso. Write it down and change it.

---

## Validating

```bash
# App: types, tests and a real Metro bundle
cd ConectAgente-mobile && npx tsc --noEmit && npm run test:ci
npx expo export --platform android --output-dir /tmp/saida

# Panel: types, lint, tests and build
cd ConectAgente-web && npx tsc --noEmit && npm run lint && npm test -- --ci
npm run build

# Real database: permissions, sync, sign-up, audited reads,
# sensitive columns and deactivated accounts
bash ConectAgente-web/supabase/testes/rodar-todos.sh
```

State measured on 12/11/2026, version 1.3.0:

| What | Result |
|---|---|
| App tests | 989 in 61 suites, including theme contrast, navigation, layout guards and sync contract; 86.3% statement coverage |
| Panel tests | 519 in 43 suites, including the second factor, session policy, cache wiped on sign-out and role-based route gate |
| Checks against a real database | 181 in 6 suites, all passing, including role escalation, writing to another agent's family and repeated install |
| Gray-box pentest | 11 findings, all fixed and retested in production ([report, in Portuguese](docs/pentest-2026-11.md)) |
| Real use in production | 12 panel pages in light and dark themes with no errors, 15 reports generated and audited |
| Type errors | 0 in both projects |
| ESLint warnings | 0 |
| Vulnerabilities (OSV-Scanner) | 0 unaccepted; build-tool ones have a reason and deadline in `osv-scanner.toml` |
| Static analysis (Semgrep) | 0 findings |
| `as any` in the app | 0 |

The database suites start a throwaway PostgreSQL on its own port, apply the
schema and migrations, exercise a real path and tear themselves down. Nothing
touches an existing database.

They exist because the project's most serious defects **did not show up in unit
tests**: each side was consistent with itself and the error lived at the seam.
Seven tables without Row Level Security, 61 columns the app wrote that the server
did not have, and five different vocabularies for the user role field. Only the
database complains about that.

---

## Branches

| Branch | Purpose |
|---|---|
| `produção` | what is validated and ready for use. The default branch |
| `homologação` | where a change is checked before going to production |

Both sit on the same commit when nothing is in progress. CI runs on every
branch, not just these two, because finding a problem in the pull request is the
most expensive moment.

---

## Repository layout

```
ConectAgente-mobile/        Expo + React Native app (28 screens)
  src/app/                  routes, via expo-router; the screen only composes
  src/features/             rules, data and styles of each screen
  src/components/           shared components
  src/database/             local SQLite, 18 tables, and the repositories
  src/services/             authentication, sync, export, postcode lookup
  src/utils/                validation, cryptography, LGPD, formatting, navigation
  modules/pbkdf2-nativo/    password hashing in native Android code
  supabase/schema.sql       server schema (13 tables)

ConectAgente-web/           Next.js 15 panel (16 routes)
  src/app/                  routes and Server Actions
  src/services/             Supabase queries, by domain
  src/lib/                  cache, request queue, rate limiting
  supabase/                 migrations and the database suites
  supabase/testes/          rodar-todos.sh and the scenarios

docs/                       (in Portuguese)
  manual-tecnico.md         the details: architecture, screens, types, database
  arquitetura.md            component overview
  seguranca.md              security model and what was fixed
  lgpd.md                   what is implemented and what is not
  modelo-de-ameacas.md      STRIDE and LINDDUN threat model, each threat with its control and proof
  masvs.md                  OWASP MASVS, item by item
  auditoria-lgpd.md         LGPD audit in eight groups and the impact assessment
```

English versions of the security documents are in [docs/en/](docs/en/), including the
[MobSF analysis of the APK](docs/en/mobsf.md).

---

## Decisions worth knowing before changing things

**The app needs a Supabase session to sync.** It authenticates locally, in
SQLite, so it works offline. But the server decides what each user may write
through `auth.uid()`, and without a session every policy denies. So login opens a
Supabase session when there is a connection, without blocking entry when there
is not. Loosening the policy is not a fix: whoever uses the public key has no
verifiable identity, and any rule that accepted the write would accept it from
anyone holding the key, which is public by design.

**The agent must exist in Supabase Auth.** That user is created when a manager or
admin approves the sign-up in the panel. An agent created only by the app's first
run has no server user and does not sync.

**There are four roles, the same everywhere:** `agente`, `coordenador`,
`gerente`, `admin`. What each can reach is decided by the database policies, and
the screen guards mirror the policies on purpose. A guard that does not match the
policy produces the worst kind of error: the page opens empty and the user
concludes there is no data instead of no permission.

**The sync control field does not go up.** On the device it is called
`status_sync` and answers "has this row been sent?", a question that only makes
sense locally. Translation and removal of local fields live in one place,
`syncQueueRepository.prepararPayloadParaServidor`, and the test
`contratoSync.test.ts` compares both schemas so the divergence does not return.

**Three decisions from 13/10/2026, so they are not reopened without reason.**

- **The app no longer runs in Expo Go.** Reminder notifications and background
  sync depend on native modules. The choice was between keeping Expo Go and
  having the app the agent needs: they walk their area without signal and return
  to the health unit, and without background sync the data stays on the phone
  until someone remembers to open the app. To develop, `npx expo run:android`.
- **There is no custom backend, and there will not be.** The app and the panel
  talk directly to Supabase's PostgREST, and who reads what is decided by RLS,
  inside the database. The team repository has a
  `ConectAgente-mobile/backend/` folder with Express and Prisma that was left
  behind in this change; it was never here and nothing references it. Bringing it
  back would mean keeping authorisation rules in two places, and duplicated
  authorisation rules are the ones that go stale where nobody looks. If a server
  is ever needed, it comes in for what RLS cannot do, not to repeat what it does.
- **The database stays on Supabase.** The free plan pauses after seven days
  without use, and moving to another provider would mean rewriting the 70
  references to `auth.uid()` in the policies, the authentication of both apps and
  the stub the database suites use. The risk lives in RLS, which is what separates
  one agent's records from another's. Pausing is handled by a weekly ping in
  `.github/workflows/keep-alive.yml`, with the `SUPABASE_URL` and
  `SUPABASE_ANON_KEY` secrets already set in the repository.

**Two decisions from 02/11/2026, in version 1.2.0.**

- **The device database is encrypted whole, with SQLCipher, not field by
  field.** The key is 256 bits, created on first run and kept in the Keystore,
  bound to the device. Field-level encryption would break the local search the
  agent uses in the field to find a patient; encrypting the whole file keeps the
  search and is real AEAD. The cost is that upgrading from a version without
  encryption needs a fresh install, and in an offline-first app the data comes
  back from the server on sync.
- **The Supabase certificate is pinned at the anchors, not the leaf.** The app
  only accepts a chain that goes through Google Trust Services' WE1 intermediate
  or the GTS Root R4. The Supabase leaf rotates on its own; the anchors do not.
  The pin-set has an expiry date so a change in Google's own chain does not lock
  sync out in the field; renewing before the date is described in the header of
  `plugins/fixar-certificado.js`.

**Three decisions from 09/11/2026, in version 1.2.2.**

- **Someone who has not signed in cannot touch the database.** The `anon` role
  lost every table, sequence and helper-function privilege, and registration
  requests only come in through the server. The panel's health check treats
  the `42501` refusal as proof the database answered; granting the visitor
  access just for the health check would reopen what was closed.
- **A date without time never goes through `new Date`.** `data_visita`,
  `data_agendada` and `data_nascimento` are stored as `2026-10-13`, and
  `new Date` reads that as UTC midnight, which in Brazil is still the 12th.
  Every visit showed up a day early. The app suite runs in the São Paulo time
  zone (`jest.fuso.js`) so the defect cannot come back unnoticed.
- **Health card check digit on registration, length only on search.**
  Registration checks the Cartão Nacional de Saúde algorithm; search still
  finds cards stored before the check existed.

---

## What is still missing

Honesty about the current state, which is worth more than a feature list:

- **Medical record forms only close with 1.2.2 installed.** From that version
  on no clinical column leaves through the API (`migration_prontuario_fechado.sql`),
  but the migration refuses earlier versions' upsert, so it goes into the
  database together with the 1.2.2 rollout.
- **The second factor protects the panel, not the database API.** The app uses
  the same account without a second factor, so the database still accepts
  password-only sessions within each role's RLS.
- **Two 1.2.5 migrations are applied by hand**
  (`migration_limite_de_tentativas.sql` and `migration_medicamentos.sql`). Until
  then the panel counts attempts in memory and medications stay on the device.

---

## Licence and use

Academic research project. Use with real citizens' data depends on authorisation
from the responsible health department and on resolving the LGPD items listed
above.
