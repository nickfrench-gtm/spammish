# Spammish OSS 0.4.0 acceptance record

Date: October 1, 2026. **Controlled Gmail integration: PASS (27 checks).** This is source-release qualification, not accuracy certification or a turnkey installer claim.

## Scope and method

Two previously authorized Gmail accounts were used. Clearly marked synthetic fixtures were imported only into those mailboxes using a separate local diagnostic harness. No email was sent. Real Gmail stored and threaded the messages; the published DesktopAgent, relationship provider, scoring policy, label mutations and correction methods performed the checks. An isolated OS-encrypted acceptance store kept test feedback and counters separate from normal dogfooding state. Discovery/history were restricted by the harness to fixture IDs, with real paginated Gmail responses. This avoids moving unrelated private mail during the controlled run.

The final successful run used 21 fixtures. They were archived under a clearly marked acceptance label afterward, preserving recoverability. Synthetic Sent-history fixtures remain explicitly marked and inspectable; Gmail rejected removing its Sent system label. Nothing was deleted. Two earlier 14-fixture runs also left archived, marked fixtures (49 fixtures total). No private account IDs, sender addresses, subjects, message IDs, credentials or email bodies are published here.

Gmail method reference: [mailbox-only import, which does not send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/import). The diagnostic importer is not part of the shipped application.

## Controlled cases

| Case | Expected / tested behavior | Actual score, gate or action | Result |
| --- | --- | --- | --- |
| clear cold | Unknown sender/domain + commercial proposition + meeting CTA → Abyss | actual: The Abyss; score: 100; reason: corroborated_unwanted_outreach; evidence: unknown_sender (+10), unknown_domain (+8), no_prior_outbound (+8), cold_opening (+8), value_proposition (+8), commercial_category (+15), meeting_cta (+15), cold_subject (+8), cold_sales_sequence (+25) | PASS |
| legitimate first contact | New human sender asking a noncommercial question → Inbox | actual: Inbox; score: 26; reason: insufficient_confidence; evidence: unknown_sender (+10), unknown_domain (+8), no_prior_outbound (+8) | PASS |
| reciprocal sales language | Established reciprocal discussion with sales vocabulary → Inbox | actual: Inbox; score: 0; reason: existing_relationship; evidence: value_proposition (+8), commercial_category (+15), meeting_cta (+15), prior_outbound (-60), existing_thread (-60) | PASS |
| prior outbound | User-outbound history protects later sales-sounding response | actual: Inbox; score: 0; reason: existing_relationship; evidence: value_proposition (+8), commercial_category (+15), meeting_cta (+15), prior_outbound (-60) | PASS |
| thread participation | New sender joins a Gmail thread containing Sent history → Inbox | actual: Inbox; score: 0; reason: existing_thread; evidence: unknown_sender (+10), unknown_domain (+8), no_prior_outbound (+8), value_proposition (+8), meeting_cta (+15), existing_thread (-60) | PASS |
| unanswered sequence | Prior solicitation, no Sent reply, follow-up CTA → Abyss | actual: The Abyss; score: 100; reason: corroborated_unwanted_outreach; evidence: no_prior_outbound (+8), value_proposition (+8), commercial_category (+15), meeting_cta (+15), unanswered_followup (+15), sequenced_followup (+40) | PASS |
| transactional | Receipt/payment context overrides a call CTA → Inbox | actual: Inbox; score: 0; reason: transactional_message; evidence: unknown_sender (+10), unknown_domain (+8), no_prior_outbound (+8), meeting_cta (+15), known_transactional_relationship (-30), transactional_message (-80) | PASS |
| weak unsolicited before feedback | Weak commercial message without CTA → Inbox | actual: Inbox; score: 41; reason: insufficient_confidence; evidence: unknown_sender (+10), no_prior_outbound (+8), value_proposition (+8), commercial_category (+15) | PASS |
| obvious spam | Evidence-based disposition; protective gates override score | The Abyss; Spammish Score: 100; obvious_spam | PASS |
| unsolicited promotion | Evidence-based disposition; protective gates override score | The Abyss; Spammish Score: 89; corroborated_unwanted_outreach | PASS |
| social notification without rejection | Evidence-based disposition; protective gates override score | Inbox; Spammish Score: 26; insufficient_confidence | PASS |
| legitimate newsletter | Evidence-based disposition; protective gates override score | Inbox; Spammish Score: 89; subscription_context | PASS |
| security account mail | Evidence-based disposition; protective gates override score | Inbox; Spammish Score: 0; transactional_message | PASS |
| unanswered promotional sequence | Evidence-based disposition; protective gates override score | The Abyss; Spammish Score: 100; corroborated_unwanted_outreach | PASS |
| initial cleanup | Discover bounded fixture Inbox pages; only qualifying mail moves; all other labels/unread survive | unreadPreserved: True | PASS |
| automatic not explicit | Automatic moves must not create explicit rejection evidence | Verified against state/assertions; see scope below | PASS |
| explicit abyss | Explicitly reject the weak fixture; move it and increase only exact-sender evidence | reason: corroborated_unwanted_outreach; beforeScore: 41; afterScore: 91; unreadPreserved: True | PASS |
| multi account feedback isolation | Same sender/message pattern in account B receives no account A rejection | otherAccountScore: 49 | PASS |
| rescue | Restore Inbox; retract rejection; protect exact sender, not unrelated domain peer | reason: rescued_sender; unreadPreserved: True | PASS |
| abyss after rescue | Explicit rejection supersedes narrow protection; no duplicate count | score: 91; counterCountsOnce: True | PASS |
| new arrival history | Import after the sweep; process the real new Gmail history event | Verified against state/assertions; see scope below | PASS |
| restart persistence | Reopen encrypted acceptance store; preserve count and sweep progress | Verified against state/assertions; see scope below | PASS |
| temporary offline injection | Inject provider 503; keep progress and count | Verified against state/assertions; see scope below | PASS |
| offline recovery | Restore real Gmail provider; refresh token and resume without duplicate count | Verified against state/assertions; see scope below | PASS |
| lost ack restart reconciliation | Lose acknowledgement after real label mutation; restart, reconcile once | Verified against state/assertions; see scope below | PASS |
| authorization loss injection | Inject provider 401; truthfully pause with reconnect required | Verified against state/assertions; see scope below | PASS |
| disconnect isolation | Disconnect acceptance account A with revocation unavailable; remove local state without changing B | realGoogleGrantRevoked: False | PASS |

