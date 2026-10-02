---
name: Spammish
description: A restrained local utility with a black-center, electric-blue Abyss vortex.
colors:
  canvas: "#080b10"
  foreground: "#f3f5f8"
  muted: "#a7b3c5"
  line: "#293342"
  accent: "#36bdff"
  accent-hover: "#81d7ff"
  action-ink: "#05101a"
  field: "#0e1520"
  field-border: "#53627a"
  placeholder: "#9babc0"
  secondary: "#edf3fa"
  secondary-ink: "#111a25"
  secondary-hover: "#cddcec"
  success: "#6ed6a5"
  error: "#ffada5"
  selection: "#155c83"
  marketing-disabled: "#597185"
  marketing-disabled-ink: "#e3edf6"
typography:
  display:
    fontFamily: "SpammishDisplay, sans-serif"
    fontSize: "clamp(48px, 5.5vw, 76px)"
    fontWeight: 720
    lineHeight: 1.04
    letterSpacing: "-.04em"
  marketing-body:
    fontFamily: "SpammishDisplay, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  desktop-body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  desktop-headline:
    fontFamily: "-apple-system, sans-serif"
    fontSize: "38px"
    fontWeight: 650
    lineHeight: 1.09
    letterSpacing: "-.025em"
rounded:
  action: "8px"
  field: "7px"
spacing:
  compact: "8px"
  desktop-inset: "36px"
  marketing-inset: "64px"
  mobile-inset: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.action}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.action}"
    padding: "13px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-desktop:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  button-add-account:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.action}"
    padding: "11px 16px"
  email-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
---

# Design System: Spammish

## Overview

**Creative North Star: "The Abyss"**

The supplied vortex defines the identity: an almost black central void and electric-blue accretion ring. Spammish is the product; The Abyss is its recoverable destination. Use the cleaned circular mark for interface identity and icons; the richer supplied source is preserved as a web derivative. No stars, galaxy backgrounds, HUDs or decorative glowing panels.

Marketing retains self-hosted Manrope; desktop keeps native type. Flat near-black surfaces, restrained white/slate copy and separators remain. Blue is for identity/actions; green, amber and red retain semantic meaning. The mark can indicate actual cleanup state only; static fallback and reduced motion are required.

**The Supplied Abyss Rule.** Preserve the black center, asymmetric electric-blue ring and dark surround. Small assets simplify detail. The menu-bar template is a monochrome vortex silhouette, not a shield.

## Colors

Primary: electric blue identifies action, emphasized headline words, notices, and availability. The lighter blue is the hover state. Dark action lettering keeps filled actions readable.

Neutral: near-black canvas, white foreground, muted slate copy, and gunmetal separators establish the shared base. The email field has a slightly lighter surface and stronger border. The website’s source action uses a pale neutral fill. Desktop enabled status uses green; website form errors use pale red. These semantic colors supplement the blue identity.

**The Action Contrast Rule.** Use electric blue with dark lettering for primary actions. Keep supporting text muted and separators subordinate.

## Typography

Manrope is self-hosted in `marketing/assets/display.ttf` and declared as `SpammishDisplay`. Marketing display type uses the frontmatter scale; section titles are responsive (32–48px), option titles (31px), and the lead (21px). Body copy stays readable at short measures. At the website’s narrower breakpoints, the hero is (54px) and then (52px), with the lead (18px).

The desktop uses native system sans. Its brand heading is (28px), explanatory headline uses the desktop headline token, and supporting text ranges from (12–15px). The headline reduces to (34px) on narrow windows. Preserve the CSS weights; marketing and desktop typography need not be forced into one font.

## Layout

Website content sits in a centered container with a maximum width (1320px), using the marketing inset token. The hero is a two-column layout with ratio (1.25:1). Repeated content uses three columns for principles and two columns for the available paths. At (800px), horizontal insets reduce to the mobile inset. At (580px), content stacks; the mark becomes a small first-row anchor and actions fill their available width.

The desktop uses one centered column with maximum width (600px) and padding (50px 36px 28px). At (470px), horizontal padding reduces to the mobile inset. Account rows retain a compact vertical reading order. Each row places email and state beside its own action, followed by instructions, notices, and secondary text actions. Rows have bottom spacing and separators (20px). The global connection action and optional disclosure follow the account list.

