# Spammish — Never see another B2B cold email.

**Make B2B cold email disappear.** Spammish is an open-source email agent that identifies unsolicited B2B sales email and obvious spam, then moves high-confidence matches out of your inbox into Gmail's recoverable **The Abyss** label.

**Release status: experimental prototype.** Automated rule and label-operation tests pass, but this release has not been verified end to end with a real Gmail account. The tests do not establish classification accuracy on representative real email. Configure and inspect a test mailbox before relying on it.

It has one job: classify and move. It does not reply, click links, unsubscribe, delete messages, summarize mail, or manage your calendar. Uncertain messages stay in the inbox.

Spammish is released under the [MIT License](LICENSE). Out of the box, it uses local deterministic rules, requires no AI API key, and moves only high-confidence matches to **The Abyss**. It never sends or replies to messages. You may modify and redistribute the open-source code; if you run a modified copy or a fork, its behavior and operation are your responsibility. The Spammish maintainers do not control or assume responsibility for third-party modifications or deployments. See the license for the full warranty and liability terms.

## Deterministic by default

The local rules in `lib/spammish-policy.mjs` run without an AI service or API key. The same message always receives the same classification. No API usage is billed to the project maintainer. The classifier requires corroborating sales signals; a subject line such as “Re: quick question” is not sufficient on its own. Obvious spam is moved only when the message is not protected by account, security, payment, delivery, or other important-message signals.

An optional user-supplied model key is not currently part of the release. The default classifier makes no outbound AI requests.

## Gmail behavior

Gmail's API receives message content for local classification while the message remains unread. Spammish does not mark mail read. A match is moved by adding the **The Abyss** label and removing the `INBOX` label; this is reversible and does not permanently delete the message. Gmail calls these labels rather than folders.

Spammish processes incoming messages after they arrive. It cannot prevent Gmail from initially delivering a message to the inbox. The current sync is periodic, so a message may be visible before Spammish moves it.

## Run locally

Requirements: Node.js 22.5 or newer (the application uses the built-in SQLite module). This first release runs as a single-user process on the local machine and binds to `127.0.0.1`.

```sh
cp .env.example .env
npm start
```

In your own Google Cloud project, enable the Gmail API, configure the OAuth consent screen for your account, and create a web OAuth client with `http://127.0.0.1:8080/auth/callback` as an authorized redirect URI. Copy its client ID and secret into `.env`; generate `SPAMMISH_TOKEN_VAULT_KEY` with the command shown in `.env.example`. Never commit `.env` or the `data/` directory. The server only listens on the local machine; remote hosting is outside the scope of this release. The Gmail `gmail.modify` scope is restricted and may require additional OAuth review if you distribute an OAuth client to other users; this project instead expects each operator to configure their own client. See [Google's scope guidance](https://developers.google.com/workspace/gmail/api/auth/scopes).

The classifier itself can be used independently:

```js
import { classifyForAbyss } from "./lib/spammish-policy.mjs";

const result = classifyForAbyss({
  from: "sales@example.com",
  subject: "A quick question",
  body: "We help teams with lead generation. Open to a 15-minute call?",
});
console.log(result.destination); // The Abyss
```

## Configuration

See [.env.example](.env.example). Google OAuth credentials and an encryption key are required for a connected deployment. Spammish does not require an AI API key.

## Privacy and security

- Message content (at most the first 12,000 decoded characters of plain text) is fetched for classification and processed locally by the deterministic rules. Spammish does not send it to an AI service.
- Gmail content and OAuth tokens are sensitive. Protect the deployment's data directory and encryption key, and use HTTPS when connecting remotely.
- Spammish does not send email, open links, unsubscribe, or permanently delete messages.
- Uncertain messages remain in the inbox. The Abyss label keeps moved messages inspectable and recoverable.
- Gmail OAuth `gmail.modify` is required to inspect message content and move it between Inbox and The Abyss. This is a restricted scope that technically permits more actions than Spammish uses. The published code contains no Gmail compose, send, reply, or delete operation. Review Google's consent and verification requirements before distributing or deploying the app.
- This project is experimental. Test it with a Gmail account you can inspect before relying on it.

Report security issues privately as described in [SECURITY.md](SECURITY.md).

## Development

```sh
npm test
```

The tests use Node's built-in test runner and do not require external services or API keys.

## License

MIT. See [LICENSE](LICENSE).
