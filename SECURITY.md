# Security policy

Never include real email, credentials, OAuth tokens, or personal data in public issues. Report vulnerabilities privately using [GitHub private vulnerability reporting](https://github.com/nickfrench-gtm/spammish/security/advisories/new), which is enabled for this repository.

The desktop renderer is sandboxed and cannot access Node or Gmail credentials. OAuth uses the system browser, a loopback callback, state validation, and PKCE. The refresh credential is encrypted using OS secure storage; the app refuses an insecure plaintext fallback. Account metadata remains sensitive and should be protected by your OS login and disk security.

Google's Gmail modification grant exceeds the application's narrow operations. Review the code before trusting a build. Only use signed/notarized official releases once they are available; current unsigned previews are development artifacts. Revoke Google access if a credential or computer is compromised.

The primary local browser worker has an encrypted account-state vault with a private local key. Protect its `.env`, database, and vault key. It binds only to loopback, rejects unexpected Host/Origin values, and checks session-bound CSRF tokens. It is not intended for remote public hosting.
