# Abyss identity and recent decisions — 0.4.3 review candidate

This is a local owner-review candidate, not a published release. The public 0.4.2 tag is unchanged.

## Changes

A black-center electric-blue Abyss mark replaces the shield on current marketing, README and desktop surfaces. Assets include the 1024px app icon, native ICNS derivative, monochrome tray mark, 16–512px web variants and 1200×630 social preview. Provenance is documented in marketing/assets/PROVENANCE.md. Reduced-motion users receive static imagery.

Desktop Recent decisions shows up to 20 recent records across accounts, sender/subject fetched transiently from Gmail, score, evidence and current disposition. Preliminary screening scores are labeled separately from full Spammish Scores. Unscored protection does not invent a score. Rescue appears only where current Gmail labels confirm Abyss membership, and success updates the row to Back in Inbox. The existing shared Rescue operation remains responsible for Gmail recovery and correction evidence.

The worker now retains at most 50 kept-message inspection records per account, alongside the existing 50 confirmed-move records. These contain IDs, times and sanitized decisions, not bodies, senders or subjects. Older kept decisions are not reconstructed. Threshold 70, classifier weights, Gmail mutation operations, OAuth configuration and account isolation are unchanged. PRIVACY.md reflects automatic initial review loading and this retention.

## Qualification

- 74 application tests passed; one separate waitlist test passed.
- Syntax checks passed for 36 source files; dependency audit found zero vulnerabilities; diff whitespace check passed.
- A targeted current-source scan found no configured credential/private-account patterns. This is limited hygiene evidence, not proof that no secret can exist.
- The unsigned macOS arm64 app built and launched using an isolated empty profile with no OAuth client bundled. Actual native UI shows the correct missing-client boundary, current branding and useful Recent decisions empty state. About showed candidate version 0.4.3.
- Connected/cleanup/decision rows and the Rescue success transition were exercised with clearly labeled synthetic fixtures through the actual desktop renderer. Marketing examples are reproducible outputs of the real policy via scripts/brand-demo.mjs, not performance benchmarks or private email.
- Initial marketing screenshots cover 1440, 1080, 768 and 390px layouts without horizontal overflow. New image routes load. Local waitlist submission displayed success and persisted one example.com record; automated coverage exercises duplicate, validation and failure handling.
- One design scan returned only advisory typography/color/radius mismatches. Compact native metadata sizes and semantic row tints are intentional and documented.

## Boundaries

No live Gmail mutation was performed during this visual pass. Your installed connected 0.4.2 app and account store were preserved. The candidate's Gmail operation coverage comes from automated tests, not a new real-mail acceptance claim. Existing source installation/OAuth architecture was preserved; a fresh agent installation was not repeated for this visual candidate. No public push, tag, release or Fly deployment occurred.

Native About/app rendering was inspected; Dock/Finder/Launchpad rendering, Intel builds and OS appearance variants were not exhaustively qualified. No commercial video artifact was provided, so none was rebuilt or claimed verified. Marketing mobile was inspected; separate narrow app screenshot capture did not apply the requested viewport reliably, so it is not credited as native small-window acceptance. Scores and mail-history rows are a bounded recent view, not a complete inbox replacement.
