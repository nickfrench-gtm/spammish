# Spammish — Never see another B2B cold email.

**Make B2B cold email disappear.** Spammish is an open-source email agent that identifies unsolicited B2B sales email and obvious spam, then quietly moves high-confidence matches from your Gmail inbox to **The Abyss**.

One job. Uncertain mail stays in your inbox. Moved mail stays recoverable, with its read/unread state unchanged. No replies, sending, deletion, link clicking, unsubscribing, summaries, or dashboards.

## Current release status

**Source release candidate 0.4.0; desktop distribution is still a preview.** Developers can self-host with their own Google OAuth registration. A public Mac installer still requires Google approval, Apple signing/notarization, and the full acceptance checklist. Authorized real mailboxes have connected and a real label move has been verified; this does not establish classification accuracy or complete end-user onboarding acceptance.

The intended user setup is:

1. Install and open Spammish.
2. Click **Connect Gmail** and approve Google access in your browser.
3. Cleanup starts automatically: existing Inbox first, then new arrivals. Use **Pause** to stop it.

Use **Add Gmail account** to connect another Gmail. Each account has its own Turn on/Pause, Open The Abyss, and Disconnect controls. Successful connections start cleanup automatically. Connecting another Gmail leaves existing accounts’ settings unchanged. Reconnecting the same Gmail refreshes that connection and preserves its cleanup progress.

A completed packaged release will include the runtime and Google app configuration. Users will not need Node, a terminal, an encryption key, or an AI API key. **That installer is not available yet.** Developers can run the current preview using [development instructions](docs/development.md).

## What a GitHub visitor does today

This repository contains the desktop app’s source, not a ready-to-install public download. Clone the repo or download its ZIP, install Node and dependencies, configure your own Google Desktop OAuth client, then run the app. The [development guide](docs/development.md) walks through this. Codex or Claude can help with setup; neither needs to stay running afterward.

Spammish itself must keep running on an awake, online Mac. Closing its window leaves it running in the menu bar. **Quit stops mail processing.** Cloud would remove that local runtime requirement, but is not available yet.

## What it does out of the box

- Classifies locally with weighted evidence: language, relationship history, commercial intent, follow-up sequences, headers and locally inspected URL patterns. A generic “Re: quick question” subject is insufficient. Broader unsolicited promotions and obvious spam can qualify too. See [how detection works](docs/detection.md).
- Protects messages with important account, payment, security, delivery, and other legitimate-message signals. Incomplete or uncertain messages stay in Inbox.
- Supports multiple Gmail accounts in the desktop app, with isolated credentials, cursors, The Abyss labels, and processing state. One revoked or slow connection does not stop the others.
- Creates the recoverable Gmail label **The Abyss** if needed. A match gains that label and loses only the Inbox label.
- Preserves read/unread state. Gmail content is fetched for local inspection; this does not mark it read.
- On connection, checks the existing Inbox and moves high-confidence matches to The Abyss, then watches new arrivals. The sweep resumes after interruptions and does not run again on every pause/resume. This scoring update schedules one fresh Inbox pass using the new policy. Existing paused accounts remain paused on upgrade; reconnect or click Turn on to resume them.
- Shows one lifetime total: confirmed emails sent to The Abyss. It survives restarts and disconnects. Older desktop moves are not guessed or backfilled.
- Offers recent move explanations and **Rescue** under Review filtering. In Gmail, moving missed unwanted mail to The Abyss supplies narrow sender rejection evidence; restoring it to Inbox supplies protection. No domain-wide block is learned from one correction.
- Runs in the background while the Mac is awake and online. Pause stops processing; disconnect removes the stored credential and attempts Google revocation. Quit stops processing until the app runs again.

Gmail delivers messages before Spammish can act. The app checks approximately every 20 seconds, so mail or notifications may appear first. It cannot guarantee that every cold email will disappear, or disappear before you see it. Conservative rules intentionally let ambiguous messages through.

## Local, with no AI bill

The same message and relationship/feedback evidence receive the same rule-based classification. Mailbox history and your corrections can change that evidence. No AI API calls, maintainer-funded service, telemetry, or paid subscription are required. The OSS default has no model integration. Fork authors can build their own; maintainers do not fund their usage. OSS is free forever under MIT, including the complete core filtering and correction engine.

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

Tests cover deterministic examples, paginated arrivals, safe label changes, unread preservation in simulated Gmail responses, pause/restart, credential storage, expired history, initial inbox pagination/checkpoint recovery, OAuth state/PKCE, multiple-account isolation, duplicate connections, and migration from the single-account preview. Full real Gmail acceptance and representative accuracy evaluation remain release requirements. Current synthetic tests cover scoring, sender corrections, crash-safe counts, and the loopback server’s security boundaries as well. See the [maintainer release guide](docs/releasing.md).

## Website and Cloud

The [marketing site](https://spammish.fly.dev) offers the open-source repo and a Cloud waitlist. Cloud is coming soon. Optional bring-your-own AI keys are planned for Cloud; no AI usage is included or subsidized. The open-source app uses no AI API; contributors may build their own extensions. Website operations are documented in [marketing/README.md](marketing/README.md).
