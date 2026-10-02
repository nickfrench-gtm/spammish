# Optional usage milestones — owner review candidate

This 0.4.4 source candidate is not released. The collector deployment is intentionally disabled; deployment qualification is recorded separately. The current published 0.4.3 app has no telemetry. Approval is required before enabling the collector or publishing the candidate. No new analytics SDK or account service is introduced.

## What we can know

GitHub Insights → Traffic provides views, unique visitors, clones and unique cloners for a rolling 14 days. These are not installations; bots, owners, mirrors and qualification can contribute. Do not add overlapping unique counts. Release asset download counts are not unique users; source-clone installation need not download release assets. Stars/issues/forks are secondary signals.

Run `node scripts/traction-report.mjs --github` using the owner's existing GitHub authentication. Traffic authorization errors are reported as unavailable, never zero. No app telemetry is needed for GitHub metrics. Today's measurement is a baseline, not a traction claim.

Desktop milestones are opt-in and installation-specific. They cannot prove the operator is a stranger, identify a person, count opt-outs, distinguish multiple installations by one person, or establish that a classification was correct. The honest primary measure is **participating installations with a confirmed automatic Abyss move**. Do not call it verified stranger users or a measured precision rate.

## Events and payload

At most one receipt per installation ID per event:

- `app_started`: this app is running and the operator opted in; an existing choice survives restart.
- `gmail_connected`: successful OAuth/profile/label initialization, or a successful ongoing Gmail check after consent. Does not transmit account count or identity.
- `first_abyss`: first confirmed automatic move after consent (including confirmation of a pending automatic move after a lost response/restart). Explicit manual Abyss moves are excluded. This proves a move, not user approval of it.
- `returned_7d`, `returned_30d`: a successful enabled Gmail processing pass at least 7/30 elapsed days after consent, with an automatic Abyss milestone already recorded. Continuous background use qualifies; it is not proof the human reopened the window. A delayed first Abyss can qualify immediately if consent is old enough.
- `rescue_performed`: first successful explicit Rescue, or observation that a recorded Abyss message is back in Inbox. Observation cannot establish who moved it. This is installations with a Rescue, not a count of rescued emails.

Payload keys are exactly `install_id` (random UUID v4), `event` (six-name enum), `app_version` (numeric semantic version), `platform` (OS family). No client timestamp. Server adds only its UTC receipt date. The ID is pseudonymous: it links milestones for an installation; it does not identify Gmail or hardware. Reporting outputs counts only, never IDs or waitlist addresses.

No bodies, subjects, senders, recipients, domains, message/thread IDs, evidence, scores, tokens, credentials, paths, machine identifiers, account addresses or counts are accepted. The main process constructs an allowlisted payload; the sandboxed renderer cannot send an arbitrary event or choose an endpoint. No events before consent and no replay of historical mailbox actions. No cookies, redirects, SDKs or analytics dependencies. The receiving host necessarily sees the network address; Fly.io may process/log request metadata independently. This is not a claim of untraceability.

## Choice and exclusion

The inline first-run choice has **Share usage milestones** and **No thanks**. It does not block Gmail or startup. **Usage privacy** provides the same opt-in and a one-click off/remove-local-ID action. Turning off aborts pending requests and drops the queue/ID; a request already accepted cannot be recalled. Received records expire within 90 days. Re-enabling creates a new ID and may overcount installations. Do not silently enroll existing users.

Desktop state is `traction.json` in Electron's user-data directory, private mode 0600, not encrypted (it contains no mailbox data). Storage errors disable sending. Only six locally remembered names and a six-item queue are possible. A three-second request deadline and hourly retry backoff never block Gmail. No startup network request occurs without persisted consent. Collector unavailability leaves the app working; a successful future check/start retries queued events. There is no continuous activity event.

Unpackaged development and Node test runs are suppressed automatically. For **every owner or packaged qualification build**, set `SPAMMISH_TELEMETRY_SUPPRESS=1` at launch or create the persistent file `suppress-traction` in that build's Electron user-data directory **before launch**. Presence suppresses even previously opted-in state. The UI reports suppression. Owner identity is not inferred from email. Do not use real owner Gmail or the live account store for qualification. The alternative browser worker remains telemetry-free and is not counted by this candidate.

