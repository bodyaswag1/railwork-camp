# Handoff: Ilia Baskakov — magazine landing + BAS CAMP Italy 2026

## Overview
A personal site for Ilia Baskakov (pro snowboarder, freestyle coach) that reads like an old, scribbled-on snowboard magazine: five full-screen pages (Cover, Career stats, Gallery, Training, Back cover) navigated one gesture = one page, with a paper crumple → uncrumple transition between pages. A separate scrolling page sells his December camp, BAS CAMP Italy 2026.

## How to use this package with Claude Code
1. New folder (or the existing repo). Copy `design/`, `assets-src/` and `prompts/` from this package into the repo root. Nothing in `design/` ships.
2. Connect the Figma MCP (file: https://www.figma.com/design/rW0npDn5RA8K1a2aaV202E/BAS-CAMP?node-id=0-1).
3. Paste `prompts/1-claude-code-build-site.md`. It plans first and waits for your OK. Approve, let it build.
4. Then paste `prompts/2-claude-code-crumple-transition.md`. It replaces the CRUMPLE TRANSITION section of prompt 1, reports back (pause cause, stage elements, GIF measurements, approach) and waits for your OK. Everything it asks to measure is already in this README, so it can check against it.
   - Starting from scratch? Give it prompt 1 and add one line: "for the transition, follow prompts/2 instead of the CRUMPLE TRANSITION section".
5. To look at the design: `npx serve design`, then open `/Ilia%20Baskakov.dc.html` and `/BAS%20CAMP%20Italy%202026.dc.html`. Use http, not file://. `support.js` has to sit next to them.

## About the design files
The files in `design/` are **design references built in HTML**. They're prototypes that show the intended look and behaviour, not production code. Rebuild them in the target stack from prompt 1 (Astro + TypeScript, GSAP, Three.js, modern-screenshot).

Format: Claude Design "DC" files. Markup with inline styles sits between `<x-dc>` tags, and one logic class sits in `<script data-dc-script>`. `{{ }}` holes are filled from `renderVals()`. `support.js` is only the prototype runtime, so don't port it. Read the markup for layout and styling, and the logic class for behaviour and timings.

## Fidelity
**High fidelity** for layout, type, colour, copy, the marker layer, the paper ageing and the stage graphics. Match them closely.
**Not a reference:** the prototype's transition engine (`turn()`, `crumpleGeo()`, `makeCrumpleMap()`, `skinLayer()`). It fakes paper with a CSS clip-path silhouette, an SVG displacement filter and a hard-light facet overlay. Prompt 2 rebuilds the motion in WebGL. Use only its stage graphics (see "Stage graphics").

## Design tokens
Colours (Figma names, use exactly):
- Night Run `#101314`: ink, dark pages, the black stage
- Lift Tower `#474C48`: secondary dark, rules, captions
- Slush Concrete `#ABAAA6`: paper shadows, staples, muted text on dark
- Airbag Ice `#E1EFFA`: paper, light text on dark
- Park Signal `#BA1422`: red marker, stamps, highlights
- Goggle Tint `#FF94E3`: pink accent, used sparingly
- Paper tint, as layers over `#E1EFFA`: `rgba(214,194,146,.24)` yellowing, vignette `rgba(168,128,62,.34)` at 100%, rust at the staples `rgba(128,62,22,.5)`

Contrast rules: red text only on light paper (5.6:1); on dark pages red is decoration only (2.9:1). Pink works as text on dark (9:1) but never on light paper (1.7:1).

Type:
- Archivo variable (wght 100–900, wdth 62–125 → CSS `font-stretch`): headlines. Widths used: 62% (condensed display), 75%, 88%, 100%, 112%, 125% (wide labels)
- Onest 400–800: body, labels, small print
- Most Wazted: graffiti notes. **The prototype uses Permanent Marker as a stand-in.** Swap in Most Wazted when the file arrives.
- Label style used everywhere: Onest 700, 10–12px, letter-spacing .14–.16em, uppercase

Shape and space: no border radii (everything is square). Rules are 1.5px solid ink (2px for stance and logo boxes, 3px for stamps, 5px for heavy rules). Hard shadow `5px 5px 0 #101314` on the portrait block; tile shadow `0 1px 0 #ABAAA6, 2px 8px 18px rgba(16,19,20,.22)`. Page side padding is 4vw; paper pages use 6vw on the left for the staple margin. The top content offset clears the masthead: `clamp(64px,10svh,96px)`.

## Global chrome (always visible)
- **Masthead** (fixed, z 30, `mix-blend-mode: difference`, so it reads on both dark and light pages). Padding `clamp(10px,2svh,18px) 4vw`.
  - Left: boxed logo `BAS★CAMP` (2px #E1EFFA border, padding 2px 7px, Archivo 900 / 112%, `clamp(13px,1.1vw,16px)`, .03em) next to "ISSUE 01 / WINTER 26/27" (10px, 700, .14em). Clicking it goes to the cover. Use the real bas-camp-logo from Figma.
  - Right: page counter `✶ 01/05` (Archivo 800, 14px, .06em; the ✶ stands in for the Figma mascot) and a MENU button (1.5px border, padding 5px 10px, Archivo 800 / 112%, 12px, .1em).
- **Menu**: a full-screen #101314 dialog. Header "CONTENTS · ISSUE 01" (12px, 700, .16em, #ABAAA6) with a CLOSE ✕ button. A numbered list ("01" at 14px, 700, .1em) with titles in Archivo 900 / 62% at `clamp(44px,8svh,88px)`, line-height .92, uppercase; the current page is pink. Below it, a link "Special insert: BAS CAMP Italy 2026 →" on an #E1EFFA chip. Esc closes it.
- Skip link, plus an aria-live region announcing "Page 2 of 5: Career stats". Focus moves to the page's h1/h2 after each change.

## Pages (each 100svh, full-bleed; 1440×900 and 390×844)
Every paper page has three wear layers on top (pointer-events none, z 4). They're generated in code (see "Paper ageing").

### 01 Cover (`#cover`, dark)
- Background: #101314 plus `radial-gradient(ellipse at 50% 38%, rgba(71,76,72,.5), transparent 62%)`.
- Giant "BASKAKOV" behind the photo: Archivo 900 / 62%, `min(24vw,46svh)`, line-height .8, -.015em, #BA1422, top 17svh, centred, nowrap.
- Photo `ilia-studio.jpg`: bottom-anchored and centred, height `min(90svh,170vw)`, aspect 853/1280. Filter `grayscale(1) contrast(1.55) brightness(.95)`, `mix-blend-mode: screen`, horizontal mask (transparent → black at 16% … 86% → transparent).
- Halftone over everything: 4px dot grid `radial-gradient(circle, rgba(16,19,20,.6) .9px, transparent 1.5px)`, multiply at .55.
- Marker layer in the photo's 853×1280 space: pink halo over the head, red circle on the ring hand, pink arrow plus the note "regular!" (rotated -12°, `clamp(26px,3.4svh,40px)`), pink double zigzag, red speed lines, red double X.
- Top row (top `clamp(64px,10svh,96px)`):
  - Cover lines: Archivo 800 / 75%, `clamp(14px,1.7vw,24px)`, uppercase, max-width `min(54vw,380px)`. Lines: "1620° biggest spin" (the 1620° in pink, 900 / 100%, `clamp(34px,4.6vw,68px)`) · "The Miller Flip issue" · "3× National Champion" plus a pink starburst · "Inside: BAS CAMP Italy, December" as ink text on an #E1EFFA highlight.
  - Right: an issue box "No. 01 / Winter 26/27 / Free · €0.00" (1.5px border, Archivo 800 / 112%, `clamp(10px,.9vw,13px)`, .08em) and a barcode chip ("4 607162 001620").
- Bottom row (bottom `clamp(16px,4svh,40px)`):
  - h1 "ILIA / BASKAKOV" (Archivo 900, `clamp(40px,6.2vw,100px)`, line-height .9) on a #101314 highlight, with a red double underline.
  - Tag "PRO SNOWBOARDER · FREESTYLE COACH" (#E1EFFA chip, ink text, 700, `clamp(11px,1vw,14px)`, .14em).
  - Intro box, max 360px: #101314 background, 1px #474C48 border, `clamp(13px,1.05vw,15px)` at 1.45. Text: "Twenty years on a snowboard, three of them coaching. Regular stance, a 1620 in the bag, and a Miller flip he'd pick over any trick." A red double-box scribble sits around it.

### 02 Career stats (`#stats`, paper)
Two staples (3×26px #ABAAA6 at left 2.2%, top 28% and 72%) with rust halos. Content wraps in two columns centred (gap `clamp(14px,2.6svh,28px) 5vw`) and scrolls inside only if it has to.
- **Portrait block**: a square `clamp(104px,16vw,240px)` on #FF94E3, rotated -2°, with the hard shadow. `ilia-smile.jpg` uses `grayscale(1) contrast(1.8) brightness(1.2)`, multiply, radial mask, and a 5px halftone at .45. A red scribble box goes around it.
- Header: h2 "ILIA / BASKAKOV" (Archivo 900 / 112%, `clamp(28px,4vw,62px)`, line-height .88, red), a 5px ink rule at 70% width, "CAREER STATS" (800 / 125%, `clamp(14px,1.8vw,26px)`) and "20 YEARS RIDING · 3 YEARS COACHING" (600, `clamp(11px,1vw,14px)`, .08em, #474C48). The note "the legend" carries an arrow.
- **Badges** (3×2 grid, each its own treatment):
  - "3×" (900, `clamp(30px,3.6vw,54px)`, red) above "NATIONAL / CHAMPION" (800 / 125%), with a crown
  - "Europa Cup" (italic 800 / 88%) above "Podiums !!" (marker, red)
  - "JUNIOR WORLD" (900 / 62%) above "CHAMPIONSHIP" (700 / 125%) above "participant" (italic)
  - "BIGGEST SPIN" above "1620°" (900 / 75%, `clamp(28px,3.4vw,52px)`) with a red circle
  - "FAVORITE TRICK" above "Miller Flip" (marker, red, double underline)
  - "STANCE" above a boxed "REGULAR" (2px ink border, 900 / 125%) with a zigzag
- **Board row**: three vertical 3D cards, each `height: min(62svh, max(36svh, 44vw))` with aspect 205/1112, front = top sheet and back = base, with a blurred ellipse shadow. A red tag "FIRST PRO MODEL" and a crown sit over board 1. Captions in jersey style: "[—] / PRO MODEL · [SEASON]", "157W / PRO · 2025/26", "[—] / PRO COLLAGE · [SEASON]". Notes: "pro ×3", "#1" and a red arrow over the row. Hint: "JOINT PRO MODELS · TAP A BOARD".

### 03 Gallery (`#gallery`, paper)
- h2 "CONTACT SHEET" (900 / 62%, `clamp(40px,6.4vw,96px)`, line-height .82). Meta: "ROLL 03 · 400 ISO". A tic-tac-toe mark and the note "keepers ↓".
- Grid: `repeat(auto-fit, minmax(max(140px,21%), 1fr))`, gap `clamp(14px,2.2vw,30px)`, max-width `min(1180px, (100svh - 250px) * 2)`. Mobile gets 2 columns and scrolls inside the page.
- Print tile (a button): padding 7px 7px 6px, #E1EFFA, tile shadow, tape strip (40% × 18px, `rgba(214,194,146,.6)`, -3°), rotated per tile (-2° … 2°). Hover straightens it and scales to 1.03 over .2s. The image is square, `grayscale(1) contrast(1.35)`, with halftone. The footer shows the frame number "03A ▸" and the kind. Video tiles show a red REC dot, "VHS · SP", a play triangle and a caption.
- The 8 tiles, with their marks, are listed in `tiles` in the logic class: 03A halo, 03B frame + "night shift", 03C clip, 03D star + "that grin", 03E X, 03F "??", 03G clip, 03H star.
- Lightbox: `rgba(16,19,20,.96)` backdrop, image max 72svh with an 8px #E1EFFA border, ← → buttons at 44×44, caption. Esc, the arrow keys and a 50px swipe all work.

### 04 Training (`#training`, paper)
- Label "SECTION 04 · COACHING". h2 "TRAINING" (900 / 62%, `clamp(64px,10.5vw,160px)`, line-height .8) with a red double underline and a star. The intro is a [placeholder] (max 46ch).
- 3 classified boxes, each with a 1.5px ink border and an ink heading bar (Camps gets red): "Private sessions" · "Group park days" · "Camps: BAS CAMP Italy, Dec 23–27. See the back cover." (red scribble box).
- Tour dates: header "SEASON 26/27 / TOUR DATES" over a 5px ink rule. Rows are separated by 1.5px dashed #474C48.
  - "DEC 23–27" (900 / 75%, `clamp(34px,4.4vw,66px)`) with a red circle, "BAS CAMP ★", "Italy · [Livigno / Valdidentro] · Level Piste+", and a stamp "LAST SPOTS" (3px red border, red, rotated -10°).
  - "JAN –APR" (#474C48), "Season sessions [Dates and places to confirm] ??".
  - Footer note "camp's on the back" with an arrow.

### 05 Back cover (`#camp-ad`, dark)
- `ilia-night.jpg` on the right (right -12vw, full height), `grayscale(1) brightness(2.6) contrast(1.5)`, screen, mask fading in from the left (0 → 30%). A bottom gradient sits under the text, plus halftone.
- Logo: boxed BAS★CAMP (3px border, #101314 fill, 900 / 112%, `clamp(26px,3.6vw,52px)`, red star) with pink splatter dots and the note "Italy 2026" (pink). **Replace it with the Figma bas-camp-splatter variant (265:18813).**
- h2 "RIDE HARD. / LEARN FAST. / SEND IT." (900 / 62%, `clamp(56px,9.6vw,150px)`, line-height .84). "Learn fast." has a pink underline; "Send it." is pink with a starburst.
- Small print (#ABAAA6): "For riders who want more air, more style, more control. Small crew. Big progression."
- Info block (1.5px #E1EFFA, 2 cells): "ITALY · [LIVIGNO / VALDIDENTRO] / LEVEL PISTE+" | "2026 / DECEMBER 23–27" (pink circle).
- Coupon CTA linking to the camp page: #E1EFFA, ink text, padding 14px 18px, `outline: 2px dashed #E1EFFA; outline-offset: 6px`, rotated -1.5°. Hover: rotate 0 and translateY(-3px). Pressed: scale .97. A ✂ sits on the cut line. Text: "COUPON NO. 001 · CLIP & KEEP" / "TAKE THE SPOT →" (900, `clamp(22px,2.4vw,34px)`) / "Dec 23–27 · small crew · **last spots**" (red). A pink arrow carries the note "clip it!".

### Camp page (`BAS CAMP Italy 2026.dc.html`, normal scroll)
A pull-out insert in the same paper world, with sections divided by torn edges. In order: a dark hero (splatter logo + "Italy 2026", h1, "Hosted by Ilia Baskakov…", facts strip, LAST SPOTS) · "What you get" (numbered facts) · "Day by day" (5 day cards, [program to confirm]) · Included / Not included · coach card · FAQ (`<details>`) · "Take the spot" apply form · contacts. Unknowns stay as [placeholders].

## Interactions and behaviour (as prototyped)
- **Paged navigation**: one gesture = one page. Wheel deltas accumulate within a 220ms window, and the page fires past 50. During a transition and for 140ms after any blocked wheel event, input is ignored (the lock keeps extending, which swallows trackpad inertia). Pages are locked for 300ms after landing (prompt 1 asks for ~400ms). Inside a scroller, there's a 300ms guard after reaching the edge. Touch needs a 50px swipe, only at an edge. Keys: ↑ ↓ PgUp PgDn Space Home End. Each page has a hash, and popstate works.
- **Marker draw-on after landing**: every `[data-draw]` stroke animates `stroke-dashoffset` 1 → 0 over 550ms with a 90ms stagger, `cubic-bezier(.3,.6,.3,1)`. Notes (`[data-ink]`) reveal left → right through `clip-path: inset(0 100% 0 0 → 0)` over 480ms, starting after the strokes, 120ms apart. The marks redraw on every visit.
- **Boards (02)**: they drop one by one from -120vh, each 950ms after a delay of 150 + 230·i ms. Keyframes: land at 60%, bounce up 6% at 78%, land at 90%, up 1.2% at 95%, land. Then a flip: rotateY 0 → 180 (40%) → hold → 360, over 1700ms. Hover or tap spins 360° in 950ms `cubic-bezier(.25,.7,.25,1)`. The easter egg on board 1 is 1620° in 2300ms, followed by the note "1620°!" (in 1.5s, holds, out after 3.6s).
- **Transition**: see prompt 2. In the prototype it's an Airbag-tinted paper crumpling on the #101314 stage, with the stage graphics drawing on underneath the paper.
- **Reduced motion**: a 200ms crossfade; marks appear without drawing on.

## Stage graphics (for prompt 2; `[data-tfx]` in the design file)
Back to front (`z-index`): stage #101314 → film layer (`data-name="stage-film"`, z 2, screen) → marks (`[data-tfx]`, z 2) → paper (z 3–4) → paper shading (z 5) → masthead (z 30). In the design file, every element is tagged with `data-name`. Standalone SVG copies are in `design/stage-graphics/`.
- **Film layer**: two vertical scratch lines (`rgba(225,239,250,.3)` 1px and `.18` 1px), two dust dots (2px and 1.5px), and a soft desk light `radial-gradient(ellipse at 50% 46%, rgba(71,76,72,.3), transparent 62%)`. Positions re-randomise and opacity flickers between .3 and .6 at about 12 fps.
- **Compositions** (1000×1000 viewBox stretched to the viewport, `preserveAspectRatio="none"`, non-scaling strokes 6–7px, hand-jitter filter `#jit` = feTurbulence .035 + feDisplacementMap 3.5). One set is picked at random per transition:
  - `stage-set-1`: loop-circle (red), speed-lines (pink), curve-arrow (red), double-x (red), starburst (pink)
  - `stage-set-2`: tic-tac-toe (red), tic-tac-toe-marks O + X (pink), zigzag (red), arc-arrow (pink), loop-circle (red)
  - `stage-set-3`: halo (pink), spiral (red), arrows-in (red), underline (pink), x-mark (red)
- **Figma matches to pull as originals** (SVG-elements 149:18395): starburst → `punk_starburst` · tic-tac-toe → `tic_tac_toe` · zigzag → `triple_zigzag` · curve-arrow / arc-arrow → `snowboard_jump_arrow` (or `snowboard_carve_track`) · speed-lines → `snowboard_speed_arrows` · spiral / loop-circle → `scribble`. Halo, double-x, x-mark, arrows-in and underline have no Figma twin; keep them from the design file.
- `stage-splatter` (240×170px, 7 red/pink dots; vector copy in `stage-splatter.svg`): placed at random in the lower third, left or right, never in the centre. A bas-camp-splatter variant from Figma is a good swap.
- `stage-note`: Most Wazted (Permanent Marker in the prototype), pink, rotated -9°, `clamp(40px,7vw,110px)`, top 10–22%. The text depends on the destination page: cover → "cover!", stats → "the stats", gallery → "keepers", training → "train hard", back cover → "send it!".
- The centre third of the short side is kept clear for the ball. Set-2's loop and arc and set-3's spiral were moved out of it for this handoff.

## Paper ageing (generated in code; see `makeTextures()` / `makeAge()`)
- Per page, a seeded 1600×1000 canvas. Light pages use ink `rgba(92,66,34,a)` at multiply; dark pages use `rgba(225,239,250,a)` at 0.32 strength, screen, .55.
  - Folds: vertical at 50% ±6% (30px), horizontal at 33% and 67% ±5% (20px), with up to 3 random extra folds, dark spots where folds cross, and a wobbly crease line plus fibre specks along each fold.
  - Ageing: 70px edge darkening, about 700 edge-wear specks, one dog-ear corner (90–160px), a coffee ring (r 70–120), 60 hairline scuffs, 70 foxing spots, 2 tape ghosts.
- Grain: 180px noise tiles. Light pages use ink noise at .38; dark pages use light noise at .55.
- Crease texture: a 1200×760 canvas of 28×18 triangulated grey facets plus 80 crease lines. It sits at overlay .3, `background-size: 150%`, with a different position and flip per page.

## Reference GIF measurements (`design/ref/`)
Already done: `crumple-frames/` (76 PNGs plus `delays.json`), `crumple-contact-sheet.png`, `crumple-measurements.json`. The GIF is 480×270 and 5070ms long, with frame delays alternating 70 and 60ms. It holds each pose for 4–5 frames, so the real cadence is about 3.7 poses/s (stop-motion "on fours"). The paper mask is luma > 26, with the watermark excluded.

All sizes below are fractions of frame height:

- **Pose 1: ball.** Frames 0–4, 0–330ms. Equivalent Ø 0.227, bbox 0.23 × 0.23, solidity 0.90, edge roughness 1.03.
- **Pose 2.** Frames 5–9, 330–670ms. Ø 0.318, bbox 0.36 × 0.34, solidity 0.84, roughness 1.18, axis 22°.
- **Pose 3.** Frames 10–13, 670–930ms. Ø 0.388, bbox 0.45 × 0.42, solidity 0.81, roughness 1.17, axis 24°.
- **Pose 4.** Frames 14–17, 930–1200ms. Ø 0.456, bbox 0.62 × 0.51, solidity 0.82, roughness 1.04, axis 30°.
- **Pose 5.** Frames 18–21, 1200–1470ms. Ø 0.595, bbox 0.73 × 0.64, solidity 0.84, roughness 1.01, axis 10°.
- **Pose 6: flat sheet.** Frames 22–75, from 1470ms. Ø 0.871, bbox 1.03 × 0.72, solidity 0.90, roughness 0.98, axis 2°.

What this means for the build:

- **Phases** of the unfold (ball → flat = 1470ms): the ball reads for 0 → 0.22; it opens in 3 steps over 0.22 → 0.82; the final flatten runs 0.82 → 1.0 and is the biggest single jump (area ×2.1). Area relative to the flat sheet goes 7% → 13% → 20% → 27% → 47% → 100%: growth is slow first and fast last. The crumple is this order reversed and compressed.
- **Ball size**: 0.23 of frame height, which is 0.32 of the sheet's short side (the sheet is 1.43:1, roughly A4). For a viewport-sized sheet, aim for a ball Ø of 0.25–0.32 of the short side.
- **Outline**: solidity drops from 0.90 to 0.81 while opening (deep notches and flaps). Roughness peaks at 1.18 in the first opening poses, with many small jagged flaps, then straightens before flattening. The sheet turns 20–30° while opening and lands within 2° of axis-aligned. The centroid stays within 0.045 of centre.
- **Light**: the ball brightens toward -120°, so it's lit from above and slightly left (image coordinates, -90° = up). While opening it brightens toward -101° to -124°. The open sheet is evenly lit (weak gradient).
- **Contrast** (luma 0–255, p5 / p50 / p95): ball 121 / 218 / 250, opening 108–138 / 186–213 / 242–248, flat 138 / 204 / 242. Deep folds sit around 0.5× the highlight brightness.

## The prototype's pause (for prompt 2, step 1)
- **Earlier version** (the one with the visible pause): the crumple and the unfold were two separate WAAPI animations with `steps(n, end)` easing at 12 fps. The crumple only reached its ball keyframe on its last step. Then `await a.finished` handed over to the unfold, whose first step holds that same ball keyframe for 83ms. Two near-identical ball frames plus a frame of hand-off latency froze the ball for about 170–250ms.
- **Current version** (rebuilt this session; still not to be ported): one continuous rAF timeline with a 140ms crossfade at the ball. Some softness remains: c-speed near the ball is low (the crumple ease ends at slope .2 and the unfold starts at .4), and the twist reverses at the ball, so rotation briefly stops. Prompt 2 asks for a continuous tumble instead.

## Assets
- `design/assets/`: what the design file loads. `ilia-studio.jpg`, `ilia-night.jpg`, `ilia-smile.jpg`, and `board-{1,2,3}-{top,base}.png` (transparent cut-outs of the top sheet and base).
- `assets-src/`: photos (`ilia-*.jpg`), original board sheets (`board-1-pro-model.jpg` black/red, `board-2-pro-2025-26.jpg` white/orange 157W, `board-3-pro-collage.jpg` black/teal), `boards-cutout/*.webp` (the same cut-outs as WebP; check the edges before shipping), and references `ref-asap|noir|oakley-summit|oakley-dark|stussy|volcom|rodman.jpg`, which are mood only and never ship.
- From Figma via MCP (not in this package): bas-camp-logo set, mascot-snowboard, red marker SVG set, bas-camp-splatter "Italy 2026" variants, posters.
- `design/ref/crumple.gif`: motion reference only. It carries a makeagif watermark, so never ship it.

## Open TODOs (carry over as TODO in `site.ts`)
- Location: Livigno or Valdidentro
- Board seasons, and which board was the first pro model
- Master of Sport (is it official?)
- Original-quality photos
- Gallery photos and clips
- Mountain shot for the camp ad
- Price, spots, program, accommodation
- Jan–Apr schedule
- Most Wazted font file and its licence

## Files
- `prompts/1-claude-code-build-site.md`: Claude Code prompt that builds the site
- `prompts/2-claude-code-crumple-transition.md`: transition spec (replaces prompt 1's CRUMPLE TRANSITION section)
- `design/Ilia Baskakov.dc.html`: the 5-page landing (layout, marks, ageing, navigation, stage graphics)
- `design/BAS CAMP Italy 2026.dc.html`: the camp page
- `design/support.js`: the prototype runtime only
- `design/stage-graphics/stage-set-{1,2,3}.svg`, `stage-splatter.svg`
- `design/ref/`: GIF, frames, delays, contact sheet, measurements
