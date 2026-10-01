# Privacy

Spammish's default desktop version processes Gmail locally on your computer. It contacts Google's OAuth and Gmail endpoints to authorize access, refresh/revoke credentials, inspect the existing Inbox on first enable and new mail thereafter, create The Abyss label if missing, and move high-confidence matches by changing labels.

Subject, sender, and bounded message body content are processed in memory. Spammish does not store email bodies, load remote email images, fetch attachments, click message links, or transmit message content to an AI provider or maintainer. The local accounts file holds each connected email address, processing cursor, state, temporary message IDs/page checkpoints during the initial Inbox sweep, and a separate OS-encrypted refresh credential for each account. The first multi-account upgrade migrates the old single-account file without changing its paused/enabled state or sweep progress. Temporary sweep IDs are dropped after completion. No telemetry or analytics is included.

The Gmail `gmail.modify` grant technically allows broader actions than Spammish performs. The published default code does not send, reply, trash, or delete mail. Classification is conservative but may make mistakes. Review The Abyss when needed and move a message back to Inbox using Gmail.

Pause stops the selected account; the tray’s Pause all accounts control and Quit stop all processing. Disconnect clears only the selected account’s local credential and attempts revocation through Google. If offline revocation fails, remove the grant manually in your Google Account's third-party connections. Uninstalling alone may leave the OS account file or Google grant; disconnect first.

These statements describe the default source in this repository. Modified versions and forks can behave differently and are their operators' responsibility. Google's own services are governed by Google's privacy policy.
