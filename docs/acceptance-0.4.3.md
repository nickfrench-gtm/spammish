# 0.4.3 qualification

The owner approved updating the public source, marketing site and installed local app on October 2, 2026. The final visual choice is the supplied blue mail-vortex composition with a black-background vortex icon. This supersedes the earlier visual-review candidate's simplified transparent mark.

75 application tests passed, including Desktop OAuth import validation, field minimization, private file permissions, persistence and refusal to replace existing configuration. The separate waitlist test passed, 38 source files passed syntax checks, dependency audit reported zero vulnerabilities and diff whitespace checks passed.

The app now supports importing a user-owned Desktop OAuth JSON through Connect Gmail when no client is configured. It uses a native file picker, saves only client ID/secret locally, and then follows the existing external-browser Google authorization flow. It does not switch clients under already-connected accounts. Human consent and Google client registration remain separate requirements. New-user end-to-end Google consent was not repeated in this pass; import was qualified with synthetic configuration tests.

The configured macOS arm64 app built successfully and replaced the installed app with a private rollback archive retained. Existing account records and their paused state were preserved. The actual live UI displays connected accounts, an enabled Add Gmail account control, actual recent scores/destinations and Rescue controls. No live Rescue mutation was performed for qualification. The classifier threshold, weights and Gmail label operations are unchanged.

Local marketing rendering showed loaded assets, dark styling and no horizontal overflow at the inspected desktop viewport. Earlier visual-review qualification covers the unchanged responsive shell; the latest mail-vortex artwork uses responsive object positioning. Waitlist persistence remains on the existing Fly volume. No owner OAuth configuration or mailbox artifacts are part of the source release; locally configured app binaries are not uploaded as public release assets.

This remains an unsigned, builder-oriented MIT source release. No official OAuth verification, notarized installer, new statistical accuracy claim or Cloud service is implied. Existing historical release tags remain unchanged.
