# Spammish: install and work safely

Spammish makes unwanted email disappear using deterministic local evidence and recoverable Gmail label changes. It has no AI runtime or AI API integration. Source is free forever under MIT.

## Installation contract

For an installation request, read **docs/agent-install.md** first. Follow its primary loopback-server path on macOS or Linux with Node 22.13+ (24 recommended). Do not reverse-engineer setup or use maintainer credentials. The desktop source path is optional, documented in docs/development.md.

Install dependencies, prepare private configuration, run doctor, start the local worker, and verify its `/health` boundary. BYO OAuth is intentional for the source release; Spammish requires no paid Google Workspace subscription. Client configuration is injected at startup and must remain separate from classification/corrections. Stop for human Google sign-in/consent and required Google account security/billing/legal interactions. OAuth client configuration and Gmail authorization are distinct. Do not call a stored connection verified unless doctor reports a recent successful check.

Never request a Google password, MFA code or Google session cookie, bypass OAuth consent/security warnings, print or commit secrets, upload mailbox contents, weaken controls, send mail, or fabricate successful authorization. `.env`, downloaded OAuth JSON, `data/`, and desktop account stores are private and ignored. Preserve existing vault keys and working connections. Never start a second worker against the same state file.

## Changes and verification

Keep the published core deterministic; no AI API integration or maintainer-funded service. Uncertain/incomplete mail stays in Inbox. Hard relationship/transactional/Rescue protections override scores. Scores are not probabilities. Preserve unread and all labels except Inbox/The Abyss. No send, reply, trash, deletion, unsubscribe or message-link fetching.

The shared core lives in lib/desktop-agent.mjs, lib/desktop-accounts.mjs, lib/gmail-agent.mjs and lib/spammish-policy.mjs. Use the shared Abyss/Rescue/explain methods in new interfaces; do not create a second filtering loop. Add synthetic tests for both positive cases and legitimate lookalikes. Read docs/detection.md, PRIVACY.md and SECURITY.md before consequential changes. Run npm test, npm run check and npm audit when asked to qualify a change/release. Do not commit real email or private acceptance artifacts.

Phase 1 is the source release. Preserve existing desktop/marketing work. Do not build the Chrome extension, Cloud, or new infrastructure unless explicitly requested.
