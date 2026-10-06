# Ilia Baskakov · BAS

The home page is an evergreen magazine for Ilia Baskakov, professional snowboarder and coach, and the BAS
ecosystem: eight full-screen pages, one gesture = one page, with a WebGL paper-crumple transition between them.
They answer, in order: who Ilia is, why he's an elite rider, whether he can teach, the proof (student
progress), how to train with him, what BAS life is, and what to do next.

| # | Page (`id`) | What it does |
| --- | --- | --- |
| 01 | Cover (`cover`) | Name, "Ride better.", 3× National Champion · Europa Cup podiums · 20 years riding, 1620°, the two CTAs |
| 02 | The rider (`ilia`) | "20 years on snow." — a swipeable strip of proof points (1620°, 3×, Europa Cup, 20, 3 pro models, Junior World) + stance and favourite trick |
| 03 | The coach (`coaching`) | 20 years riding / 3 years coaching, the coaching loop (watch → understand → adjust → repeat) |
| 04 | Student progress (`progress`) | Three student stories: vertical video, starting point, what they worked on, result, quote |
| 05 | Train with Ilia (`train`) | Private coaching (from €150/day, opens an Instagram DM) or BAS CAMP (→ `/camp`) |
| 06 | BAS life (`life`) | "Come for the riding. Stay for the people." — a photo strip, photos open full screen |
| 07 | Next camp (`next-camp`) | BAS CAMP Issue 01 teaser: Italy, 23—27 Dec 2026, Snowboard + Freeski, 12 spots, €800 |
| 08 | Your next level (`next-level`) | The two paths again, Instagram, footer |

The masthead keeps the brand, the page counter, the nav (Ilia · Coaching · Camp · Instagram) and the
**Join BAS CAMP** CTA on every page. `/camp` is the dedicated camp page: everything about BAS CAMP Italy 2026
(Valdidentro, December 23–27) and the application.

Astro + TypeScript, static output. GSAP (+ DrawSVG) for timelines, Three.js only for the transition (loaded
on the first pointer/touch/key/wheel), modern-screenshot for page snapshots.

## Run

```bash
npm install
npm run dev          # http://localhost:4321  — add ?debug for the transition panel
npm run build        # astro check + static build into dist/
npm run preview      # serves dist/ on http://localhost:4322
```

## Deploy (Vercel)

`vercel.json` pins the framework (Astro), install/build commands and the `dist` output, so a branch builds
even if the Vercel project was set up for a plain static site. If the site sits in a subfolder of the repo,
set that as the project's root directory. Set the environment variable `PUBLIC_FORM_ENDPOINT` (see below) and update `site` in
`astro.config.mjs` to the real domain (canonical and OG URLs use it). `vercel.json` adds clean URLs (`/camp`)
and long cache headers for hashed assets and fonts.

## Edit copy

Every visible string lives in **`src/content/site.ts`**. Unknowns are marked `TODO` there and shown in
`[brackets]` on the page so they're easy to spot. Still to fill in (the `TODO` object at the top lists them):

- **Student progress (`progress.cases`):** the 3 student videos and, per rider, name, where they started,
  what they worked on, the result and an optional quote. Nothing here is invented: until a case is real it
  stays a placeholder.
- **Coaching photo or clip (`coachPage.media`)**, **BAS life photos** (crew dinner, spa; `life.tiles`).
- **Camp page:** the day-by-day program, hotel, St. Moritz itinerary, spa, what the €800 includes, the second
  coach.

Content rules from the brief, kept in `site.ts`: the public BAS CAMP price is **€800** (no other price is
shown); BAS CAMP takes **every level, complete beginners included**, with groups by snowboard / ski,
experience and level; no invented achievements, results, reviews or quotes; no fake urgency.

## Photos, videos, boards

