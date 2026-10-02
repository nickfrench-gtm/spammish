# Contributing

Keep Spammish focused on one task: identify unwanted email using corroborated evidence and protective gates, then move it to the recoverable **The Abyss** label.

- Uncertain messages must remain in the inbox.
- Never permanently delete email, mark it read, click links, unsubscribe, or send messages.
- Keep the published OSS classifier deterministic and local, with no AI API integration. Extensions belong in independently operated forks.
- Add or update tests for classification and message disposition changes.
- Run `npm test` before submitting a change.
- Do not submit real email, credentials, tokens, personal data, or private screenshots/logs.

Small, focused pull requests are easiest to review. Describe what changed and how you verified it.

For personal policy changes, start with the [tuning guide](docs/tuning.md). The official defaults favor precision over recall; upstream proposals need evidence and legitimate-mail counterexamples, not just higher move counts. Share sanitized version, score, feature codes, protective reason and expected/actual disposition. Keep private message content and account identifiers out of public issues.
