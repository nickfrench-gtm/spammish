# Spammish OSS 0.4.4 — release candidate

Status: qualified for final owner review. No public source push, tag or GitHub release has been performed. Existing tags, including v0.4.3, remain unchanged.

## Scope

Six explicit opt-in installation milestones; no analytics SDK, account system, mailbox telemetry or continuous activity events. Classifier weights, threshold 70, protections, OAuth and Gmail move/Rescue semantics remain unchanged. Counts indicate participating installations, not verified strangers or classification precision.

## Qualification

- 93 application tests and 2 website integration tests pass; 44 source-file syntax checks pass; dependency audit reports zero vulnerabilities. A clean source export independently completed npm ci, all 93 application tests and syntax checks; package/lockfile versions agree at 0.4.4. npm notes an unapproved electron-winstaller Windows install script; Windows packaging is not qualified and this did not block the Mac build.
- Loopback HTTP capture confirms exactly four transmitted fields; strict extra-field rejection, consent/reset, owner/test suppression, successful move/Rescue confirmation, stalled/unreachable networking, duplicate handling and elapsed-time return milestones are covered.
- 0.4.4 unsigned arm64 macOS app built and launched with isolated state, no bundled OAuth credentials and no owner mailbox access. About reports 0.4.4. A persistent suppression marker alone suppresses sharing and disables the opt-in control. The same marker was placed in the owner's existing live user-data directory before any future update; the live app was not replaced.
- Fly remote container build passed. Approved disabled deployment uses image digest `sha256:ab71a01fe200ec1fb4eaf5411edad2528ca0d9d045169420425a68da500ad7ec` on the existing single machine/private volume.
- On that deployed image, an enabled collector bound only to loopback and disposable `/tmp` storage passed schema/method rejection, deduplication, private mode 0600, restart persistence and expiry tests. Synthetic records were removed; production metrics were never seeded.
- Public `/` and `/healthz` return 200; `/api/milestones` rejects requests with 404 because `SPAMMISH_METRICS_ENABLED=no`. Production receipt file remains absent. Existing waitlist byte count/hash stayed identical across deployment; no waitlist subscription was created for qualification.

## Logging and retention

The server emits no request/payload/address logs. Buffered Fly logs were inspected before/after qualification: infrastructure/SSH metadata exists, but no captured milestone payload or synthetic installation ID. No separately named log-shipper app was found; this is not a guarantee about all provider-internal processing.

[Fly documents](https://docs.fly.io/monitoring/logging-overview) stdout-based app logs and seven-day searchable retention. [Volume snapshots](https://docs.fly.io/volumes/snapshots) retain point-in-time volume contents. Actual existing volume and snapshot metadata show five-day retention. Waitlist backups remain enabled.

Live receipt retention is 84 days with startup/hourly purge, leaving room for five-day snapshots within the documented 90-day maximum. Keep snapshot retention at five days or less and create no longer-lived metric copies. Receipt purge must remain operational; restore/restart purges expired receipts before serving events. Provider internal operational metadata is separately disclosed, not represented as absent.

## Final boundary and recovery

Await owner approval before publishing 0.4.4 source/tag/release or enabling public collection. The default remains disabled and users must explicitly opt in. Keep the owner suppression marker in place.

After approval, publish the exact reviewed source commit and immutable v0.4.4 tag/release, then enable the collector explicitly on the existing service. Verify health, live receipt permissions and retention without seeding traction. A collection problem can be contained with `SPAMMISH_METRICS_ENABLED=no`; clients remain functional and retry bounded queues. Container rollback is the previously deployed image `registry.fly.io/spammish@sha256:a9cd22cf4bb80c8ffbf2309e5dcfdb0cd5271b65b14426f397ebd03492082bec`. Preserve the waitlist volume during rollback.

Remaining limits: opt-out bias, resets/reinstalls, forged events, no verified human identity, no precision metric, alternative browser worker uninstrumented, unsigned Mac source build, BYO OAuth, and no newly exercised real-mail acceptance (classification behavior did not change).