- **Photos** (`src/assets/photos/`): `ilia-bib-27.jpg` (cover), `ilia-air.jpg`, `ilia-rail.jpg`,
  `ilia-night.jpg`, `ilia-studio.jpg` (rider strip, final page), `ilia-smile.jpg` (BAS life, camp coach card),
  `life-glacier.jpg` (BAS life, camp option), `ilia-jump.jpg` (next-camp poster),
  `camp-coaching.jpg` (camp training day), `life-fisheye.jpg`, `life-bandana.jpg` (BAS life). Replace a file, keep its name; Astro makes AVIF/WebP srcsets at build time.
  The current files are compressed messenger copies (≤1280 px): originals will look sharper.
- **Rider strip:** `riderPage.slides`. A slide is `photo` (a photo + a big stat), `number` (a giant figure on
  red) or `boards` (the three pro-model bases).
- **Student before/after GIFs:** `GIFS` above `progress` in `site.ts` (riders 01 and 02): the GIF in
  `public/clips/progress-0n.gif` over its still first frame in `src/assets/clips/progress-0n.jpg`; it loads
  once the progress page comes up.
- **Student videos:** `progress.cases[n].video = { src, poster }`, vertical clips in `public/clips/` with
  `/clips/…` paths. A case with a video gets a play button (muted, looping, plays inline, stops when the reader
  turns the page); without one it shows a placeholder frame.
- **BAS life:** `life.tiles` (`photo` + caption, or `todo: true` for a placeholder). Photos open in a viewer.
- **Boards:** `src/assets/boards/board-{1,2,3}-{top,base}.png`, transparent cut-outs, about 205×1112.

## Carousels

The rider strip, the student stories and BAS life are horizontal carousels (`src/scripts/carousel.ts`):
drag or swipe, ← → buttons and keys, trackpad sideways scroll. A sideways gesture moves the strip and never
turns the page; a vertical one turns the page as anywhere else. The strip moves with a transform (not native
scrolling) so the paper's copy of the page shows exactly the slide the reader is on. On desktop the student
stories fit side by side and the carousel switches itself off.

## Apply form

`/camp` POSTs JSON `{ name, discipline, method, contact, level, msg, camp }` to `PUBLIC_FORM_ENDPOINT` (set it
in Vercel or `.env`: Formspree, a Telegram-bot webhook or similar). **With no endpoint** (the current state)
the form never pretends to send: it writes the application out and offers "Copy & open Instagram", which
copies it and opens a DM with @baskakov74 (`ig.me/m/baskakov74`) to paste and send. Private coaching CTAs open
that DM directly.

## Fonts

Archivo (variable, width axis) and Onest come from Fontsource. **Most Wazted** is self-hosted in
`public/fonts/`. Its licence (`public/fonts/MostWazted-license.txt`) allows personal and commercial use and
forbids selling the font, so web embedding is fine. It has no glyphs for `°`, `→`, `↓` or `★`, which fall
back to Archivo inside notes.

## The page turn

On a gesture, the current page crumples into a ball on a black stage while red/pink marks draw on underneath,
then the next page opens out of the same ball (`src/scripts/crumple/`).

- **folds.ts:** paper that folds instead of stretching. A tree of non-crossing fold lines, each piece rotating
  rigidly about its own line (no tears, no stretch), plus a bounded zig-zag crease web for straight creases and
  flat facets. Big folds go first, then smaller ones; edge tucks make the outline jagged immediately. The
  unfold opens the outer pieces first and the half-sheet fold last (the big final flatten), so it never plays
  the crumple backwards. The ball loosens along the size curve measured from the reference GIF.
- **shaders.ts:** the same folding on the GPU, flat facets from derivative normals (smooth only inside the
  narrow bend bands), light from above-left as in the GIF, darker deep folds, the paper's back with 5%
  show-through, a rim light so the black back cover still reads on the black stage.
- **timing.ts:** one GSAP timeline, p 0 → 1, ball at 0.5 with a rounded turn (no hold). Drawn at `FILM_FPS`
  with 1–2 held frames away from the ball; stop-motion jitter, gate weave and flicker fade to zero at both
  ends.