**Failure boundaries:** 503/401 and the acknowledgement loss were injected; we did not deliberately disconnect the network or revoke the owners’ real Google grants. Label mutations, token refresh, persisted-state reload and reconciliation used real Gmail. New arrival used Gmail mailbox import/history, not external SMTP delivery. Native sleep/wake and a fresh stranger’s OAuth registration were not exhaustively exercised; the existing automated suite covers relevant lifecycle/OAuth paths.

## Existing private-mail observations

The final policy was also applied read-only to 24 bounded, targeted existing messages across the two accounts, excluding acceptance fixtures and mail received after the test cutoff. Search families were commercial language, introductions/questions, conversations, receipts and follow-up subjects, plus recent recorded moves. This is a targeted sample, not a representative corpus or independent owner-labeled truth set.

Observed hard protections kept outbound/private-domain and transactional cases in Inbox. Several commercial/follow-up-looking messages stayed below threshold; reference-bearing follow-ups without verified prior solicitation stayed protected. Existing non-B2B promotion matches depended on sender Spam evidence plus commercial cues; a Spam label does not establish who rejected a message or prove it was unsolicited. Those observations do not establish a false-positive rate.

A borderline previously moved message scored 70 with duplicate no-outbound/no-reply points. After deduplication it scores 65 and would remain in Inbox on a fresh evaluation. Past label moves are not silently undone by changing a policy; Rescue remains available. A stronger unknown-sender commercial pitch remained above threshold.

## Classifier review / corrections

- **Fixed duplicate evidence:** absence of outbound mail implied absence of replies. That single observation now contributes once, not twice. Positive outbound/reply protection is likewise not duplicated when both describe one fact.
- **Precision preserved:** threshold stays 70; missing CTA/context is not compensated by lowering it. New-sender/domain evidence alone totals 26 with the outbound absence and stays in Inbox.
- **Compound scores remain deliberate heuristic bonuses**, not independent statistical observations. Hard relationship and transactional protections override them. There is no probability or numerical accuracy claim.
- **Sequence evidence requires actual context:** the successful controlled follow-up contained real Gmail references/threading, a complete prior solicitation and no Sent participation. Follow-up language alone does not prove that history.
- **Corrections remain narrow and reversible:** exact sender only; later Abyss can supersede Rescue. No global domain blacklist or whitelist was learned.

## Harness findings

The first controlled run failed recovery because its fixture router identified an account by an access token; refresh changed the token. This was corrected to resolve the account by authenticated Gmail profile. The production provider has no such fixture router. The cleanup request also initially included the immutable Sent label and was rejected by Gmail; all fixtures were subsequently archived by removing only Inbox/Abyss. The corrected 14-fixture run passed 21 checks; the expanded 21-fixture run passed all 27 checks. These failed attempts are recorded rather than discarded as favorable results.

## Source-release verification

64 automated tests passed, including the deduplication regression. All 30 source syntax checks passed. A clean Git clone installed dependencies, generated configuration, passed all 64 tests and the dependency audit (zero vulnerabilities), started the loopback worker and reported its actual state through doctor. The targeted scan found no credentials/private-account matches in 70 source files and 190 historical blobs before integrating the owner’s README-only update. Final history is rescanned before publication. The source setup guide explains own Google registration, awake/online runtime requirements and notification-before-filtering limits.

Public signed/notarized Mac binary and maintainer-hosted frictionless OAuth are forthcoming distribution work. They are not shipped by 0.4.0. Phase 2 and Cloud are not implemented.

## Installation acceptance

A separate coding agent received only the repository and the install request in a fresh source directory without maintainer configuration. It installed dependencies, generated a private vault configuration, started the loopback service and verified health/doctor. It correctly stopped at the human Google Cloud/OAuth boundary without claiming Gmail authorization. Own Google configuration and consent remain required. Manual fresh-source installation independently passed the same documented boundary. Both paths were verified at source commit 21029e95c0b9b1c571151cc6b275aeac3b15ccff; subsequent integration changes only release documentation and reconciles the owner’s README wording with the current broader product definition. No Gmail authorization was fabricated.
