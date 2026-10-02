# Source delivery qualification

October 2, 2026. Application version **0.4.2**. This pass changes installation/public documentation and marketing waitlist consent/copy, not the application runtime or classifier. Published tags remain unchanged.

## Fresh agent

An independent coding agent used only a fresh checkout and the public README installation instruction on macOS arm64, Node 26.9.0. It discovered AGENTS.md and the desktop guide, installed dependencies, built the real unsigned `Spammish.app`, and launched that exact executable with an isolated empty private profile. Bundle version was 0.4.2; actual UI showed Not connected, zero moves and unavailable Connect without client configuration. No hidden maintainer client or mailbox state was supplied.

| Milestone | Result |
| --- | --- |
| Repository understood / dependencies installed | PASS |
| Local desktop app created / exact executable launched / UI inspected | PASS |
| Human Google client-configuration boundary identified | PASS |
| Fresh Google user consent | NOT EXERCISED |
| Fresh connected-account health | NOT EXERCISED |

Desktop doctor correctly reported missing client and readiness false. About dialog interaction could not be verified through the UI automation tool; bundle metadata and exact running executable identified the artifact. The repo-only agent also correctly explained conservative threshold 70, screening versus scoring, protected counterexamples, personal source tuning/rebuild/recheck, and that LLM augmentation is personal development with different privacy/cost properties—not a shipped setting.

## Manual checkout and checks

A separate clean checkout followed the documented `npm ci`, desktop doctor and unsigned app build commands on macOS arm64. Dependencies installed and `Spammish.app` was created; doctor correctly stopped at missing user-owned Google configuration. The checkout remained clean. All 72 application tests, the separate waitlist qualification test and 33 source syntax checks passed; dependency audit reported zero vulnerabilities. Targeted changed-file secret/private-account patterns and relative documentation links passed. Source diff confirmed no classifier, Gmail/account engine, desktop runtime or package metadata changes.

## Waitlist

The README destination is https://spammish.fly.dev/#cloud (existing anchor retained). The deployed page distinguishes current OSS from a future easier experience without promising a format, price or date. A clearly synthetic example.com signup was submitted through the actual form; success was visible and its record verified on `/data/spammish/spammish-waitlist.jsonl` without displaying other entries. Duplicate submission retained one record. File permissions remained private. No production entries were rewritten or removed. The identifiable qualification record is retained as test data; operator cleanup requires controlled maintenance to avoid racing the live writer.

Local UI validation rejected malformed input. A genuine local file-permission write failure returned 503, displayed the saving error and re-enabled submission. Automated waitlist tests cover input/consent validation, origin rejection, persisted v2 consent, preservation of legacy consent, duplicates and write failure. Existing Cloud-launch entries retain their original purpose; duplicate signup does not silently expand consent.

## Limits

This proves builder-oriented macOS source delivery through the human boundary, not frictionless Google onboarding or a signed/notarized consumer installer. Intel builds are supported by the existing builder but were not exercised here. Linux has an explicitly different browser-worker path; Windows desktop is unqualified. Gmail/classifier acceptance from earlier releases is not relabeled as a fresh end-to-end OAuth test. The threshold, weights, protections and Gmail mutation code were unchanged.