- **snapshots.ts:** page textures, copied from the DOM with modern-screenshot. Copying is the most expensive
  thing the site does, so each page is copied just twice in its life: its pre-landing look (marks hidden,
  carousels on their first slide: what an arriving page shows) and its landed look (what a leaving page
  shows; a page whose carousel was moved gets a copy per slide, keyed on it). A page
  that scrolls inside is copied as its background plus its whole content column, so any scroll position is
  composed in a few milliseconds. The wear layers and left-over creases are drawn on with the CSS blend modes.
  One capture context is reused (fonts and photos are fetched and encoded once, in modern-screenshot's worker),
  only the CSS properties the pages use are copied (`style-props.ts`), and a copy yields to the browser every
  8 ms. Copies run in the background only while the reader is quiet and the page on screen has finished
  animating in. A touch, scroll or key press pauses a background copy, and it carries on from where it was
  once the reader has been still for 0.4 s. A page turn stops it, unless it's a copy that turn needs: then it
  carries on as the turn's own. A copy of a page that changed meanwhile (a slide moved, the photo viewer
  opened) is thrown away and redone. Photos in carousel slides that are off screen aren't copied (their boxes
  are, so the strip keeps its layout). A copy that makes no progress for 9 s is given up and the capture context rebuilt,
  so a stalled download can't block page turns. Never taken during a move. On a turn, the leaving page's
  entrance animations jump to their end so the screen matches its landed copy. `<video>` clips aren't
  copied (the paper shows the tile under them).
- Fold sets are generated in a worker (`folds.worker.ts`), one turn ahead.
- After landing, the creases the page just opened from stay on it (a baked overlay, multiply 10% on paper,
  screen 4% on the dark pages). The cover gets a set on first load too.
- **Loading:** the engine's file (Three.js and all, ~150 KB gzipped) is prefetched right after the page loads
  (download only; the build writes its hashed name into a `<meta name="crumple-chunk">`, see
  `astro.config.mjs`). The engine itself (WebGL, shader compile, first copies) starts 2.5 s after load, or at
  the first touch, scroll, wheel or key. A swipe made while it starts waits for it (up to 3 s, then that one
  turn is a crossfade): on a device with WebGL the page turn is always the paper crumple. Once it's running,
  the wear textures are decoded and drawn once at idle, so the GPU's first-use shader compiles don't land in
  the first turn, and the first turn's folds are generated in the worker while its pages are copied.
- **Fallbacks:** `prefers-reduced-motion` gives a 200 ms crossfade with static marks; a device without WebGL
  gets the CSS version (scale + rotate + feTurbulence/feDisplacementMap + a crumpled texture), also over the
  black stage. If a WebGL turn fails, that one turn is a quiet crossfade.

### Tuning

Every number is in **`src/scripts/crumple/config.ts`**: duration, rounded turn, fold counts and angles,
crease strength and density, ball size and lumps, tumble, light, the after-landing crease strength,
`FILM_FPS`, holds, jitter, weave, flicker, stage timing and density, mesh segments, DPR cap. Each field is
commented.

Open any page with **`?debug`** for a lil-gui panel over the whole config, a progress scrubber, a "new seed"
button and play buttons. From the console:

```js
__crumple.seek(0.5)                      // freeze any frame (to the next page)
__crumple.seek(0.3, { to: 4, seed: 7, stage: false })
__crumple.release()
```

None of this loads without `?debug`.

## Checks

Run against `npm run preview` (or set `BASE_URL`):

