# Shape — Visual Identity

This is the design source of truth. When in doubt, build to this doc.

## 1. Brand essence

Shape is a craft tool for behavior design. The visual identity should feel:

- **Editorial** — magazine-confident, not SaaS-generic.
- **Calm** — generous space, warm neutrals, slow rhythm.
- **Vivid in punctuation** — one warm accent color, used like a marker.
- **Tactile** — soft shadows, real corners, suggestions of paper.
- **Modern but unhurried** — serifs you'd find in a thoughtful magazine, mono for the machine parts.

## 2. Color

### Primary palette

| Token | Hex | Usage |
|---|---|---|
| `--canvas` | `#F5F4F2` | App background |
| `--surface` | `#FCFBF9` | Card / panel background |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-muted` | `#5A5751` | Secondary text |
| `--ink-quiet` | `#8A8680` | Tertiary text, metadata |
| `--line` | `#E7E4DE` | Borders, dividers |
| `--highlight` | `#FF3D2E` | Vermillion. The accent. |
| `--highlight-soft` | `rgba(255, 61, 46, 0.12)` | Chip backgrounds, hover tints |
| `--highlight-ink` | `#C72A1F` | Highlight color on light tint, for text contrast |

### Usage rules for vermillion

- Numerals (`01`, `02`) on section headers.
- Inline command/code chips: `--highlight-soft` background, `--highlight-ink` text.
- Active-state dots in the bottom pill nav.
- Underlines on hover for primary CTAs.
- Small accent dots on icons and cards.
- **Never** as a flood color on large surfaces. Highlighter behavior only.

### Extended palette (use sparingly)

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#2F7A4F` | Successful evals, "held the line" refusals |
| `--warning` | `#B8761E` | Soft cautions, near-miss states |
| `--danger` | `#9E2A1F` | Hard failures, over-refusals |

These are deeper, more editorial than typical UI greens/ambers — they sit next to vermillion without competing.

### Dark mode

Punted to v1.1. The cream canvas is core to the brand. Dark mode would invert to `#16140F` canvas with `#F0EBE0` ink and a slightly hotter vermillion (`#FF5544`).

## 3. Typography

### Stack