## Collector and operator report

The existing website server can host `/api/milestones`; it stays disabled unless `SPAMMISH_METRICS_ENABLED=yes`. This is a small optional endpoint, not Spammish Cloud. It writes `spammish-milestones.json` beside the private waitlist file on the existing volume, separately from email addresses. There is no public report/export endpoint. Strict schema/size checks, a transient salted-IP rate limiter (60 requests/hour/address), atomic writes, event deduplication, 25,000-receipt cap and startup/hourly retention purge bound operation. A shared IP may undercount. Run only one collector process against a file/volume; scaling it is out of scope.

Live receipt records expire after 84 days (with startup/hourly purge). The existing Fly volume has five-day snapshots; the shortened live window leaves room for those copies to expire within the public 90-day limit without weakening waitlist backups. No permanent telemetry aggregates are stored. Keep snapshot retention at five days or less, create no longer-lived manual copies, and recheck this policy before enabling collection. The collector intentionally has no authenticated user account: anonymous submissions can be forged, so treat counts as directional, not certified traction. A reset/new installation can duplicate a person. Exact 7/30-day cohort conversion cannot be inferred simply by dividing all milestone totals; recent starts are not mature cohorts.

On the server (or using a private local copy), run:

```sh
node scripts/traction-report.mjs --events /data/spammish/spammish-milestones.json --waitlist /data/spammish/spammish-waitlist.jsonl
```

Run the `--github` report on an owner-authenticated machine; manually combine these small reports. No need to put GitHub credentials on Fly. Do not publish/download raw receipts or waitlist emails into GitHub issues. The waitlist count is unique opted-in addresses, not proof of paid demand, and is never joined to event IDs.

## Approval boundary

1. Review the exact candidate commit and privacy/consent language.
2. Create the owner suppression marker before installing any candidate on the owner's Mac. Keep qualification profiles isolated and suppressed.
3. Approve the endpoint deployment and app source-release publication explicitly. Existing tags stay immutable; 0.4.4 is the prepared follow-up version.
4. Deploy the existing marketing service with collector dependencies and `SPAMMISH_METRICS_ENABLED=yes` on its existing private volume; verify health, schema rejection, deduplication, retention, no access/payload logging, and backup policy. Qualification traffic must use isolated storage, never seed production activation.
5. Build/qualify the approved app version, commit/version it and publish the follow-up release. Consent defaults remain pending/off. No force-enable or automatic enrollment.
6. Confirm the owner install shows suppression, then report real opted-in receipts alongside GitHub's separate traffic window.

Until approval, local tests use only synthetic fixtures and loopback endpoints. No candidate events have been sent to production.

## Candidate qualification

- Application suite: 93 passing tests, including consent, persistence/reset, suppression, move/Rescue confirmation, deduplication, elapsed-time return milestones, failed and stalled network requests, and sanitized reporting.
- Website integration: 2 passing tests for disabled/enabled collector, private receipts, schema rejection, existing waitlist and website behavior.
- Actual loopback HTTP requests captured and inspected: only the four allowlisted payload fields; prohibited extra fields rejected. No production receipts sent.
- Source syntax checks and dependency audit pass; no credential-pattern findings in candidate files. No new dependencies.
- Unsigned arm64 Mac app built and launched with an isolated, suppressed profile and no bundled OAuth configuration. Existing owner connections were not used. Actual consent markup/renderer exercised in a local fixture for decline, enable and disable; fixture actions do not emit network telemetry.
- Remote Fly container build and disabled production deployment passed. The deployed image was exercised on Fly using an isolated temporary collector: schema rejection, duplicate suppression, private mode, persistence/restart and 84-day purge passed. Public website/health remain available; the public collector returns 404 while disabled. The production receipt file remains absent and the existing waitlist file is unchanged. See [0.4.4 qualification](acceptance-0.4.4.md).
- Classifier weights, threshold, protections and Gmail mutation semantics are unchanged. This qualification tests instrumentation against synthetic provider cases; it is not a new real-mail precision study.
