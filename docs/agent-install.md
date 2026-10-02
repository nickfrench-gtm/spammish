# Install with your AI builder

Give the repository to Codex, Claude Code, Cursor or another capable coding agent:

> Install Spammish locally and get it ready to protect my Gmail. Follow AGENTS.md and docs/agent-install.md. Configure and verify everything you can; walk me through only steps requiring my Google authorization. Preserve existing credentials and never print secrets.

The same steps work manually. An AI builder assists setup; it is not the runtime and can close afterward.

## Primary supported path: local browser worker

macOS or Linux, Node **22.13+** (24 recommended), internet access and a Gmail account. Windows/local desktop distribution has not been qualified by this path. Keep the Node process running on an awake, online computer. Do not expose the server remotely.

1. Clone the repo, enter its folder and inspect AGENTS.md. Install with `npm ci --ignore-scripts`. The browser worker needs no Electron download; desktop users should use `npm ci` instead.
2. Run `npm run setup`. This creates a private `.env` and a random vault key if absent. It preserves an existing vault key and configured client; it can fill blank Google fields. **Do not print `.env`, replace an existing vault key or share OAuth JSON.**
3. Run `npm run doctor -- --json`. Missing Google configuration is an expected next step, not a reason to pretend setup is complete.

## Configure your own Google client (once)

BYO OAuth is the intentional source-release authentication model. This is developer configuration, **not Gmail authorization**. Spammish does not require a paid Google Workspace subscription. No maintainer-managed public OAuth service is provided. A simpler Spammish-managed flow is planned; no date or Google approval is promised.

A **Cloud project** owns the API/consent configuration; an **OAuth client** identifies your local application. Its downloaded configuration contains the client ID and, for the browser path, client secret. These are not your Google login or the access/refresh tokens later granted after consent. Keep the downloaded JSON private and outside Git.

In your own Google Cloud project:

1. Enable Gmail API.
2. Configure Google Auth Platform consent/audience with truthful app branding and your own contact. For personal/test use, add the intended Gmail addresses as test users. [Google's verification exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and testing limits govern your project; Gmail authorizations for an external app in Testing can expire after seven days ([token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)). Don't claim it is verified for public distribution.
3. Create a **Web application** OAuth client. Register `http://127.0.0.1:8080/auth/callback` as its authorized redirect. Download the client JSON privately. A Desktop client is incompatible with this server path.
4. Run `npm run setup -- --web-client /absolute/path/to/client.json`. It creates fresh configuration or fills blank Google fields in a template while preserving the existing vault key. It never overwrites an already configured client. If replacing a configured client is explicitly requested, use local file tools to update only the client/redirect/port fields, preserving the vault key. Do not print values or commit them.

An agent may assist browser/API configuration where tools and your permission allow it. The **human** completes Google sign-in, MFA/security challenges, OAuth consent and any account/organization restrictions. Do not request passwords, MFA codes or Google session cookies. Do not accept legal agreements, create billing commitments, relax organization policy or broaden permissions to make setup succeed.

## Start, authorize, verify

```sh
npm run doctor -- --json
npm start
```

Keep `npm start` running in a terminal or supervised background process. Open **http://127.0.0.1:8080**, choose Connect another Gmail, and let the **human** approve Google's OAuth consent for the intended account. Connect starts a resumable existing-Inbox pass and then polls new arrivals. Connect additional accounts on the same page; each has Pause and Disconnect.

From another terminal in the same folder:

```sh
npm run doctor -- --json
```

Doctor ends with **SPAMMISH READY** or **SPAMMISH NOT READY**. JSON provides `SPAMMISH_READY`; exit 0 means the browser worker is configured, running, has recent verification for every connected account, and has at least one enabled account. Exit 1 is expected before configuration, startup or human consent. It does not certify filtering accuracy. Desktop doctor checks prerequisites only; verify its live state in the app.

Expected milestones:

| Field | Meaning |
| --- | --- |
| SETUP_COMPLETE | Supported Node, valid-shaped web client/redirect and local vault key configured; not proof Google approved the client |
| SPAMMISH_RUNNING | The expected source version and a challenge proof match this checkout, configured vault, OAuth client and state file |
| GMAIL_CONNECTION_STORED | At least one account was saved after OAuth; not proof it remains authorized |
| GMAIL_AUTHORIZED | Every connected account has a successful check within two minutes and no current error; recent verification, not a perpetual guarantee |
| BACKGROUND_WORKER_ACTIVE | At least one account is enabled in the running worker; an outage/cooldown can still delay checks |
| RECONNECT_REQUIRED | A connected account has rejected authorization |

Do not assert successful Gmail authorization until the human completes consent and doctor reports it. On a fresh install without Google configuration, the truthful stopping point is **local worker ready; human Google configuration/authorization required**. A fresh stranger's grant cannot be fabricated in an automated install test.

## Diagnostics and recovery

- **Missing vault/config:** use setup and the Google steps above. Never replace a key for an existing encrypted database.
- **Wrong client/redirect:** Web client for the server; Desktop client only for Electron. Port and redirect must agree exactly. Do not broaden scopes beyond gmail.modify.
- **Port in use:** stop your own previous worker, or choose another port and configure its matching Google redirect. Do not kill unrelated processes.
- **Unverified/test-user warning or expired grant:** inspect your own Google project/test users and reconnect through the human. Do not bypass browser/security warnings or claim public approval.
- **Google throttling/offline:** worker preserves checkpoints and retries. Doctor/UI may report no recent successful check. Allow the persisted cooldown; don't hammer Gmail or remove the checkpoint.
- **Reconnect required:** let the human reconnect only the affected account. Other accounts retain their own state.
- **Missed mail:** move it to The Abyss in Gmail while enabled. **Wrong move:** use Review filtering → Rescue, or move it back to Inbox. Corrections are narrow, local and deterministic.
- **Background operation:** closing the browser is fine; stopping Node, sleeping or going offline stops/delays filtering. Automatic service installation is optional and requires explicit user choice; do not silently create a system service.

Run `npm test`, `npm run check`, `npm audit` for source diagnostics. Do not include raw mailbox content, tokens, `.env` or account stores in issues. See SECURITY.md for private reporting.

## Optional desktop source app

See [development.md](development.md). Use `npm ci`, your own **Desktop app** client in ignored `desktop/oauth-client.json`, `npm run doctor -- --desktop`, then `npm run desktop`. Check actual account/On/error state in the window. Closing the window leaves the menu-bar worker running; Quit stops it. There is no official signed public installer in this release.

Changing OAuth clients can require fresh human authorization; saved grants belong to their client. Preserve the vault key, but do not promise old refresh tokens will migrate to a future official client.
