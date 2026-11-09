# LGPD: what is ready and what is not

*[Versão em português](../lgpd.md)*

The system processes **sensitive personal data** as defined in article 5, II of Law 13.709/2018
(LGPD, Brazil's data protection law): health conditions, medication, pregnancy and child data, and
reports of domestic violence and neglect.

This document separates what the code does from what the code merely declares. The separation
matters because the previous version of this documentation listed nine requirements as
"implemented", and most were functions that were never called. For a public body, claiming
compliance without it is worse than recording the gap.

---

## Legal basis

| Item | Definition |
|---|---|
| Purpose | primary health care, follow-up by Community Health Agents |
| Legal basis, ordinary data | art. 7, III: execution of public policy by the administration; VIII: health protection |
| Legal basis, sensitive data | art. 11, II, "b": public policy; "f": health protection |
| Controller | the municipal health department that deploys it |
| Data protection officer | to be appointed by the department before deployment |

The code declares this in `ConectAgente-mobile/src/utils/lgpd.ts`, in the `BASE_LEGAL_LGPD`
constant, and the app's "Mais" screen shows the text.

---

## What is implemented and verifiable

| Requirement | Where | Verified by |
|---|---|---|
| Security of processing (art. 46) | RLS on every table, salted password hash, SecureStore for key and token | `rodar-testes-rls.sh`, 22 checks |
| Role-based access control | database policies, mirrored in screen guards | `contratoPapeis.test.ts` |
| Immutable trail | append-only `audit_log`, `REVOKE UPDATE, DELETE`, read only by managers and admins | `rodar-testes-rls.sh` |
| Soft deletion | `deleted_at` on `residencias`, `moradores` and `visitas` | schema |
| Minimisation in exports | reports exclude `senha_hash` and `assinatura_base64` | `relatorioService` |
| Transparency | notice at entry and sign-up, legal basis text on the "Mais" screen | screens |

---

## What was switched on, and how to check it

Until 13/10/2026 the functions in this module existed and **no screen called them**. The system
claimed compliance on the agent's screen and had no proof of consent, no access trail and no path
for the right to erasure.

Current state, by legal obligation:

| Obligation | Where | How to check |
|---|---|---|
| Art. 37, record of operations | `auditRepository` in the app; `fn_ler_morador` in the database | `rodar-testes-leitura.sh`, 10 checks |
| Art. 7/11, proof of consent | `lgpdRepository.registrarConsentimento`, in resident sign-up | `lgpdRepository.test.ts` |
| Art. 18, IV, erasure | `lgpdRepository.anonimizar`, on the resident record | `lgpdRepository.test.ts` |
| Art. 16, retention | `lgpdRepository.levantarVencidos`, on the manager's panel | `lgpdRepository.test.ts` |

### Events that enter the trail

In the app: signing in, opening a medical record, exporting a report and anonymising a resident. In
the panel: approving and rejecting sign-ups, and opening a patient record.

Reads in the panel needed a different solution. There the browser talks directly to PostgREST with
the public key, under RLS, and there is no server of ours in between to write to. Logging from the
client would be theatre, because one could simply not call it. The answer was `fn_ler_morador`, a
`SECURITY DEFINER` function with a locked `search_path`, which writes the record in the same
transaction in which it reads. It also writes `LEITURA_NEGADA` when it refuses: without that,
scanning identifiers would leave no mark.

The function is only worth anything if the record cannot be read another way. Since 28/10/2026
documents, contacts, parentage, illnesses and medication do not come out through a direct `SELECT`:
the database grants read access column by column, and the panel searches by document through
`fn_buscar_morador_por_documento`, which also writes to the trail (without storing the document).

### The trail and consent reach the server

Both go into the sync queue. Proof of consent cannot stay only on the device: if the phone is lost,
the demonstration that the data subject was informed is lost with it.

The trail from the device is not a door to forge another agent's actions: the server's insert policy
requires `agente_id = auth.uid()`, so the app only writes events on behalf of whoever is actually
authenticated.

One type difference needed translation. SQLite has no JSON, and the record context is TEXT with the
serialised JSON inside; in PostgreSQL the column is JSONB. Sending the raw string, the server accepts
it and stores a JSONB that is a string, not an object, and queries on fields inside the JSON stop
finding anything. With no error at all. It is the kind of defect that only shows up when someone
needs to investigate an incident and the trail does not answer.

### What the trail does not store

Content. The record says which table and identifier were touched, plus a short context. A trail that
copies the medical record multiplies the problem it should be watching, and a test checks field by
field that no clinical data appears in what was written.

### Failing to audit does not undo the operation

No call uses `await`. The reason is concrete: auditing already broke in this project because of a
wrong column name, the exception bubbled up, and the screen said the password change failed after it
had happened. An agent in the field cannot lose a recorded visit because the log failed.

---

## What is still missing

**Art. 48, incident notification.** The procedure is in [incident-response.md](incident-response.md),
with the three-business-day deadline from ANPD Resolution CD/ANPD No. 15/2024. Names and contacts
are missing; they are an administrative decision for the department.

**Direct reads of the medical record tables: closed from 1.2.2 on.** Since
`migration_prontuario_fechado.sql`, no clinical column of the forms leaves through the API, and a
signed-in user reads only the keys. Because the migration refuses earlier app versions' upsert, it
goes into the database together with the 1.2.2 rollout. See [security.md](security.md).

**Data protection officer and data subject channel.** Without them, data subject requests have no
one to answer them. Also an administrative decision.

**An expired retention period deletes nothing.** That is deliberate: the panel counts and shows, and
the coordination decides to erase. A system that deletes medical records on its own is worse than one
that keeps too much.

---

## Where the code is

```
ConectAgente-mobile/src/utils/lgpd.ts              functions and legal basis
ConectAgente-mobile/src/utils/__tests__/lgpd.test.ts
ConectAgente-mobile/src/database/schema.ts         audit_log, consentimentos
ConectAgente-mobile/src/database/repositories/lgpdRepository.ts   consent, erasure, retention
ConectAgente-mobile/src/database/repositories/auditRepository.ts  app trail
ConectAgente-web/src/services/auditService.ts      reading and writing the trail
ConectAgente-web/supabase/migration_auditoria_leitura.sql  fn_ler_morador
ConectAgente-web/supabase/migration_rls_completo.sql  policies and immutability
ConectAgente-web/supabase/testes/rodar-testes-leitura.sh   proof of the audited read
```
