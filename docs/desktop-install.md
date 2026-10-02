# Install the real local macOS app

The primary builder path delivers **Spammish.app**, the same desktop UI, menu-bar worker, multi-account Gmail controls, counter, explanations and Rescue as the existing source desktop application. It is built locally; it is not a signed/notarized consumer download. Linux has the [alternative browser worker](agent-install.md); Windows desktop is not qualified.

## 1. Prepare and build

Requirements: macOS on Apple Silicon or Intel, Node 22.13+ (24 recommended), npm, internet for dependencies/Google, and a Gmail account. No Apple developer membership, paid Workspace, official Spammish OAuth, or AI API is required for this local source build.

Clone the repository and enter its folder. Read AGENTS.md, then:

```sh
npm ci
npm run doctor -- --desktop --json
```

Doctor exit 1 before Google setup is expected. It checks prerequisite/config shape only, not whether Google accepts the client, an app is running, or Gmail is healthy. Do not replace successful authorization with a doctor result.

Use the existing builder to create the local app, even before Google configuration:

```sh
SPAMMISH_PREVIEW=1 CSC_IDENTITY_AUTO_DISCOVERY=false node node_modules/electron-builder/cli.js --mac --dir
```

Apple Silicon output: `dist/mac-arm64/Spammish.app`; Intel: `dist/mac/Spammish.app`. The printed builder output identifies the actual path. `--dir` creates an app without building a DMG or requiring notarization. `npm run package:preview` is an optional unsigned DMG; `package:desktop` is a different, future maintainer distribution path with signing/approval requirements.

The unconfigured app can launch, but Connect is unavailable until your client is included. Never call that Gmail-ready.

## 2. Configure your Google client

BYO Google OAuth configuration is intentional. A Google Cloud **project** owns API/consent settings; its **Desktop app OAuth client** identifies the local installation. Its downloaded JSON is not your password or a Gmail access/refresh token. Human Google consent later grants account tokens.

In your own Google project:

1. Enable Gmail API.
2. Configure Google Auth Platform branding, audience and contact truthfully. For applicable personal/test use, add the intended Gmail accounts as test users. Request only `https://www.googleapis.com/auth/gmail.modify`.
3. Create an OAuth client of type **Desktop app**. The app uses an ephemeral loopback callback; do not configure the browser worker's fixed Web-client redirect here.
4. Download the JSON privately and save it as `desktop/oauth-client.json`, mode 600. It is ignored by Git. Never print it, put it in an issue or commit it.
5. Run `npm run doctor -- --desktop --json`, then rebuild with the command above. The downloaded client is copied into the local app's resources; rebuild when replacing it. No maintainer client is distributed in this repository.

An agent may assist configuration with available tools and permission, but the human owns Google login, MFA, consent and account/security decisions. Never request passwords, MFA codes or session cookies. Do not relax Google/organization controls or pretend public verification exists. Review [Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [scope semantics](https://developers.google.com/workspace/gmail/api/auth/scopes), [verification requirements/exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and [token expiration](https://developers.google.com/identity/protocols/oauth2#expiration). External apps in Testing with Gmail scopes can have refresh grants expire after seven days; reconnect if Google rejects the grant. Changing clients can also require fresh consent.

## 3. Install, launch and prove the right copy

Copy the generated app into `~/Applications` using Finder or local file tools, then open **that exact app**. Create the directory if needed. Before replacing an existing app, inspect its version, preserve its source/client and quit it from its own menu. Never overwrite the owner’s working app for an installation test.

Use macOS's normal opening/security workflow. If macOS prevents opening, report the exact requirement and let the human handle it; do not disable Gatekeeper or security controls.

Verify the process executable path points inside the app you built/installed (a process listing is safe; do not print environment or account files). About Spammish shows the package version. A second launch with the same profile opens the already-running copy: a window appearing alone does **not** prove the new build is active. Quit that copy before an ordinary update.

**Fresh qualification alongside an existing app:** use a separate empty, private absolute profile path and launch the built executable directly:

```sh
mkdir -m 700 /absolute/private/qualification-profile
/absolute/path/Spammish.app/Contents/MacOS/Spammish --user-data-dir=/absolute/private/qualification-profile
```

This Electron profile override isolates saved accounts and the single-instance lock. Do not copy accounts/tokens into it or authorize mailboxes just to make an automated test pass. Keep it unconnected, inspect the real window, then stop only that test process. The ordinary installed app uses `~/Library/Application Support/Spammish`; never run multiple workers against it. Record the artifact and profile paths privately for right-instance verification.

## 4. Human authorization and account health

Choose Connect Gmail. The **human** completes Google's authentication/consent for the intended account. The app validates the Gmail account and saves tokens using OS encryption; it refuses unavailable secure storage. Then verify the intended account is shown, enabled, has a recent successful check and no current error. Connect additional Gmail accounts with the same procedure; each has isolated Pause/Disconnect state.

Connection begins a resumable Inbox cleanup and then polls new arrivals. Large inboxes take time; progress and Google cooldown/error messages are in the app. A saved account or OAuth browser returning alone does not prove a successful ongoing Gmail check. Qualification must record these separately:

- repository understood; dependencies installed;
- local app created; exact app launched;
- Google client configured, or human configuration boundary reached;
- human consent actually completed, or not exercised;
- live per-account Gmail health actually verified, or not exercised.

The app adds **The Abyss** and removes **Inbox** on qualifying messages, preserving unread/read state and unrelated labels. It implements no send/reply/trash/delete. Google's gmail.modify scope technically permits more than those implemented operations. Recent decisions shows up to 20 records with scores, evidence and current disposition. Use Rescue on a row still in The Abyss to return it to Inbox and record narrow correction evidence. Older kept-mail decisions are not backfilled. See README/PRIVACY.md for retention and feedback semantics.

## Keep running, stop, update and recover

- Close the window: the menu-bar worker remains running. The coding agent can close too.
- Quit Spammish: filtering stops. Sleep, power off, offline or Google cooldown delays filtering. Packaged apps request open-at-login while any account is enabled; inspect macOS Login Items if startup is blocked. Polling cannot prevent Gmail notifications from appearing first.
- Pause/Disconnect: use only the intended account's controls. Never delete the account store to fix setup.
- Update/tune: preserve Google JSON and account state; review/pull source, run `npm ci`, tests and checks, rebuild, Quit the previous copy and replace/reopen your installed app. Policy changes require the [tuning guide](tuning.md)'s recheck/version semantics; rebuilding alone does not magically reclassify completed history.
- Connect unavailable: correct Desktop-client JSON, desktop doctor, rebuild; a Web client is not interchangeable.
- Secure storage unavailable: resolve the OS keychain/storage requirement. Never fall back to plaintext tokens.
- Needs attention: follow the actual account error. Offline/quota waits retry; rejected grants require human reconnect. Do not hammer Google or discard cleanup checkpoints.

Source diagnostics: `npm test`, `npm run check`, `npm audit`. Bug reports contain version, OS, sanitized signal names/score/protections and expected/actual disposition, never private email or credentials. See SECURITY.md.