| Command | What it checks |
| --- | --- |
| `npm test` | Playwright: every page at 390×844 and 1440×900, plus reduced motion and `/camp`. Fails on sideways overflow, or if a page doesn't fit one screen at those sizes. Then real page turns through WebGL, the no-WebGL CSS fallback and reduced motion; phone gestures (swipes, carousels, the "back to the cover" button); the `/camp` DM hand-off; failure modes (workers, WebGL context loss, fonts late, back pressed twice); copies matching the page. Screenshots go to `shots/`. |
| `npm run check:contrast` | Red text only on light paper, pink text only on dark, WCAG AA for every visible text element. |
| `npm run compare` | Our unfold vs the reference GIF at the same relative times, side by side, with size and solidity → `design/compare.png`, `design/compare.json`. Needs the GIF frames in `design/ref/crumple-frames/` (from the handoff package; not in the repo). |
| `npm run perf [-- url w h cpuThrottle mobile]` | Frame times during real page turns, e.g. `npm run perf -- http://localhost:4322 390 844 4 mobile`. |
| `node scripts/mobile-journey.mjs [url] [cpu] [label] [reader\|skim]` | A phone reader (390×844 @3x, real touch input, CPU slowed): reads, scrolls, swipes. Per turn: which effect ran, `latency` (from the swipe counting as a turn to the paper moving), frame times in the move and while landing; jank while scrolling; what blocked the main thread; and a timeline of every page copy (`snap:start/done/gave-way/failed`, with the reason). |
| `node scripts/style-props.mjs [url]` | Regenerates `src/scripts/crumple/style-props.ts`, the CSS properties page copies compare. **Re-run after changing page CSS.** |
| `node scripts/snapprof.mjs [url]` | Times and profiles single page copies. |
| `npm run handoff` | Canvas vs live DOM at p = 0 and p = 1. |
| `npm run lighthouse` | Mobile Lighthouse for `/` and `/camp`. |
| `npm run og` | Re-renders `public/og.jpg` from the cover. |

Latest results (local preview, Windows, AMD integrated GPU):

- **Lighthouse (mobile):** `/` Performance 93–98 (TBT 20–70 ms), Accessibility 100, Best Practices 100,
  SEO 100. `/camp`: 99, 100, 100, 100.
- **Move frame rate:** at 390×844 @3x with the CPU slowed 2× or 4×, median and p95 frame 16.7 ms in every move.
- **Phone reader (390×844 @3x), wait from the swipe to the paper moving:** CPU 2×, reading or skimming: ~0.4–0.5 s
  for the first turn after load, then instant for every turn. CPU 4×: ~2 s for a first turn made within ~4 s
  of load (the engine is still starting and copying the first pages), then instant. Scrolling inside pages has
  no dropped frames.
- **Hand-offs:** mean difference 0.4–1.2/255 on every page at p = 0 and p = 1 (sub-pixel anti-aliasing); a
  carousel left on slide 3: 0.9/255.
- **Size curve vs GIF** (relative to the flat sheet): ours 0.19 / 0.32 / 0.40 / 0.44 / 0.55 / 1, GIF
  0.26 / 0.37 / 0.45 / 0.52 / 0.68 / 1. Our ball is sized to the spec's ¼–⅓ of the short side.

Known trade-off: a page copy costs ~60–200 ms on desktop and ~0.5–0.7 s on a CPU slowed 4× (photos are a small
part of it: the fixed cost is cloning the page and rasterising it with its fonts), mostly in small slices, but
the final rasterisation of each copy is one task (~0.2–0.5 s at 4×) that can't be split. That's
why copies wait for quiet moments and never run while the page on screen animates in: a turn made before a
page could be copied in the background waits for its copies instead.

## Not shipped / TODO

- **Figma exports.** The Figma MCP hit the Starter plan's call limit. These are in from Figma:
  `punk_starburst`, `snowboard_jump_arrow`, `photo_frame`, `freestyle_snowboard`, `snowboard_carve_track`,
  `leopard_goggles_drips` (`src/assets/figma/`). Still to swap in (look for `TODO(figma)`):
  `bas-camp-logo` (masthead), `mascot-snowboard` (page counter), `bas-camp-splatter` "Italy 2026" (camp
  hero) and the rest of the marker set.
- **`design/`, `assets-src/`, `prompts/`** are references only and never ship. The third-party mood images
  (`assets-src/ref-*.jpg`) and the watermarked reference GIF and its frames are kept out of the repo; they're
  in the original handoff package.
