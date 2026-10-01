# Spammish — Never see another B2B cold email.

**Make B2B cold email disappear.** Spammish is an open-source email agent that identifies unsolicited B2B sales email and obvious spam, then quietly moves high-confidence matches from your Gmail inbox to **The Abyss**.

One job. Uncertain mail stays in your inbox. Moved mail stays recoverable, with its read/unread state unchanged. No replies, sending, deletion, link clicking, unsubscribing, summaries, or dashboards.

## Current release status

**Experimental desktop preview; not yet a ready-to-install public release.** The desktop app and deterministic mail-handling code are available here. A public installer still requires a configured and approved Google OAuth app, Mac signing/notarization, and a real Gmail acceptance test. Automated tests use simulated Gmail responses; they do not establish real-world classification accuracy.

The intended user setup is:

1. Install and open Spammish.
2. Click **Connect Gmail** and approve Google access in your browser.
3. Click **Turn on**.

A completed packaged release will include the runtime and Google app configuration. Users will not need Node, a terminal, an encryption key, or an AI API key. **That installer is not available yet.** Developers can run the current preview using [development instructions](docs/development.md).

## What it does out of the box

- Classifies locally using deterministic subject/body rules and corroborating sales signals. A generic “Re: quick question” subject is insufficient.
- Protects messages with important account, payment, security, delivery, and other legitimate-message signals. Incomplete or uncertain messages stay in Inbox.
- Creates the recoverable Gmail label **The Abyss** if needed. A match gains that label and loses only the Inbox label.
- Preserves read/unread state. Gmail content is fetched for local inspection; this does not mark it read.
- Processes new arrivals while enabled; turning it on establishes a fresh baseline, without sweeping old inbox mail.
- Runs in the background while the Mac is awake and online. Pause stops processing; disconnect removes the stored credential and attempts Google revocation. Quit stops processing until the app runs again.

Gmail delivers messages before Spammish can act. The app checks approximately every 20 seconds, so mail or notifications may appear first. It cannot guarantee that every cold email will disappear, or disappear before you see it. Conservative rules intentionally let ambiguous messages through.

## Local, with no AI bill

The same input receives the same rule-based classification. No AI API calls, maintainer-funded service, telemetry, or paid subscription are required. Optional model integrations are not included in this release.

The desktop app stores its Gmail credential using the operating system's secure storage. It does not save email bodies or send them to an AI service. Content is fetched only for classification, with bounded parsing; truncated messages are left alone. Attachments and remote images are not fetched.

Google's `gmail.modify` permission is broader than this app's behavior: it technically permits sending and other modifications. There is no narrower Gmail scope that permits these recoverable moves. The shipped code contains no Gmail sending, replying, trashing, or permanent deletion operation. [Privacy notes](PRIVACY.md) explain the data flow and [security notes](SECURITY.md) describe reporting and access.

## Open source

Spammish is released under the [MIT License](LICENSE). You can inspect, modify, and build on the code. The behavior described here applies to the published default version. Forks and third-party modifications are operated at their authors' and users' responsibility; Spammish's maintainers do not control them. The license contains the warranty and liability terms.

Contributions should preserve this narrow purpose. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Verification

```sh
npm ci
npm test
npm run check
npm audit
```

Tests cover deterministic examples, paginated arrivals, safe label changes, unread preservation in simulated Gmail responses, pause/restart, credential storage, expired history, and OAuth state/PKCE. Real Gmail verification and representative accuracy evaluation remain release requirements. See the [maintainer release guide](docs/releasing.md).
