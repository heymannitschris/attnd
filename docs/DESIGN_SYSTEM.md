# Event Platform Visual System

This document is the visual source of truth for every current and future screen. The payment flow established the approved palette and surface treatment. New UI must reuse the semantic tokens in `src/app/globals.css` instead of introducing new background, colored accent, border, text, or shadow values.

## Visual character

- Every application page uses a single pure black canvas without radial or decorative color gradients.
- Cards and grouped controls use neutral near-black surfaces only.
- White is the only product accent and marks primary actions, selected controls, progress, focus, success, and unread states.
- White is reserved for primary content and neutral gray for supporting content.
- Photography may retain its natural colors. Official payment provider marks may retain required brand colors.
- Product chrome stays black, quiet, and subtly bordered.
- Inter is the product typeface. The fallback stack uses SF Pro and native system fonts.

## Core colors

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#000000` | Universal page canvas |
| `--color-background` | `#000000` | Default page background |
| `--color-background-elevated` | `#030303` | Minimal neutral separation |
| `--color-surface` | `#070707` | Cards and grouped controls |
| `--color-surface-raised` | `#0c0c0c` | Elevated cards and panels |
| `--color-surface-strong` | `#111111` | Strong neutral controls |
| `--color-surface-tint` | `#090909` | Supporting neutral surfaces |
| `--color-accent` | `#ffffff` | Primary white accent |
| `--color-accent-strong` | `#ffffff` | Pressed primary state |
| `--color-accent-soft` | `rgba(255, 255, 255, 0.12)` | Selected surface tint |
| `--color-accent-ink` | `#000000` | Text on white |
| `--color-text` | `#f7f9f9` | Primary text |
| `--color-text-secondary` | `#c5cace` | Secondary text |
| `--color-text-muted` | `#a4aaaf` | Metadata and helper text |
| `--color-text-faint` | `#7f898e` | Disabled and low emphasis text |

Brand colors, photography colors, destructive red, warning amber, and payment provider marks are allowed exceptions. They must remain limited to their semantic purpose.

## Surfaces and borders

- Standard cards use `--surface-card` and `--color-border`.
- Raised panels use `--surface-card-raised` and `--shadow-card`.
- Selected dark controls use `--color-accent-soft` with `--color-border-accent`.
- Primary buttons use a solid `--color-accent` fill, black text, a pill radius, and `--shadow-accent`.
- Glass controls use `--surface-glass` and backdrop blur only over imagery.

Do not introduce page gradients, colored dark backgrounds, warm UI accents, or tinted page canvases.

## Typography

- Font family: Inter Variable.
- Fallbacks: Inter, SF Pro Display, SF Pro Text, Apple system font, Segoe UI, sans serif.
- Headings use weights 700 to 780 with slightly negative tracking.
- Body copy uses 400 to 500.
- Buttons and labels use 600 to 750.
- Supporting text must use semantic text tokens rather than opacity on arbitrary colors.

## Shape and spacing

- Small control radius: `--radius-sm`.
- Card radius: `--radius-md`.
- Hero and sheet radius: `--radius-lg`.
- Pills and circular controls: `--radius-pill`.
- Use the shared spacing scale. Mobile layouts should begin with 12 to 20 px horizontal padding and preserve generous space around photography.

## Interaction states

- Focus uses a 2 px white outline with visible offset.
- Selected states use white borders and a soft white inner glow.
- Pressed states may deepen the surface or reduce brightness slightly.
- Saved or liked red is reserved for that action and must not replace the primary accent.
- Motion should stay short and purposeful; honor `prefers-reduced-motion`.

## Global bottom navigation

- Every application screen uses the same fixed five-item footer: Discover, Explore, Create, Tickets, Profile.
- Discover uses the compass icon, Explore uses search, Create uses the persistent white circular plus, Tickets uses the ticket icon, and Profile uses the person icon.
- The footer uses the deepest canvas color, one straight top border without rounded corners, and safe-area padding.
- Every navigation icon uses the same 29 px footprint. Create keeps its white circular fill without becoming larger than the other icons.
- A small red dot on Profile communicates unread notifications.
- Page-specific fixed actions, such as Get Tickets, sit directly above the global footer and must never cover it.
- Notification subpages keep all five items visible without selecting a primary destination.

## Screen implementation checklist

1. Start with the semantic tokens already defined in `globals.css`.
2. Use Inter and the shared typography weights.
3. Reuse existing controls, navigation, cards, badges, sheets, and icon buttons.
4. Keep the five global navigation items unchanged.
5. Check the screen at 390 × 844 and at the 672 px container maximum.
6. Run lint, TypeScript checks, and the production build.
7. Add a new token here before using any new recurring visual value.
