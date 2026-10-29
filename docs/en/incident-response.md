# Personal data incident procedure

*[Versão em português](../incidente.md)*

ConectAgente stores health data, which the LGPD treats as sensitive (art. 5, II and art. 11). When an
incident may cause relevant risk or harm to data subjects, art. 48 requires the controller to notify
the ANPD (Brazil's data protection authority) and the affected data subjects. The deadline and
content of the notification are set by the Security Incident Notification Regulation (Resolution
CD/ANPD No. 15/2024): **three business days** from when the controller learns that the incident
affected personal data.

This document is the playbook for those three days. It does not replace the department's legal
team, and the names below must be filled in before the system receives real data.

## Who does what

| Role | Who | Contact |
|---|---|---|
| Controller | Municipal Health Department | to fill in |
| Data protection officer | to fill in | to fill in |
| Technical lead | to fill in | to fill in |
| Who operates Supabase | whoever has admin access to the project | to fill in |

## What counts as an incident

- Access to a resident record by someone who should not have it: repeated `LEITURA_NEGADA` in the
  trail, or an agent reading outside their own area.
- A leaked Supabase key. The `publishable` key is public by design; the `secret` key must never
  appear outside the server.
- A lost or stolen agent device with data not yet synced.
- A coordinator, manager or admin password leaked or used from an unusual place.
- Resident data found where it should not be: an exported spreadsheet, a screenshot, a messaging
  group.

## The first 24 hours

1. **Contain.** Deactivate the account involved in the panel (`ativo = false`): since 28/10/2026
   that immediately cuts reads and writes, even with an open session. To also stop the person
   renewing the session, ban the user in Supabase, under Authentication > Users > Ban user. If it is a
   key, rotate it in Supabase under Settings > API Keys and publish the panel and the app with the
   new one. If it is a device, deactivate the agent's account: the device stops syncing.
2. **Preserve.** Export the trail (`audit_log`) for the period before any other change. It is
   append-only, but the export is what gets attached to the notification.
3. **Measure.** Which residents were affected, which fields, since when. The trail answers who read
   each record in the panel; the device trail, who opened records in the field.
4. **Record** everything in a dated document: what was known, when, and what was done.

## By the third business day

Assess with the data protection officer whether the incident may cause relevant risk or harm. Health
data almost always can. If so, notify:

- **The ANPD**, through the form on the authority's website, with the nature of the data, the data
  subjects affected, the measures taken and what is still being investigated. Missing information can
  be added later; the deadline does not wait for the investigation to finish.
- **The data subjects**, in plain language, through the channel they actually use. For residents
  served by a community health agent, that is often the agent during a visit.

## Afterwards

- Fix the cause, with a test that proves the fix, as was done with the sensitive columns of
  `moradores` on 28/10/2026.
- Record the incident and the fix in the security history in [security.md](security.md).
- Check whether the same path exists on another table.

## What this document does not cover

A software flaw reported by a third party, which has not become an incident, follows the
[security policy](security-policy.md).
