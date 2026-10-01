# Phase 1 release review — 0.4.0

**Spammish OSS 0.4.0 source release: qualified for publication.** See the [final acceptance record](acceptance-0.4.0.md). Public turnkey distribution is separate and remains outstanding.

This report is a review checkpoint, not a certification claim. No Chrome extension or Cloud service is implemented by this candidate. Source is MIT and free forever. The owner has authorized source publication after the acceptance and source-audit gates pass. No public production binary is included.

## What changed

- Kept the existing application/account engine, recoverable label operation, conservative protections, background lifecycle and multi-Gmail isolation.
- Compared available Etta rules and retained its narrow synthetic warmup detector and legitimate-mail protection principles. No proprietary workflow rules, digests or general inbox triage were copied.
- Added weighted, inspectable evidence and compounds, with a threshold of 70 and hard protective gates. The score is not a probability. Non-B2B unsolicited promotions/obvious spam may also qualify, as requested.
- Hydrates bounded relationship evidence on demand for candidate messages before an automatic move. Prior outbound and actual thread participation protect legitimate relationships. No Contacts access or exhaustive mailbox copy.
- Added explicit Abyss/Rescue/explain core methods and isolated exact-sender correction evidence. Gmail label changes provide feedback; Rescue retracts rejection, and later Abyss can retract protection. Own automatic moves never manufacture rejection evidence.
- Added one durable confirmed-move total, crash reconciliation and recent plain-English explanations with Rescue. Earlier desktop moves are not fabricated.
- Replaced the separate legacy server loop with the shared multi-account engine and encrypted account-state vault. Hardened loopback Host/Origin/CSRF checks and added a private local setup helper.
- Updated public setup, detection, contribution, privacy and security documentation.

## Verification completed

- 64 automated tests passed; source syntax checks passed for 30 files.
- Fresh separate source folder: dependency install, configuration generation, all tests and source checks passed. Browser startup showed the expected zero-account configuration page. This validates local setup/startup, not a fresh stranger's Google approval flow.
- Local unsigned arm64 desktop preview built and launched. Both existing authorized Gmail connections remained enabled. Counter and collapsed review empty state were inspected in the native app.
- Dependency audit reported zero vulnerabilities. Some build-tool transitive packages emit deprecation notices; this is not equivalent to zero maintenance risk.
- Targeted source/history scans cover private keys, Google credentials/tokens, GitHub tokens and common AI keys. Exact final counts/results are recorded in the release notes. No real account data is tracked. This is a targeted scan, not proof no possible secret exists.
- Gmail provider code has only bounded reads, label creation and message label modification; there are no send/reply/trash/delete operations. Automated tests verify only Inbox/Abyss labels change and unread/other labels survive.
- The current policy passed 27 controlled Gmail checks across the broader intended scope. See the acceptance record for injected failure boundaries and actual protected/moved categories. This is integration qualification, not measured accuracy.

## Distribution and evaluation work still open

1. **Controlled real-Gmail acceptance completed.** The final record contains 27 passing checks using two authorized mailboxes. Offline/401/acknowledgement-loss boundaries were injected and are labeled as such. A representative corpus, external SMTP delivery, fresh stranger onboarding and comprehensive native sleep/wake checks are not claimed.
2. **Accuracy evaluation.** We have no representative labeled mailbox corpus, measured false-positive rate or calibrated threshold. Do not claim perfect detection or a numerical accuracy rate. Conservative misses are expected; false positives remain possible.
3. **Public Google sign-in.** Obtain/document applicable approval for the maintainer's public OAuth registration. Gmail modify is restricted. Self-hosters can register their own personal/test client under Google's applicable exceptions; this is already documented. No approval evidence has been verified for the maintainer's app.
4. **Public Mac installer.** This machine has only an Apple Development signing identity. Supply a Developer ID Application identity and notarization credentials, build the reviewed source as signed/notarized universal artifact, inspect it and complete clean-Mac installer acceptance. The current preview is unsigned and not a public installer.

Google requirements: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [restricted-scope verification and exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). Instructions: [maintainer release guide](releasing.md).

## Privacy and operational limits

Only gmail.modify is requested. Google describes this scope broadly, including sending; the application has no sending implementation. OS encryption protects desktop refresh tokens; sensitive desktop metadata requires OS/disk protection. Server state uses a local AES-GCM vault key. Bodies are processed transiently and not retained or sent to any AI/maintainer. Review reads header metadata transiently. Feedback/counts/hashed receipts and bounded recent decision IDs are local. Disconnect removes the selected active account state and retains an aggregate count; backups are not forensically erased.

The computer and app/process must stay awake, online and running. Closing the desktop window leaves the menu-bar worker running; Quit stops it. Gmail delivers before polling, so a notification can appear before filtering. Quota errors back off and preserve progress; no design can prevent all future Google outages or throttling. Relationship queries add work, so large inbox cleanup can take time. External Gmail feedback requires available history; expired history cannot reconstruct every missed user action.

## Source publication

Publish the reviewed source commit and v0.4.0 tag after CI and the final source audit pass. Release notes must say source only, free forever, own Google OAuth configuration, no public production Mac installer. Do not upload the unsigned preview as a production binary. Turnkey distribution requires the Google/Apple/installer work above. Stop after the source release; Phase 2 and Cloud require the next explicit instruction.
