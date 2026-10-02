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

## Fresh installation and checks

Candidate `928be83e7d1569761bbd1561b5fbfbbbb84624a5` was installed from two clean local Git clones, one manual and one by an independent coding agent following repository-local instructions alone. Both ran on macOS with Node 26.9.0; the agent environment was arm64 macOS 26.6.2. No maintainer credentials or existing mailbox configuration were copied.

Both dependency installations, private configuration creation and loopback startup passed. Doctor identified the intended running instance and correctly reported NOT READY with no OAuth client, stored Gmail authorization or active account. The independent agent stopped at human Google configuration/consent without undocumented friction. Both test workers were stopped afterward. The manual clean clone also passed all 67 automated tests, all 30 source syntax checks and npm audit with zero reported vulnerabilities.

The working candidate passed the same suite and a targeted scan of current source and historical Git blobs found no configured credential/private-account/developer-path patterns. This is targeted hygiene evidence, not proof of absence or a security certification. Later changes to this qualification document and README license wording do not change the exercised runtime.

Fresh Google client registration and browser consent completion were not performed in these clean clones. Prior controlled Gmail integration is recorded separately above. Linux CI is a distinct automated qualification; Windows, other coding agents, consumer installers and all supported minimum runtime combinations have not been independently qualified by these fresh installations.
