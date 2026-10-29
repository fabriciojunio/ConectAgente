# APK analysis with MobSF

*[Versão em português](../mobsf.md)*

MobSF 4.5.3 runs in CI against each release's APK (workflow `mobsf.yml`), in a throwaway container:
the APK is not sent to any outside service. This document is the triage of version 1.1.0, with what
was fixed, what belongs to libraries and what is accepted.

## Before and after

| | APK 1.1.0 before | Published APK 1.1.0 |
|---|---|---|
| MobSF score | 55/100 | 56/100 |
| High findings | 1 | 1 |
| Warnings | 13 | 11 |
| Dangerous permissions | 6 | 3 |

MobSF's score barely moves with manifest fixes: it weighs `minSdk` heavily. What matters is in the
rows below.

## Fixed

| Finding | Fix | Proof |
|---|---|---|
| `android:allowBackup=true` | the database with health data left through Google backup and `adb backup`; `allowBackup: false` in `app.json` | published APK manifest |
| Unprotected exported `CropImageActivity` | any app on the device could open the library's crop screen; `exported="false"` through the `plugins/endurecer-manifesto.js` plugin | APK manifest and `endurecerManifesto.test.ts` |
| `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE` | came from dependencies and no feature uses them; `blockedPermissions` in `app.json` | published APK permissions |

The three remaining dangerous permissions are used: reminder notifications, camera and gallery for the
profile photo.

## From libraries, no effect on ConectAgente

| Finding | Where | Why it does not apply |
|---|---|---|
| Receivers and service "protected by a permission" | Firebase, WorkManager, ProfileInstaller | protected by system permissions (`BIND_JOB_SERVICE`, `DUMP`, `c2dm.SEND`) that regular apps cannot obtain |
| Sensitive information in code | Coil, Glide | naming patterns in image cache code; no password or key value appeared in the secrets list |
| Secrets in code | Hermes and Reanimated tables and symbols | the 808 items were filtered by credential patterns (`sb_`, `eyJ`, `AIza`, secret, password, key): only native code symbols, no key, password or token |
| Raw SQL | AsyncStorage | the library's own fixed query. In the app database every value is a parameter; the only built text is table and column names from a fixed list in the code (`lgpdRepository.levantarVencidos`) |
| MD5 | Expo file and asset modules | used as a cache identifier, not as protection |
| Temp file and external storage | Coil and the crop library | temporary profile image file, in the app cache |
| IP address disclosure | Expo network module | the app does not use the IP address for anything |
| Information logging | Glide and others | library logs, with no app data; the app's own log carries no documents or clinical data (code review) |

## Accepted, with a decision deadline

**`minSdk=24`: the app installs on Android 7.0.** The only high finding. Android 7 has not received
security patches since 2019, and an old device may lack disk encryption, which is what protects the
local database today (see [security.md](security.md)).

Raising `minSdk` fixes it but excludes agents with old phones, and that is the health department's
decision, not a technical one. The recommendation is `minSdk 29` (Android 10, where encryption became
mandatory on new devices), after surveying the team's devices. Until then the risk is recorded here
and reviewed at each release.

## Reproducing

In the repository's Actions tab, workflow "Análise do APK (MobSF)", "Run workflow" with the release
tag. The full report (JSON and PDF) is kept as a run artifact for 90 days.
