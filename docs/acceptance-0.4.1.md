# Spammish 0.4.1 qualification

0.4.1 is a source follow-up to the immutable v0.4.0 release. Its tag and automatic source archives identify the reviewed follow-up commit; it does not replace the older tag or its separately identified supplemental archive.

## Changes and evidence scope

- Doctor now verifies a fresh challenge response bound to the intended checkout, client, vault and state file. No client configuration, secret, state path or mailbox data is returned by health. Tests reject a different same-version instance, missing recent authorization, paused workers and unsafe configuration permissions.
- The filtering core, Gmail provider, account model and storage code are unchanged. Additional full-pipeline synthetic tests keep customer/recruiter first contact, security mail, subscribed newsletters and category-only social notifications in Inbox.
- A regression test records that ordinary social notifications are excluded by candidate screening even with sender rejection feedback. Documentation reflects this limit instead of claiming blanket social-noise detection or unconditional sender blocking.
- Privacy describes the complete temporary Inbox ID enumeration, uncapped correction maps, and different desktop/headless encryption boundaries. Temporary IDs are discarded when the sweep completes; a large inbox can delay the first move.

The [27 controlled real-Gmail checks](acceptance-0.4.0.md) are reused for the unchanged shared classifier/provider/account/storage code, including unread preservation, Abyss/Rescue, recovery and multi-account isolation. They used previously authorized accounts, identifiable synthetic fixtures and disclosed injected failures. They do not establish a measured accuracy rate, fresh OAuth registration, or a fresh browser consent completion for this follow-up.

BYO OAuth is intentional. Installation, reaching human Google configuration/consent, and completing authorization are separate milestones. An authorization-boundary installation result must not be presented as a fresh successful Google grant.

Qualification results and the exact reviewed commit are recorded in the GitHub release. Source release nonblockers remain official OAuth, consumer installers/signing, extension/Cloud, more platforms and numerical accuracy benchmarks. No Phase 2 work is included.