## Elevation & Depth

**The Flat Interface Rule.** Keep interface surfaces flat. The vortex carries depth; sections and controls use tonal contrast and borders.

No interface box shadows are present. The field surface and neutral button fill create the only panel-like tonal layers. Desktop button color transitions run (120ms ease-out) when reduced motion is not requested. Marketing smooth scrolling is disabled for reduced motion.

## Shapes

Filled actions use gently rounded corners through the action token; the email field uses the field token. Sections use straight thin separator lines (1px). The desktop status dot is circular (6px). Keep the distinctive silhouette inside the supplied Abyss mark asset rather than copying it into containers.

## Components

### Buttons

Solid and direct. Marketing actions have a minimum height (52px) and weight (650); desktop connection and account actions use weight (600), with padding (11px 16px). The initial Connect Gmail action fills the column. With accounts present, Add Gmail account uses a transparent fill, gunmetal border (1px), and blue label. Per-account actions have a minimum width (88px). Primary hover uses the lighter accent. The source action uses pale neutral fill with its own neutral hover. Website disabled actions use the marketing disabled colors and a wait cursor; desktop disabled primary actions use line and muted tokens. Text actions are transparent, underlined, and brighten on hover.

Website interactive controls use a blue focus outline (3px) with offset (5px). Desktop buttons and disclosure summaries use (2px) outlines with offset (4px).

### Inputs / Fields

The website email field fills its column with a visible border, dark field surface, blue caret, and muted placeholder. Its consent checkbox retains a visible native check control with blue accent. Keep a visible label and explicit status text; form error text uses the error token.

### Navigation

Website navigation is text only (14px), with blue hover and the shared focus outline. At the smallest breakpoint it reduces to (12px) and hides the first source shortcut; the source option remains in the body. The desktop has no navigation rail.

### Section boundaries

Website sections and desktop connection content use thin gunmetal rules instead of boxed cards. Preserve the generous website spacing and compact desktop grouping rather than introducing floating panels.

### Gmail account rows

Flat account rows pair the address (14px) with its state (12px) and a blue Turn on, Pause, or Reconnect action. Row headers align identity and action horizontally with a gap (12px); long addresses can wrap. Open The Abyss and Disconnect remain secondary text actions for that account. Account instructions use (13px) text. Successful connections start cleanup automatically; existing paused accounts stay paused on upgrade.

Keep rows keyed to their account identity so status refreshes preserve focused controls. Action labels include the address for assistive technology. During Google sign-in, Pause remains available for enabled accounts; conflicting actions are disabled. Cancel connection is a global text action shown during connection.

### Status and disclosure

Desktop aggregate status pairs text with a dot and counts enabled accounts. Account state is plain text, green when enabled and healthy; attention and paused states remain explicit in words. Notices use blue. The expandable “How it works” summary uses muted text and the desktop focus outline. Meaning stays readable in text alongside color.

## Do's and Don'ts

### Do:

- Do preserve the supplied Abyss mark and bold white wordmark.
- Do use blue to identify actions, focus, and selected emphasis.
- Do pair clear labels with visible interaction and status states.
- Do preserve the desktop’s simple connect, enable, and pause controls.

### Don't:

- Don't replace the Abyss mark with an unrelated symbol.
- Don't apply shadows or decorative gradients to interface panels.
- Don't carry the retired paper and rust palette into Spammish.
- Don't represent planned Cloud AI as an available open-source feature.

## Compact native decisions

The native utility uses the system font with 12/13/14px metadata, 20px section headings and a 34px product heading. Marketing uses the existing larger display ramp. Compact 8px button corners and semantic blue/green row tints are intentional; the product list is functional mail evidence, not a marketing card grid.

## Owner-selected final reference

Use the supplied blue mail-vortex composition and square black-background Abyss icon. Preserve its luminous blue streams, envelopes and dark center. This supersedes the earlier simplified transparent ribbon derivative. Functional mail rows remain quiet and readable; the branding image supplies the energy.
