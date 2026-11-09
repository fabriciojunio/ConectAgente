# Security policy

*[Versão em português](../../SECURITY.md)*

## Supported versions

| Version | Support |
|---------|---------|
| 1.x     | active  |

## Reporting a flaw

Email **junioad555@gmail.com** with the subject **[SECURITY] ConectAgente**. Reply within
**72 hours**.

Do not open a public issue for a flaw that exposes citizens' data.

---

## The data this system holds

Name, CPF (Brazilian taxpayer number), national health card number, address, health conditions,
medication, pregnancy and child data, and reports of domestic violence and neglect. It is
**sensitive personal data** as defined in article 5, II of Law 13.709/2018 (LGPD).

It is meant for use by a municipal health department.

---

## Measures in place

- **Row Level Security on every server table.** It is the only real protection of the data:
  Supabase's public key is public by design and ships inside the published bundle. A rule that
  only exists on the client is not a rule.
- **Role-based access control** in four levels (`agente`, `coordenador`, `gerente`, `admin`),
  decided by database policies. Screen guards mirror the policies, and a contract test checks it.
- **Salted password hashes**, constant-time comparison, and `senha_hash` unreadable by the client
  through column-level `GRANT`s.
- **Login attempt limit**: five failures lock the CPF for 15 minutes.
- **Residents' documents, contacts, illnesses and medication are only available through audited
  reads.** Since 28/10/2026 the `moradores` table grants read access column by column: panel lists
  see name, age and follow-up markers; CPF, health card, phone, parentage, illnesses, medication,
  insurance, benefits and schooling only come out through `fn_ler_morador`, which records who read
  them in the same transaction. Document search is `fn_buscar_morador_por_documento`: exact match,
  logged without storing the searched document. Proven by `rodar-testes-colunas.sh`, including that
  the app can still write.
- **A deactivated account loses access immediately.** Since 28/10/2026 every data table has a
  restrictive `conta_ativa` policy, combined with AND with the others: with `agentes.ativo = false`,
  a still-open session can no longer read or write anything, and the audited functions refuse.
- **Dashboard functions fail closed.** The six indicator functions are `SECURITY DEFINER` and chose
  their scope by role; a null role fell into the manager branch and saw the whole city. They now
  refuse without an active account, have a locked `search_path` and cannot be executed with the
  anonymous key. Proven in `07-conta-ativa.sql`.
- **Someone who has not signed in cannot touch the database.** Since 09/11/2026 the `anon` role has
  no privilege on any table, sequence or policy helper function, including ones created later, and
  `authenticated` has no `TRUNCATE`, which would bypass RLS. The policy that accepted registration
  requests straight through the API is gone: requests come in through the server, which validates
  and rate-limits them. Proven in `08-sem-anonimo.sql` and applied in production.
- **No clinical column of the medical record forms leaves through the API.** From 1.2.2 on the app
  writes the forms without upsert, and `migration_prontuario_fechado.sql` lets a signed-in user read
  only the keys. Proven in `09-prontuario-fechado.sql`, including that the old upsert is refused and
  that the app can still write.
- **Session token and local key in SecureStore** (Keychain on iOS, Keystore on Android).
- **The device's local database is encrypted whole with SQLCipher** since 1.2.0 (02/11/2026). The
  256-bit key is drawn on first run, kept in the Keystore and applied with `PRAGMA key` before any
  read.
- **The Supabase certificate is pinned** in the app through Android's network security config: two
  public keys from the chain, with an expiration date so agents are not locked out if Google changes
  the chain.
- **Immutable audit trail**: `audit_log` accepts inserts and reads, `UPDATE` and `DELETE` are
  revoked, and reading is restricted to managers and admins.
- **Soft deletion** (`deleted_at`), not physical.
- **Panel content security policy with a nonce** for scripts and style elements; only `style=""`
  attributes remain allowed, through `style-src-attr`. Fonts are served by the site itself and the
  page is isolated from other origins (`Cross-Origin-Embedder-Policy`, `-Opener-Policy` and
  `-Resource-Policy`). Checked in Chromium with no violations on the sign-in and demo screens, and by OWASP ZAP
  against the published site on 29/10/2026: 64 rules, no warnings.
- **Authorisation checked on the server** in administrative Server Actions, with identity taken
  from the session cookie and never from a parameter.
- **Vulnerability gate in CI**: `npm audit` without dev dependencies must be zero on the panel, and
  no criticals on the app. Since 28/10/2026 also OSV-Scanner on both lockfiles, Semgrep (static
  analysis) and gitleaks (secrets in history) on every push, all free; risk acceptances with
  deadlines in `osv-scanner.toml`. Actions pinned by SHA and Dependabot with a seven-day wait.

Details, including the defects found and fixed with the message the database returned in each
case, in [security.md](security.md).

---

## Known limitations

Recorded because omitting a limitation in a public-sector system is worse than having it.

- **Upgrading from an unencrypted version to 1.2.0 needs a reinstall.** The file format changes and
  the old database does not open with a key. In an offline-first system the data comes back from the
  server on sync, but anything still queued is lost: sync before upgrading.
- **The app's local password uses salted SHA-256, single pass.** It serves offline login, but it is
  too fast for a password: with a stolen device's database in hand, guessing passwords is cheap. The
  right approach is slow derivation (PBKDF2 with many iterations, scrypt or Argon2), migrating each
  agent's hash on their next login.
- **Closing the medical record forms depends on 1.2.2 being installed.** Earlier versions write the
  forms with upsert, which `migration_prontuario_fechado.sql` refuses. The migration goes into the
  database together with the 1.2.2 rollout, and a device on an older version stops syncing forms
  until it is updated.
- **The web panel has no second factor**, and it is where every patient's record is read.
- **Rate limiting is in process memory.** With more than one panel instance, each counts separately.
- **Build dependencies with known flaws** (`uuid` 7, `image-size` 1, `deepmerge`, `glob` and
  `minimatch`) come from the Expo CLI, Metro, config-plugins and Jest. Either they have no fixed version, or the fixed one breaks
  bundling (measured). They run on the packager's machine, not on the device. Each is accepted with a
  reason and deadline in [`osv-scanner.toml`](../../osv-scanner.toml).

---

## Before deploying with real data

1. Appoint the data protection officer and the data subject request channel.
2. Resolve the audit trail for medical record access.
3. Fill in the names and contacts in the [incident procedure](incident-response.md).
4. Rotate any key that circulated in a test environment.
