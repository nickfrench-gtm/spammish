# Development

First clone this repository or download and unzip its source, then open a terminal in that folder. An AI coding tool may help with setup but is not a runtime dependency. Node.js 22.13 or newer is required for source development. Users of a packaged desktop release will not need Node.

```sh
npm ci
npm test
npm run check
npm run desktop
```

The desktop preview runs without a Google client, but Connect Gmail is disabled. For a private development connection, create a **Desktop app** OAuth client in your own Google Cloud project with Gmail API enabled. Download its installed-client JSON to `desktop/oauth-client.json` (ignored by Git). A web client is not compatible. Configure your consent screen and permitted test account in Google Cloud. Do not commit credentials or account data.

Run the desktop app, click Connect Gmail and approve Google access. The connection immediately starts existing Inbox cleanup, then watches arrivals. Use Pause to stop. Closing the window keeps the app running in the menu bar; Quit, sleep, or going offline stops processing until the app is running and online again.

## Multiple Gmail accounts

The desktop manager in `lib/desktop-accounts.mjs` routes each account to its own existing `DesktopAgent`. `DesktopAccountsStore` writes a versioned `accounts.json` using OS-encrypted credentials, and atomically migrates the legacy `account.json`. Renderer and tray operations pass an account ID; no token is exposed to the renderer. Successful new and refreshed connections start cleanup automatically, preserving an existing sweep checkpoint. Existing paused accounts remain paused when opening an upgraded app.

## Preview packaging

```sh
npm run package:preview
```

This produces an unsigned Mac preview in `dist/`. It is not a public production installer. It includes the Google client only if the ignored local configuration exists.

## Advanced local server

The loopback server uses the **same multi-account engine** as the desktop app. It is suitable for an awake local machine with a running process; it is not a hosted service.

1. Install Node 22.13+ (Node 24 recommended) and run `npm ci`.
2. In your Google Cloud project enable Gmail API, configure the consent screen and test users, and create a **Web application** OAuth client. Register `http://127.0.0.1:8080/auth/callback` as its redirect URI. Download its JSON.
3. Configure and run:

```sh
npm run configure -- --web-client /absolute/path/to/downloaded-client.json
npm start
```

Open **http://127.0.0.1:8080**, choose Connect another Gmail, and approve your own account. Cleanup starts immediately; Pause stops it. Add more Gmail accounts from the same page. Review filtering shows recent explanations and Rescue. In Gmail use Move to → The Abyss for missed mail; move mail back to Inbox for a correction. These external changes are observed while processing runs or on resume while Gmail history remains available.

`configure` creates a private `.env` and vault key. It preserves an existing vault key and configured client; it can fill blank Google fields in an existing template. Running it without a client creates a configuration template; add your web-client values before connecting. Protect `.env` and `data/`; the vault key encrypts all saved server state. Losing it prevents access to saved accounts. The server listens only on loopback, validates Host and protects actions against cross-site requests. Keep the process running to filter mail; closing the browser is fine, stopping the process stops filtering.

Google Testing status can limit users and cause authorization to expire. Your project must permit your test account. This self-host path requires your own Google registration; a stranger cannot use the maintainer's private development client automatically. No AI key is needed.

## Classifier changes

Rules are in `lib/spammish-policy.mjs`. Add synthetic fixtures for both cold email and legitimate lookalikes. A single generic subject phrase must not trigger diversion. Incomplete messages stay in the inbox. Never commit real email.
