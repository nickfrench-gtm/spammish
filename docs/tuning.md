# Conservative by default. Yours to tune.

Spammish ships a conservative deterministic policy. It favors precision over recall: leaving some unwanted mail behind is preferable to moving important mail. **Tuning is optional.** The default works without policy edits after installation and Gmail connection.

Your MIT-licensed installation is yours to inspect and modify. Today, tuning means **editing source and restarting/rebuilding your own installation**. There is no threshold settings screen, environment-variable override, policy DSL or plugin system. Modified versions are their operators' responsibility; the MIT warranty/liability terms apply.

## Find the actual controls

| Surface | Source location | Scope |
| --- | --- | --- |
| Automatic Abyss threshold | `COLD_SCORE_THRESHOLD` in [lib/spammish-policy.mjs](../lib/spammish-policy.mjs) | Default **70**; source constant, not an environment variable |
| Evidence weights | Literal point arguments to `add(code, family, points, present)` in the same file | Positive, protective and declared compound bonuses |
| Commercial/CTA and other text signals | Regex definitions and `signals` in the same file | Changes require code and counterexamples |
| Corroboration and hard protections | `sufficient`, `protectedReason`, `unansweredSequence` and `divert` in the same file | Advanced policy modification; arithmetic alone does not override these gates |
| Automatic candidate admission | `inspectAndMove` in [lib/desktop-agent.mjs](../lib/desktop-agent.mjs) | Initial score ≥30, obvious spam/warmup, CTA with cold subject/opening, or stored exact-sender rejection; incomplete/important/subscription mail and Rescue remain protected |
| Relationship and sequence evidence | `relationshipEvidence` in [lib/gmail-agent.mjs](../lib/gmail-agent.mjs) | Bounded Gmail queries; prior solicitation currently checked within a thread with reply headers, not across arbitrary separate threads |
| Inspection limits | `extractMessage`, `fullMessage` and response reader in the same file | 12,000 usable body characters, 256 KiB per text part, 2 MiB API response and a bounded MIME field projection; oversized/missing content stays in Inbox |
| Abyss/Rescue corrections | `abyssMessage`, `rescueMessage`, reconciliation and sender maps in `lib/desktop-agent.mjs` | Narrow account-local feedback; preserve credential/state isolation and recovery |
| Recheck marker | `POLICY_VERSION` in `lib/spammish-policy.mjs`; constructor in `lib/desktop-agent.mjs` | Default 2; a changed marker schedules an Inbox recheck while preserving pause/connections/cooldown |

Internal “cold” names remain for compatibility. Public terminology is **Spammish Score**. See [detection.md](detection.md) for the whole pipeline and limitations.

## Read a score before changing it

A score is a deterministic evidence sum, clamped to 0–100. **76 is not a 76% probability.** Automatic diversion requires an admitted candidate, sufficient corroboration, a score ≥70 and no hard protection. Explain can assess a message that automatic screening never admitted.

Major positive weights in the current source:

| Evidence | Points |
| --- | ---: |
| Unknown sender / unknown domain | +10 / +8 |
| Verified no prior outbound | +8 |
| Cold opening / business pain / value proposition | +8 / +7 / +8 |
| Commercial category / meeting CTA | +15 / +15 |
| Social proof / cold subject | +6 / +8 |
| Calendar URL / tracking URL / bulk-list headers | +8 / +4 / +5 |
| Verified unanswered follow-up | +15 |
| Prior sender Spam / explicit sender rejection / repeated private-domain Spam | +50 / +50 / +30 |

No-prior-reply is +5 only when no-prior-outbound is not also counted. Fake-looking reply subjects get +30 only with verified novelty/no-outbound and absent reply headers. Narrow obvious-spam and exact warmup signals carry +100 with their own sufficient-evidence path.

Declared compounds add +25 for a cold sales pattern, an **alternative** +25 for an unreciprocated bulk invitation, +35 for automated personalized outreach, or +40 for verified commercial follow-up. They reuse constituent signals as heuristic bonuses, not independent observations. The two +25 alternatives never stack; existing follow-up can include both +15 sequence and +40 compound evidence. Do not add another sequence bonus blindly.

**Familiarity is not a relationship.** Receiving previous mail removes the corresponding unknown-sender/domain points. It does not trigger a relationship gate. Actual outbound contact, user thread participation and other verified protections are separate evidence. A generic repeat count is not verified equivalent commercial solicitation.

**Bulk is not unwanted.** List-Unsubscribe and bulk headers contribute only +5 together, not +5 each. Legitimate subscriptions and valued updates can use the same infrastructure.

## Worked example: a recurring commercial invitation

Synthetic input, matching an existing regression case:

```js
const message = {
  from: 'offers@example.org',
  subject: 'Explore lead generation',
  body: 'Interested in learning about lead generation? Book a demo',
  headers: { 'list-unsubscribe': '<mailto:remove@example.org>' },
  links: { calendar: true },
};
const relationship = {
  senderSeen: true, domainSeen: true,
  outboundToSender: false, outboundToDomain: false,
};
```

| Evidence | Points |
| --- | ---: |
| No prior outbound | 8 |
| Commercial category | 15 |
| Meeting CTA | 15 |
| Bulk/list headers | 5 |
| Calendar URL | 8 |
| Corroborated unreciprocated bulk-invitation compound | 25 |
| **Spammish Score** | **76** |

This complete message passes screening and final corroboration, with no hard protection. Merely having received this sender's mail contributes no relationship protection. **Rescue protection keeps the same 76-point message in Inbox.** Verified outbound contact also keeps it in Inbox, through an existing-relationship gate and negative evidence.

Hard protections include incomplete content, transactional/security language, Rescue, prior outbound/reply, private-domain outbound/transactional relationship, user thread participation and subscription context. The pure policy also accepts a Contacts flag, but the shipped provider does not collect Contacts. Representative negative weights include prior outbound −60, participated thread −60 and important transactional language −80. These gates do not depend on the score falling below 70: making a negative weight smaller does not disable its hard protection.

## Expected personal tuning versus advanced changes

**Start with the threshold or one established evidence weight.** Edit the existing constant/literal in a personal fork, keep the safety gates, and compare sanitized decisions against legitimate lookalikes. A lower threshold can divert more *eligible* mail and increase false-positive risk; a higher threshold can leave more mail and reduce score-based diversions. Neither effect is a measured accuracy guarantee. Neither change bypasses screening, incomplete-content protection or relationship/security/Rescue gates. Changing a weight can also change the initial candidate score.

**Advanced changes** include new regex families, candidate admission, relationship/sequence query semantics, inspection budgets, hard protections and feedback scope. These require more than arithmetic. Do not casually weaken transactional/security protections, treat unsubscribe alone as unwanted, turn received history into a relationship, or broadly whitelist/blacklist a domain from one correction. Rescue retracts exact-sender rejection and protects that sender; automatic Abyss moves do not manufacture explicit rejection evidence.

Before tuning, ask where a miss happened:

1. Was the body complete under the inspection budget?
2. Did the worker admit it to candidate scoring?
3. Did relationship/context queries succeed?
4. Did a hard protection keep it?
5. Was evidence missing, or was sufficient evidence merely below the cutoff?

Do not lower a threshold to compensate for upstream recognition failures. The unshipped +15/+20 separate-thread proposal is **not** part of the default policy.

## Ask your AI builder

Give the repository to your coding agent, without private email bodies or credentials:

> Read AGENTS.md and docs/tuning.md. Using sanitized scores, evidence codes and protected reasons I provide, explain why mail survives. Propose the smallest personal policy change, preserve relationship/security/Rescue protections, and test legitimate counterexamples before applying it. Do not change upstream defaults or upload mailbox contents.

You can request a specific protection, such as “Keep recruiting outreach in my Inbox,” or ask about greater aggressiveness. The agent should inspect actual rules, explain tradeoffs and test the requested source change. This is development assistance, not an AI service processing your Gmail. Spammish remains deterministic software.

## Verify and activate a personal change

Use a separate checkout. Do not operate it as a second worker against the same account state.

```sh
npm ci --ignore-scripts
npm test
npm run check
```

Pure-policy cases are in `lib/spammish-policy.test.mjs`; full screening/movement/correction cases are in `lib/desktop-agent.test.mjs`, with provider and account-isolation coverage alongside them. Include legitimate first contact, recruiter, customer inquiry, prior outbound/domain/thread, subscribed mail, transactional/security, incomplete content, Abyss/Rescue, read/unread preservation and account isolation. Pure scoring tests alone do not qualify the automatic pipeline.

Use only consented read-only real evidence and sanitized outcomes to evaluate personal changes. Do not generate public fixtures from private mail, connect a stranger's Gmail, or turn evaluation into bulk mutations. Review The Abyss and Rescue mistakes; higher move counts alone are not success.

For the local browser worker, stop the existing process, update its source, and restart it. For desktop, rebuild your own development artifact using [development.md](development.md); a source edit does not update an already packaged app. Preserve vault keys, credentials and saved account state.

Restarting alone does **not** recheck messages already passed by an ongoing/completed sweep. If your personal policy needs a recheck, change `POLICY_VERSION` to a new value in your fork before restarting. This schedules/restarts a pass, can take time and consume Gmail quota, and preserves paused accounts. Don't change it on every launch. Keep a copy of your original source for rollback; restoring code does not undo Gmail moves. Rescue supplies recoverable correction.