- **Display:** [Fraunces](https://fonts.google.com/specimen/Fraunces) (variable, axes: `opsz`, `wght`, `SOFT`)
- **Body:** [Inter](https://rsms.me/inter/) (variable)
- **Mono:** [Geist Mono](https://vercel.com/font)

All three are free, web-loadable, performant.

### Display tuning

Fraunces benefits from axis tuning. Defaults to use:

```css
font-variation-settings: "opsz" 144, "SOFT" 50, "wght" 400;
```

Push `SOFT` higher (80–100) for hero headlines to soften the serifs. Drop `wght` to 300 for elegant subhead Fraunces use.

### Scale

| Token | Size / Line | Use |
|---|---|---|
| `display-2xl` | 120 / 1.0 | Hero only |
| `display-xl` | 80 / 1.05 | Page titles |
| `display-lg` | 56 / 1.1 | Section titles |
| `display-md` | 40 / 1.15 | Subsection titles |
| `display-sm` | 28 / 1.25 | Card titles |
| `body-lg` | 20 / 1.5 | Subheads, lead paragraphs |
| `body` | 16 / 1.55 | Default body |
| `body-sm` | 14 / 1.5 | Secondary body |
| `caption` | 12 / 1.4 | Labels, metadata |
| `mono` | 14 / 1.5 | Code, prompts, commands |
| `mono-sm` | 12 / 1.4 | Chip text, inline code |

### Font assignment

- Display sizes: **Fraunces**
- Body sizes: **Inter**
- Code/prompts/system messages: **Geist Mono**
- Section numerals (`01`, `02`): **Geist Mono**, small-caps tracking, `--ink-quiet`

## 4. Layout

### Page rhythm

- Max content width: **1280px** for most pages, **960px** for reading-dense pages (curriculum, case studies).
- Section vertical padding: **120px desktop / 64px mobile**.
- Use small-caps mono section numerals (`01 — The Foundation`) to anchor the start of each section.

### Grid

- 12-column desktop grid, **24px gutter**.
- Cards snap to the grid. Most cards span 3–4 columns.
- Layouts breathe — at least one empty column or generous margin on every long-form page.

### Card composition

- **Background:** `--surface`
- **Border:** 1px solid `--line`
- **Radius:** `16px` (cards), `24px` (large hero cards), `999px` (chips and pills)
- **Shadow:** `0 1px 2px rgba(0, 0, 0, 0.04)` resting, `0 4px 16px rgba(0, 0, 0, 0.06)` hover
- **Padding:** `24px` standard, `32px` for hero cards.
- **Empty cards** (placeholders, future-state) use a diagonal hatch pattern at 4% opacity instead of the surface fill — borrowed straight from the impeccable reference.

## 5. Components

### Buttons

**Primary** — black background, white text, vermillion underline-on-hover.
```
bg: #1A1A1A
text: #FFFFFF
radius: 12px
padding: 12px 20px
hover: underline in #FF3D2E
```

**Secondary (ghost)** — transparent, ink border.
```
bg: transparent
text: #1A1A1A
border: 1px solid #1A1A1A
radius: 12px
padding: 12px 20px
hover: bg becomes #1A1A1A, text becomes #FFFFFF
```

**Tertiary (link)** — ink text, vermillion underline, animated arrow `→`.

### Chips

Used for commands, model names, providers, tags.

```
bg: rgba(255, 61, 46, 0.12)   /* --highlight-soft */
text: #C72A1F                  /* --highlight-ink */
font: Geist Mono 12px
padding: 4px 10px
radius: 999px
```

Neutral variant (for tags, status badges): `bg: --line`, `text: --ink-muted`.

### Bottom nav (the pill)

Floating, fixed at bottom of viewport with 32px margin. White background, `--line` border, 999px radius, ~18px padding. Items in Geist Mono small caps with the section numeral preceding the label (`01 Foundation`). Active item: black pill background, white text. Active marker: tiny vermillion dot above the active item.

### Section numerals

```
font: Geist Mono 12px
letter-spacing: 0.08em
text-transform: uppercase
color: --ink-quiet
```

Placement: top-left of each section, on its own line above the section title.

### Inputs (textareas, system prompt fields)

```
bg: --surface
border: 1px solid --line
radius: 12px
padding: 16px
font: Geist Mono 14px      /* prompts are code-adjacent */
focus: border becomes --ink
```

User-facing message inputs (chat box) use Inter, not mono.

## 6. The Shape mark

A morphable form that lerps between **circle → rounded square → soft blob**. Three target SVG paths, interpolated.

- **Favicon:** snapshot at the rounded-square pose.
- **Section dividers:** small (16px) morph, looping slowly (8s).
- **Loading state:** the morph speeds up to ~1.2s.
- **Empty states:** the morph holds at "blob" with a subtle pulse.
- **Brand mark in nav:** static rounded-square with a vermillion dot in the top-right corner.

We use the morph **sparingly** — it's punctuation, not decoration.

## 7. Motion

- Default ease: `cubic-bezier(0.22, 1, 0.36, 1)` (a softer "ease-out-quart").
- Default duration: **240ms** for UI, **480ms** for surface morphs, **800ms** for hero choreography.
- Page transitions: fade-up 8px, 320ms.
- Diff Mode output streaming: characters fade-in over 80ms each, capped at a max stagger of 8ms so long outputs don't drag.

## 8. Iconography

- **Lucide** at 18px / 1.5px stroke for UI.
- Custom monoline icons (Fraunces-display-paired) for major nav and hero cards — drawn at 24×24, 1.5px stroke, in `--ink`.
- Accent dots in vermillion on selected icons (provider logo + a vermillion dot = "active provider").

## 9. Tokens (CSS variables)

```css
:root {
  --canvas: #F5F4F2;
  --surface: #FCFBF9;
  --ink: #1A1A1A;
  --ink-muted: #5A5751;
  --ink-quiet: #8A8680;
  --line: #E7E4DE;
  --highlight: #FF3D2E;
  --highlight-soft: rgba(255, 61, 46, 0.12);
  --highlight-ink: #C72A1F;
  --success: #2F7A4F;
  --warning: #B8761E;
  --danger: #9E2A1F;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  --shadow-rest: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-hover: 0 4px 16px rgba(0,0,0,0.06);

  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 160ms;
  --dur: 240ms;
  --dur-slow: 480ms;
}
```

These will land in `globals.css` and the Tailwind config will alias to them.

## 10. What "Shape" should never look like

Quick guardrails:

- **No gradient meshes.** Cream + vermillion punctuation. That's the look.
- **No glassmorphism.** Solid surfaces only.
- **No purple.** The whole AI category leans purple/violet right now. We're warmer and older-feeling on purpose.
- **No emoji as decoration.** OK in user-generated content; not in chrome.
- **No stock illustrations.** Custom monoline icons + the morphable mark only.
- **No cramped layouts.** If it feels tight, add 24px.
