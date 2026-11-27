# Mop Boss — Design Handoff (approved Phase 1 prototype)

This folder is the source of truth for the approved design. It is reference
material only: nothing in here ships as-is.

## What is in this folder

| Path | What it is |
| --- | --- |
| `prototype/Main.dc.html` | Desktop homepage, all 11 sections, with the hero animation, magnetic CTA and reveal slider |
| `prototype/Mobile-Home.dc.html` | Mobile homepage: its own composition, not a shrunk desktop page |
| `prototype/Quote.dc.html` | Six-step quote flow, desktop (state machine and validation live in the script block) |
| `prototype/Mobile-Quote.dc.html` | Same flow at phone width |
| `prototype/Services.dc.html` | Services page |
| `prototype/About.dc.html` | About Linda page |
| `prototype/Gallery.dc.html` | Before & After gallery with filter chips and the auto-sweep |
| `prototype/System.dc.html` | The design system board |
| `brand/mopboss-logo.png` | Script logo with mop and bucket (1080×750, near-white #FCFCFC ground) |
| `brand/linda-badge.png` | Round badge with Linda Tucker illustration (1080×1080, near-white ground) |

### How to read the `.dc.html` files

They are prototype files from a design tool, not production code.

- All markup sits inside `<x-dc>`. Shared CSS (classes, keyframes, media queries) is in `<helmet><style>`; most layout is in inline `style` attributes. Exact values (sizes, paddings, radii, colours, easings) are in there: copy them, do not round them.
- `{{ name }}` is a template hole filled from `renderVals()` in the `<script type="text/x-dc">` block at the bottom. `<sc-for>` is a loop, `<sc-if>` is a conditional. That script block holds each page's behaviour.
- `./support.js` is the design tool's runtime. Ignore it; do not try to load it.
- Image sources are opaque ids. Map them to the brand files:
  - `/_blob/384a9dfb0d62e77ce98aaa2449110d9c` → `brand/mopboss-logo.png`
  - `/_blob/3079ed7a70bb70bf562d978f55bff70a` → `brand/linda-badge.png`
- Links such as `Quote.dc.html` are page links: Home `/`, Services `/services`, About `/about`, Gallery `/gallery`, Quote `/quote`.

## Design tokens

### Colour

| Token | HEX | Use |
| --- | --- | --- |
| Boss Pink | `#FC1D8A` | Primary fills, CTAs. Ink text on it is 5.3:1 |
| Deep Pink | `#D6006C` | Pink text and links on white (5.2:1) |
| Bubblegum | `#FB65A4` / `#FF7DB8` | Illustration and icon fills only |
| Light pink on ink | `#FF6FB1` | Eyebrows and links on black sections |
| Ink | `#0B0B0C` | Type, outlines, hard shadows, dark sections |
| White | `#FFFFFF` | Main ground |
| Blush | `#FFF3F8` | Alternate section ground |
| Champagne Gold | `#FDCA57` | Sparkles only. Never text, never large fills |
| Body grey | `#3A3A40` | Body copy on light grounds |
| Muted grey | `#55555C` | Captions on light grounds |
| Body on ink | `#D9D9DE` / `#B9B9C0` | Body and small print on black |
| CTA shadow on pink | `#7A003C` | Hard shadow under the ink button on pink grounds |

White on Boss Pink is only 3.7:1: use it for display type of 24px or more, never for body text or small labels.

### Typography (Google Fonts)

- Display: **Unbounded** 900, uppercase, letter-spacing −0.025em, line-height 1.0 to 1.02. Fallback `'Arial Black', sans-serif`.
- Accent: **Bodoni Moda** italic 800, sentence case, one phrase per headline, set 1.12 to 1.14× the display size, Deep Pink. Fallback `Didot, Georgia, serif`.
- Body: **Poppins** 400/500/600/700, line-height 1.6. Fallback `system-ui, sans-serif`.
- Eyebrow label: Unbounded 700, 12px, letter-spacing 0.18em, uppercase.

| Role | Desktop | Mobile |
| --- | --- | --- |
| H1 hero | `clamp(38px, 5.6vw, 84px)` | 39px |
| H2 section | `clamp(34px, 5vw, 72px)` | 32px |
| H3 card title | 21 to 22px | 17 to 19px |
| Lead / body / small | 19 / 16 / 13.5px | 16.5 / 16 / 13.5px |

### Layout

- Container: max-width 1328px, side padding `clamp(20px, 4vw, 56px)`. Mobile side padding 20px.
- Section padding: 92 to 108px desktop, 56 to 60px mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 120.
- Radii: 10 (chip), 16 (input), 22 to 28 (card), 36 (reveal frame), 999 (pill).
- Outline: 2.5px solid Ink on cards and buttons, 2px on section rules.
- Shadows are hard, never soft: `0 6px 0 #0B0B0C` buttons, `0 8px 0 #0B0B0C` cards.
- Breakpoints: 390 (mobile design width), 768, 1024, 1440 (desktop design width). Below 760px the desktop nav links and phone number hide.

### Components (see `System.dc.html` and the class definitions in each file)

- **Boss button** (`.boss`): pill, Boss Pink, ink text, 2.5px ink outline, hard 6px shadow, a gloss highlight across the top 40%. Hover: shadow grows to 10px and a diagonal gloss sweeps across in 0.75s. Pressed: shadow drops to 2px. `.boss.ink` is the ink version for pink grounds. Disabled: grey `#E9E4E6` with `#8E8E96` outline.
- **Ghost button** (`.ghost`): white pill with ink outline, inverts on hover.
- **Sticker card**: white, 2.5px ink outline, radius 22 to 28, hard shadow.
- **Medallion**: white disc with a pink ring then an ink ring (`box-shadow: 0 0 0 8px #FC1D8A, 0 0 0 16px #0B0B0C`). Holds the logo, icons and Linda's badge.
- **Sparkle** (`.sp`): four-point star as a `clip-path` polygon, gold. **Bubble** (`.bub`): outlined circle with a highlight.
- **Mop fringe**: scalloped radial-gradient edge under every black section.
- **Placeholder chip** (`.ph`): dashed gold. Marks content awaiting confirmation. See "Content rules".
- **Service row** (`.svc`), **option card** (`.opt`), **filter chip** (`.chip`), **mobile thumb bar** with raised quote button.

## Signature interactions

| Name | Where | Spec | Reduced motion |
| --- | --- | --- | --- |
| The Clean Sweep | Home hero, on load, replay button | A dusty film (`.grime`) covers the hero; a mop SVG crosses left to right and the film is wiped with it via `clip-path`. 1.7s, 0.5s delay, `cubic-bezier(.6,0,.3,1)`. The word "mess." wipes from grey to outlined pink (0.55s, 0.85s delay). Bubbles and sparkles fade in at 2s | No film, no mop, page loads clean |
| The Boss Treatment | Primary CTA | Button translates toward the cursor inside a 16px halo: x offset × 0.22, y offset × 0.34. Gloss sweep and a three-sparkle pop (0.7s, staggered 80ms) on hover | Static button, no sparkles |
| The Transformation Reveal | Home, Gallery | Native `<input type="range">` over the frame drives a CSS variable `--p`; the clean layer is clipped with `inset(0 calc(100% - var(--p)) 0 0)`. Clean side is on the left. Works with drag, tap and arrow keys; the frame shows a focus ring via `:focus-within`. Gallery adds "Sweep it for me": 1.8s ease-out-cubic tween | Sweep jumps straight to 100% |
| The Sweep Track | Quote flow | Dusty progress bar fills pink with a mop knob, 0.6s `cubic-bezier(.2,.8,.2,1)` per step. Steps slide in from 28px right over 0.5s | Instant |

Scroll reveals: elements fade up 34px (26px mobile) over 0.8 to 0.9s when 10% visible, once. Content must be visible by default if scripting or IntersectionObserver is unavailable.

## Content rules

Confirmed facts, and the only ones:

- Business name: **Mop Boss**
- Owner: **Linda Tucker, Expert Housekeeper**
- Phone: **(513) 319-4988** (`tel:+15133194988`)

Everything else is unconfirmed. In the prototype it appears as a dashed gold chip in [brackets]:

- Service list, inclusions and pricing (the five categories are suggestions)
- Quote-form options: property types, size ranges, frequencies
- Service area, hours, email
- Insured / bonded status, years in business, satisfaction policy
- Client reviews
- Linda's bio, pull quote and note; any photo of Linda
- Response time for quotes; privacy note
- Real before/after photos (the prototype scenes are illustrations, labelled as demos)

Marketing copy, service descriptions and the "Why Mop Boss" / "Boss Standard" lines are draft copy awaiting Linda's sign-off.

Do not redraw, recolour or crop through the logo or the badge. Both sit on a near-white ground: place them on white, or use `mix-blend-mode: multiply` on light grounds, or inside a white medallion on dark and pink grounds.
