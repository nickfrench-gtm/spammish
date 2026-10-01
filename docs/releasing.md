# Maintainer release guide

Do not publish an unsigned or unconfigured preview as a working public installer.

## Google app registration (once for maintainers)

1. Use a dedicated Spammish Google Cloud project, enable Gmail API, and configure external consent with accurate Spammish branding, support contact, and publicly accessible privacy information. Preserve unrelated existing app credentials.
2. Create a **Desktop app** OAuth client; download installed-client JSON into the ignored `desktop/oauth-client.json`. Never embed an existing web client secret. Desktop credentials are distributed with installed applications and are not an authentication secret protecting end-user access. User refresh tokens are secret and must never be packaged.
3. Request only `https://www.googleapis.com/auth/gmail.modify`. Configure a test account for development. Testing status is not public approval and may impose limits/short-lived authorization. Complete Google's applicable branding and restricted-scope verification process before general distribution. A verified domain/privacy website and further Google requirements may be necessary; switching to production alone is not approval.
4. Connect an explicitly authorized test mailbox through the app and finish the acceptance checks below.

References: [Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Google verification](https://support.google.com/cloud/answer/9110914).

## Real Gmail acceptance (still outstanding)

Use a disposable or explicitly authorized test mailbox. Establish the baseline by enabling Spammish. Deliver synthetic cold email, obvious spam, legitimate business replies, security/account notifications, receipts, ambiguous pitches, and read/unread examples from a separately controlled sender. Spammish itself must never send them. Verify only expected high-confidence new arrivals gain The Abyss and lose Inbox, preserve all other labels and read state, and are recoverable in Gmail. Verify pause, reconnect, restart, sleep/wake, offline recovery, and account revocation. Record anonymized results, not message contents or credentials.

A handful of examples proves integration behavior, not accuracy. Evaluate a representative, consented corpus separately before making accuracy claims.

## Mac distribution

Obtain a Developer ID Application certificate and Apple notarization credentials. An Apple Development certificate is insufficient. Build a universal signed/notarized DMG from the reviewed commit:

```sh
SPAMMISH_GOOGLE_APPROVED=yes npm run package:desktop
```

The environment flag is a maintainer attestation after actual Google approval, not a substitute for approval. The script requires the installed-client config, Developer ID, and notarization credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, or Apple's supported API-key configuration). Do not commit these values.

Run tests, source checks, dependency audit, and secret/history scans; inspect the packaged archive for account files, `.env`, tokens, web secrets, logs, or private data. Verify the installer on a clean Mac, verify signature/notarization, and test the exact distributed artifact. Publish checksums and the commit alongside the signed artifact. Update README release status only after these requirements are satisfied.

## Preview

`npm run package:preview` creates an unsigned development DMG. It may deliberately have no Google configuration and display a disabled connection button. Keep it clearly labeled; it is not an end-user release.
