# Spammish marketing

A standalone Node website. It never loads Gmail credentials or runs mailbox processing. Cloud is a waitlist only.

Run `node marketing/server.mjs` and open http://localhost:8080. Set `PUBLIC_ORIGIN` to the exact site origin in production. `WAITLIST_DATA_DIR` defaults to ignored `data/`; production uses the private Fly volume `/data/spammish`. Entries are serialized, deduplicated and persisted in `spammish-waitlist.jsonl`, mode 0600. No public export or admin endpoint exists. Access/export/removal require operator access to the volume. Do not commit entries or backups. No email delivery service is configured.

Deploy from the repo root: `flyctl deploy --config fly.toml`. Keep mailbox credentials and processing out of the marketing service. Back up its private volume before storage changes.

The shield asset was isolated from the user-supplied Spammish brand sheet using image generation. No testimonials, launch dates, pricing or measured accuracy claims are used.

Keep one Fly application Machine/writer with its attached volume. Accepted records are synced to disk before success. An interrupted final record is backed up privately and repaired on restart; unexpected corruption elsewhere fails closed. Back up the volume privately: a single local volume is not replicated database storage. Do not scale to independent writers without shared persistence.
