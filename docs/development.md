# Development

Node.js 22.13 or newer is required for source development. Users of a packaged desktop release will not need Node.

```sh
npm ci
npm test
npm run check
npm run desktop
```

The desktop preview runs without a Google client, but Connect Gmail is disabled. For a private development connection, create a **Desktop app** OAuth client in your own Google Cloud project with Gmail API enabled. Download its installed-client JSON to `desktop/oauth-client.json` (ignored by Git). A web client is not compatible. Configure your consent screen and permitted test account in Google Cloud. Do not commit credentials or account data.

## Preview packaging

```sh
npm run package:preview
```

This produces an unsigned Mac preview in `dist/`. It is not a public production installer. It includes the Google client only if the ignored local configuration exists.

## Advanced local server

The original loopback server remains available for developers:

```sh
cp .env.example .env
npm start
```

This separate mode uses a web OAuth client, the loopback redirect documented in `.env.example`, and a generated token-vault key. Protect `.env` and `data/`. Remote hosting is outside this release.

## Classifier changes

Rules are in `lib/spammish-policy.mjs`. Add synthetic fixtures for both cold email and legitimate lookalikes. A single generic subject phrase must not trigger diversion. Incomplete messages stay in the inbox. Never commit real email.
