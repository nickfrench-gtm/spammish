<img src="marketing/assets/abyss-mark.png" width="80" height="80" alt="Spammish Abyss vortex">

# Spammish

## Make unwanted email disappear.

Your inbox has Spam. **Spammish has The Abyss.**

Spammish watches Gmail and moves mail that earns enough **deterministic, explainable evidence** to **The Abyss**. Cold outreach, unwanted promotions, obvious spam and other qualifying automated mail. Real relationships and important legitimate mail receive strong protection.

Wrong decision? **Rescue it.** The message returns to Inbox and Spammish records a narrow, local correction.

**Free forever. Open source. MIT. No AI API.**

**[Use the open-source app now](#install-with-your-ai-builder)** · [Want easier setup? Join the waitlist](https://spammish.fly.dev/#cloud)

Give the repo to your AI builder. Get the real local app. Connect Gmail.

## Install with your AI builder

Give [this repository](https://github.com/nickfrench-gtm/spammish) to Codex, Cursor or another capable coding agent:

> Clone https://github.com/nickfrench-gtm/spammish, read AGENTS.md, and install the real local Spammish app for my platform. Handle everything you safely can; stop only for Google ownership, authorization or security steps that require me. Verify the intended app is running, preserve existing credentials, and never print secrets.

The repo includes [AGENTS.md](AGENTS.md), a [step-by-step installation contract](docs/agent-install.md), `setup`, `doctor`, and a macOS desktop app and an alternative browser worker. The AI builder helps install it; **it does not need to stay running**.

**Spammish 0.4.3 is an agent-native source release with intentional BYO Google OAuth.** Your builder helps configure your client; you complete Google sign-in and consent. Spammish requires no paid Google Workspace subscription. A simpler Spammish-managed authorization flow is planned, with no date or approval promised. Signed/notarized consumer installers are not included.

## Manual install

Primary path: **macOS desktop app**, Apple Silicon or Intel, Node **22.13+** (24 recommended). This builds the real menu-bar application locally, without a signed consumer installer.

```sh
git clone https://github.com/nickfrench-gtm/spammish.git
cd spammish
npm ci
```

Create your own **Desktop app** Google OAuth client with Gmail API enabled. Save its downloaded JSON privately. You can import it in the app through **Connect Gmail**, without rebuilding. Alternatively, save it as `desktop/oauth-client.json` (ignored by Git) to include it in your own local build. Then:

```sh
npm run doctor -- --desktop
SPAMMISH_PREVIEW=1 CSC_IDENTITY_AUTO_DISCOVERY=false node node_modules/electron-builder/cli.js --mac --dir
```

Open the generated `dist/mac-arm64/Spammish.app` (Apple Silicon) or `dist/mac/Spammish.app` (Intel). You can copy it to `~/Applications`. Connect Gmail and complete Google's consent yourself. Desktop doctor checks prerequisites; account health is verified in the actual app. **[Complete desktop install, Google configuration, verification and updates](docs/desktop-install.md).**

Linux users can use the [local browser worker](docs/agent-install.md), with the same core policy but different startup/lifecycle and a **Web application** OAuth client. Windows desktop installation is not qualified.

## What it does

- Checks the existing Inbox on connection, then polls new arrivals. Cleanup resumes after interruptions.
- Supports multiple Gmail accounts with isolated credentials, history, corrections and Pause/Disconnect controls.
- Moves qualifying messages to the recoverable **The Abyss** label, removing only Inbox. Read/unread state and other labels remain unchanged.
- Shows one lifetime total: confirmed emails sent to The Abyss, with recent scores, outcomes and reasons visible under Recent decisions. Older desktop moves are not guessed.
- Implements no sending, replying, trashing, deletion, link clicking, unsubscribing, summaries or general inbox dashboard.

## How it works

Inbox checks → candidate screening → mailbox relationship evidence and corrections → **Spammish Score** plus protective gates → Inbox or The Abyss.

Evidence includes sender/domain familiarity, prior outbound communication, actual thread participation, commercial/promotional language, outreach CTAs, verified unanswered sequences, bulk headers, locally inspected tracking/calendar URLs, Spam-labeled history and explicit corrections.

**Spammish Score is a rule total, never a percentage.** Current automatic threshold: **70**, with corroboration requirements and hard protections. Existing relationships, important transactional/account messages, Rescue feedback and incomplete content can keep a message in Inbox even with a high score. **Score ≠ probability.** [Inspect the model and limitations](docs/detection.md).

This is broader than a B2B-only filter, but it is not a blanket category cleaner. A social-network notification, newsletter or promotion does **not** qualify merely because of its category. Legitimate subscription context is protected. Automatic candidate screening is intentionally narrower than every possible unwanted category. Exact-sender rejection is considered before candidate screening; it still needs sufficient evidence and cannot override hard protections. Other messages need sufficient supported evidence; conservative misses are intentional. Spammish does not know your preferences magically.

## Conservative by default. Yours to tune.

Spammish favors precision over recall: some unwanted mail surviving is preferable to an important message disappearing. The default Abyss threshold is **70**, with corroboration requirements and hard protections.

**You do not need to tune anything to use Spammish.** Connect Gmail after setup and let the default policy run.

For builders, the deterministic policy is MIT-licensed source you can inspect and change. Tune the threshold, adjust evidence weights, or change the rules in your own installation. These are **source edits**, not app settings or environment variables. Your inbox. Your Spammish.

[Read the tuning guide](docs/tuning.md) for exact code paths, a worked score, safety boundaries and verification steps. Changing a cutoff will not bypass candidate screening or hard protections.

## Does it need AI?

No. The coding agent installs the software; it can close afterward. Spammish runs its own deterministic worker. No AI key or inference service is needed.

You can add an LLM to **your own fork**, but there is no supported plug-and-play provider integration. External inference can transmit email data to another provider and changes your fork’s privacy, security and costs. [Personal AI augmentation boundaries](docs/tuning.md#optional-ai-in-your-own-fork).

## The Abyss and Rescue

Gmail has Inbox and Spam. Spammish adds a recoverable destination for mail its own evidence model says should leave normal Inbox attention; Gmail does not have to call it spam.

**Abyss:** move missed unwanted mail to The Abyss in Gmail while Spammish is enabled. This records narrow exact-sender rejection evidence. The core exposes an explicit Abyss method as well.

**Rescue:** use Recent decisions → Rescue, or move a recorded message back to Inbox. It retracts that sender's rejection and strongly protects it. A later explicit Abyss can supersede that protection. One correction never blocks or whitelists an entire domain. Own automatic moves do not reinforce themselves as explicit rejection.

## Why Spammish

Local, deterministic, explainable and correctable. No AI bill, maintainer-funded classifier, telemetry, paid gate or subscription. The published MIT source is free to use and modify without a Spammish subscription; forks can extend it at their operators' responsibility.

It started with B2B cold email: “It isn't technically spam. We don't care.” That remains an example of the larger purpose: **make unwanted email disappear**.

## Privacy and permissions

Bodies are inspected transiently on your machine. Attachments and remote images are not fetched; message URLs are never visited. No mailbox content is sent to an AI provider or maintainer. Local state retains credentials, checkpoints, counts, narrow hashed feedback/receipts and bounded recent decision records, not bodies. Desktop tokens use OS encryption; the browser worker encrypts its saved state with a private local vault key. Protect your machine and key.

Only **gmail.modify** is requested. Google's grant technically permits broader operations, including sending. Spammish implements no send/reply/trash/delete operation. Do not confuse a code boundary with a narrower OAuth capability. [Privacy](PRIVACY.md) · [Security and private reporting](SECURITY.md).

## Limitations and verification

Keep Spammish running on an awake, online computer. Closing the browser is fine; stopping Node stops filtering. The desktop window can close while its menu-bar worker remains running; Quit stops it.

Gmail delivers before Spammish polls, so mail or notifications may appear before filtering. Large inboxes take time, and Google throttling can delay checks. No claim of perfect detection, complete spam coverage, calibrated probability or numerical accuracy is made.

[0.4.2 correction evidence](docs/acceptance-0.4.2.md) and [0.4.1 qualification](docs/acceptance-0.4.1.md) and [0.4.0 Gmail acceptance record](docs/acceptance-0.4.0.md): controlled real-Gmail integration, existing-mail observations, and explicitly labeled injected failure/recovery boundaries. This is not a representative accuracy benchmark or public installer certification.

```sh
npm test
npm run check
npm audit
```

## Contributing and license

[Contributing](CONTRIBUTING.md) · [MIT License](LICENSE) · [Maintainer release guide](docs/releasing.md). Bundled Manrope font retains its [SIL Open Font License](marketing/assets/FONT-LICENSE.txt); [brand provenance](marketing/assets/PROVENANCE.md) is documented separately.

These descriptions apply to the published default source. Third-party modifications are their authors'/operators' responsibility; see the license's warranty and liability terms. Please use synthetic examples in issues, never private mail or credentials.

Prefer easier setup? [Join the existing waitlist](https://spammish.fly.dev/#cloud). It is interest in a future easier experience, not a service available today; no format, price or date is promised.
