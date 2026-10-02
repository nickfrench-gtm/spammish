# Deterministic detection and corrections

## Pipeline

Gmail Inbox message → bounded local text/header/URL features → candidate screening → bounded mailbox relationship queries for admitted candidates → weighted evidence and hard protections → recoverable label change.

No model, AI agent service, Codex session or AI API key runs this pipeline. The application is the worker. It must remain running on an awake, online computer. Both desktop and loopback server share the same engine.

## Evidence implemented

| Family | Observable evidence |
| --- | --- |
| Relationship | Exact-sender/private-domain received mail; prior outbound including replies; sent messages in the thread; prior transactional messages from the private domain |
| Rejection | Gmail Spam-labeled mail from the sender or repeated mail from a private domain; explicit or externally observed Abyss correction |
| Language | Cold opening/personalization, pain-point fishing, value proposition, commercial category, agency/service offers, social proof, numeric outcomes, meeting/demo CTA and cold subject |
| Sequence | Follow-up language plus a prior complete commercial solicitation, no sent message in the thread and no prior outbound to sender |
| Structure | List-Unsubscribe/Precedence headers; calendar URL; tracking/redirect/recipient parameter patterns inspected locally |
| Protection | Prior outbound, actual thread participation, rescued sender, known transactional/private-domain relationship, important transactional/security/support/developer notification language, incomplete content and subscription context |
| Obvious noise | Narrow scam patterns and the exact terminal WBX + three-letter warmup marker |

There is no Contacts permission, deletion-history inference, external reputation service, DKIM validation or proof of subscription intent. Contacts can be represented by the pure policy interface but the shipped provider does not collect them. Unknown evidence contributes zero. Shared consumer domains such as gmail.com never acquire domain-wide reputation/protection. Gmail Spam labels do not prove a user reported spam.

## Spammish Score and disposition

`lib/spammish-policy.mjs` is the authoritative weight table. The public label is **Spammish Score**. Score is the evidence sum clamped to 0–100, with a current threshold of **70**. It is a rule score, not a calibrated probability. Positive features must corroborate across at least three distinct signal families and include a CTA or rejection evidence. Narrow obvious-spam/warmup detectors have their own sufficient-evidence path.

Examples: unknown exact sender +10, unknown private domain +8, no prior outbound +8 (the same lookup never also adds no-reply points), meeting CTA +15, commercial category +15, cold opening +8, commercial headers +5, tracking +4. Compound patterns add +25 for a cold sales sequence, +35 for automated personalized outreach, and +40 for verified unanswered commercial follow-up. These compounds are deliberately inspectable, not independent statistical observations.

Prior outbound/replies, rescued senders, established threads, important transactions and other hard protections defeat a high score. A fake-looking Re: subject gets additional weight only with corroborated first-contact/no-outbound evidence and no reply-reference headers. First contact, a tracked newsletter or a sales word alone never suffices.

The engine can also divert corroborated unsolicited consumer promotions and obvious spam. A subscription-context marker protects newsletters. It does not indiscriminately remove every promotion or newsletter.

These weights pass synthetic regression cases; they have **not** been calibrated against a representative real mailbox corpus. False positives and missed mail remain possible. A failed relationship lookup prevents moving the candidate. Oversized/truncated content remains in Inbox.

## History and initial cleanup

Connection starts one paginated Inbox discovery pass, then processes bounded batches. Sent, Draft, archived, incomplete and uncertain messages are excluded. Candidate relationship evidence is hydrated on demand from Gmail, not from a retained mailbox copy. New-mail history is checkpointed; interrupted batches resume. Google throttling produces a persisted exponential cooldown. Expired Gmail history pauses and requires Turn on for a fresh pass. Policy version upgrades schedule one new Inbox pass; paused accounts remain paused.

## Abyss, Rescue and explanations

Automatic Abyss adds only The Abyss and removes only Inbox. Rescue adds Inbox and removes only The Abyss. Neither changes unread state, sends mail, trashes or deletes it.

Review filtering shows recent move reasons and Rescue. Explicit core APIs `abyssMessage`, `rescueMessage`, and `explain` let another interface reuse those semantics. The loopback server also exposes these behind local session/CSRF protection. Gmail Move to → The Abyss for previously unrecorded mail supplies narrow exact-sender rejection; returning a recorded message to Inbox supplies exact-sender protection. Another client's action cannot be attributed to a particular person. Changes are observed while enabled or when processing resumes within available Gmail history.

Abyss raises future exact-sender rejection evidence; it is not a permanent domain block. Rescue removes that sender's rejection and strongly protects it. A later explicit Abyss can retract that protection. Automatic filtering does not manufacture rejection evidence from its own moves. Feedback is isolated by account, deterministic and local.

The single counter counts confirmed app moves, including explicit Abyss, once per retained message receipt. A lost response is reconciled against Gmail labels after restart. Gmail moves performed independently are not counted as app moves. Rescue does not subtract from the lifetime total. Disconnect retains only the account's aggregate contribution. The desktop counter starts at this update; older moves are not inferred. The bounded ledger holds 50,000 receipts; very old messages beyond retention may be counted again if explicitly moved later. Recent explanations retain only the last 50 decision records; older messages can be explained using their **current** evidence, which may differ from historical evidence.

## Conservative tradeoffs

The protection vocabulary is deliberately broad: invoice, delivery, security and subscription language can keep unwanted mail in Inbox. It is textual evidence, not proof of legitimacy or subscription intent. Compounds reuse constituent cues as declared heuristic bonuses; they are not independent observations. Novelty, bulk headers and tracking alone cannot divert mail. An ordinary social notification has no special rejection rule. Inspect current evidence or apply a narrow Abyss correction rather than assuming every unwanted category is caught.

## Candidate screening limits

Before relationship queries and stored sender rejection are applied, the worker admits messages with an initial score of at least 30, an obvious-spam/warmup marker, or a CTA paired with a cold subject/opening. Incomplete content, subscription context and important-mail guards stay protected. An exact-sender rejection does not bypass this screening or the final corroboration requirements. Ordinary social notifications may therefore remain in Inbox even after feedback. A score shown by Explain is a current assessment; it does not imply the message was admitted by automatic screening.

Initial discovery collects all Inbox IDs before inspection, then processes resumable batches. The temporary ID list grows with mailbox size; only per-request and per-batch work is bounded. It is discarded when the sweep finishes.
