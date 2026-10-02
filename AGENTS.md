# Spammish: install and work safely

Spammish makes unwanted email disappear using deterministic local evidence and recoverable Gmail label changes. It has no AI runtime or AI API integration. Source is free forever under MIT.

## Installation contract

For an installation request, read **docs/desktop-install.md** first. On macOS, successful delivery means the actual locally built `Spammish.app` is available and launched, not just a terminal worker. Node 22.13+ (24 recommended), npm and internet are required; Apple Silicon and Intel build their native architecture. Linux uses the explicitly different browser worker in **docs/agent-install.md**. Windows desktop is unqualified.

Install dependencies with `npm ci`; prepare a user-owned Desktop OAuth client in ignored `desktop/oauth-client.json`; run desktop doctor; build the unsigned local app using the documented existing Electron builder; install/launch the exact artifact. A fresh app can build and launch without credentials. Connect Gmail then offers a native file picker for a user-owned Desktop OAuth JSON; no rebuild is required after import. Account authorization remains a separate human Google consent step. Preserve any existing installation/configuration and use the documented isolated profile for qualification, never a second worker on its account store.

BYO OAuth is intentional. Stop only for human Google ownership/login/MFA/consent or security decisions. Client configuration and account authorization are separate milestones. Desktop doctor checks prerequisites, not running/authorized status. Verify the process executable points to the intended app, its About version, and actual per-account On/error/recent-check state in the UI. Record separately installation, app creation, launch, OAuth configuration boundary, human consent and account health; never fabricate unexercised milestones. Use the install guide for tray/window-close versus Quit, updates and troubleshooting. No paid Google Workspace subscription or official Spammish OAuth is required. Client configuration stays separate from classification.

Never request a Google password, MFA code or Google session cookie, bypass OAuth consent/security warnings, print or commit secrets, upload mailbox contents, weaken controls, send mail, or fabricate successful authorization. `.env`, downloaded OAuth JSON, `data/`, and desktop account stores are private and ignored. Preserve existing vault keys and working connections. Never start a second worker against the same state file.

## Changes and verification

Keep the published core deterministic; no AI API integration or maintainer-funded service. Uncertain/incomplete mail stays in Inbox. Hard relationship/transactional/Rescue protections override scores. Scores are not probabilities. Preserve unread and all labels except Inbox/The Abyss. No send, reply, trash, deletion, unsubscribe or message-link fetching.

The shared core lives in lib/desktop-agent.mjs, lib/desktop-accounts.mjs, lib/gmail-agent.mjs and lib/spammish-policy.mjs. Use the shared Abyss/Rescue/explain methods in new interfaces; do not create a second filtering loop. Add synthetic tests for both positive cases and legitimate lookalikes. Read docs/detection.md, PRIVACY.md and SECURITY.md before consequential changes. Run npm test, npm run check and npm audit when asked to qualify a change/release. Do not commit real email or private acceptance artifacts.

Phase 1 is the source release. Preserve existing desktop/marketing work. Do not build the Chrome extension, Cloud, or new infrastructure unless explicitly requested.

## Tuning a user's installation

Read **docs/tuning.md** and **docs/detection.md** before proposing an aggressiveness change. `lib/spammish-policy.mjs` owns `COLD_SCORE_THRESHOLD` (default 70), literal `add(...)` evidence weights, signal patterns, corroboration and hard protective gates. `lib/desktop-agent.mjs` owns automatic candidate screening and account-local corrections; `lib/gmail-agent.mjs` owns bounded inspection and relationship queries. These are source edits, not configuration/settings knobs.

Inspect sanitized real decision evidence before tuning. Distinguish screening, incomplete content, missing context, hard protection and score misses; never change weights blindly or compensate for upstream failures by lowering a cutoff. Received mail is familiarity, not reciprocity; bulk/unsubscribe headers do not prove unwanted mail. Preserve relationship, security/transactional, Rescue, recovery, unread and account-isolation invariants. Do not upload mailbox contents to a coding agent or commit private evidence. A coding agent can explain sanitized scores and feature codes without receiving the original email.

For an explicitly requested personal tuning change, make the smallest source edit in that user's checkout, document its risk, and test both the pure policy and the full worker pipeline. Run `npm test` and `npm run check`; include recruiter, customer-inquiry, legitimate first contact, relationship/thread, subscribed, transactional/security and correction counterexamples. Follow docs/tuning.md for restart/recheck behavior. Do not change the official defaults during a documentation pass or silently publish personal policy changes upstream. Keep the AI builder separate from the deterministic runtime; no AI API integration is needed.

## Optional AI in a personal fork

Read docs/tuning.md#optional-ai-in-your-own-fork. The official runtime has no AI API or provider/key configuration. A user can implement inference in their fork; that is development, not enabling a shipped setting. Explicitly explain any mailbox transmission, provider retention/security and usage costs before such work. Do not upload mail, add API keys, or implement inference during an installation/documentation qualification. Preserve the default deterministic pipeline.
