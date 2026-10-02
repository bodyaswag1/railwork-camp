# Ilia Baskakov — Issue 01, Winter 26/27

A magazine landing page for Ilia Baskakov (pro snowboarder, freestyle coach): five full-screen pages, one
gesture = one page, with a WebGL paper-crumple transition between them. Plus `/camp`, a scrolling pull-out
insert for **BAS CAMP Italy 2026** (Valdidentro, December 23–27).

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

Every visible string lives in **`src/content/site.ts`**. Unknowns are marked `TODO` and shown in `[brackets]`
on the page so they're easy to spot: price, spots, program, accommodation, the Jan–Apr schedule, board
seasons and lengths (and which board was the first pro model), Master of Sport, gallery photos and clips,
contacts.

## Swap photos and boards

- **Photos:** `src/assets/photos/ilia-studio.jpg` (cover, camp hero), `ilia-night.jpg` (back cover),
  `ilia-smile.jpg` (stats portrait, coach card). Replace the files, keep the names; Astro makes AVIF/WebP
  srcsets at build time. Higher-resolution originals will look better (TODO in `site.ts`).
- **Gallery:** `gallery.tiles` in `site.ts`. A photo tile uses `photo: 'studio' | 'night' | 'smile'` (add more
  in `src/pages/index.astro` → `photos`). A clip tile takes `video: { src, poster }`; put the files in
  `public/clips/` and use `/clips/…` paths. Clips are muted, looping, lazy, and only play while the gallery is
  on screen.
- **Boards:** `src/assets/boards/board-{1,2,3}-{top,base}.png`, transparent cut-outs, top sheet + base,
  about 205×1112. Captions and labels are in `stats.boards` in `site.ts`.

## Apply form

`/camp` POSTs JSON `{ name, method, contact, level, msg, camp }` to `PUBLIC_FORM_ENDPOINT` (set it in Vercel
or `.env`; Formspree, a Telegram-bot webhook or similar). With no endpoint it simulates a successful send.

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
- **snapshots.ts:** page textures. The outgoing page is captured as it is on screen; the incoming one in its
  pre-landing state (marks hidden, boards waiting to drop). Cached per page, refreshed after changes, pre-warmed
  on idle. Never taken during a move: a gesture waits for them instead.
- After landing, the creases the page just opened from stay on it (a baked overlay, multiply 10% on paper,
  screen 4% on the dark pages). The cover gets a set on first load too.
- **Fallbacks:** `prefers-reduced-motion` gives a 200 ms crossfade with static marks; no WebGL or a failed
  snapshot gives the CSS version (scale + rotate + feTurbulence/feDisplacementMap + a crumpled texture), also
  over the black stage.

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
| `npm test` | Playwright: every page at 390×844 and 1440×900, plus reduced motion and `/camp`. Fails on sideways overflow, or if a page other than the gallery doesn't fit one screen. Then real page turns through WebGL, the no-WebGL CSS fallback and reduced motion. Screenshots go to `shots/`. |
| `npm run check:contrast` | Red text only on light paper, pink text only on dark, WCAG AA for every visible text element. |
| `npm run compare` | Our unfold vs the reference GIF at the same relative times, side by side, with size and solidity → `design/compare.png`, `design/compare.json`. Needs the GIF frames in `design/ref/crumple-frames/` (from the handoff package; not in the repo). |
| `npm run perf [-- url w h cpuThrottle mobile]` | Frame times during real page turns, e.g. `npm run perf -- http://localhost:4322 390 844 4 mobile`. |
| `npm run handoff` | Canvas vs live DOM at p = 0 and p = 1. |
| `npm run lighthouse` | Mobile Lighthouse for `/` and `/camp`. |
| `npm run og` | Re-renders `public/og.jpg` from the cover. |

Latest results (local preview, Windows, AMD integrated GPU):

- **Lighthouse (mobile):** `/` Performance 93, Accessibility 100, Best Practices 100, SEO 100. `/camp`:
  98, 100, 100, 100.
- **Move frame rate:** 60 fps at 1440×900, and 60 fps at 390×844 with the CPU throttled 4×.
- **Hand-offs:** mean difference 0.5–1.2/255; what remains is sub-pixel anti-aliasing on rotated text.
- **Size curve vs GIF** (relative to the flat sheet): ours 0.19 / 0.32 / 0.40 / 0.44 / 0.55 / 1, GIF
  0.26 / 0.37 / 0.45 / 0.52 / 0.68 / 1. Our ball is sized to the spec's ¼–⅓ of the short side.

Known trade-off: snapshots cost about 250 ms on desktop (more on slow phones), so a turn made right after
landing can wait briefly before it starts.

## Not shipped / TODO

- **Figma exports.** The Figma MCP hit the Starter plan's call limit. These are in from Figma:
  `punk_starburst`, `snowboard_jump_arrow`, `photo_frame`, `freestyle_snowboard`, `snowboard_carve_track`,
  `leopard_goggles_drips` (`src/assets/figma/`). Still to swap in (look for `TODO(figma)`):
  `bas-camp-logo` (masthead), `mascot-snowboard` (page counter), `bas-camp-splatter` "Italy 2026" (back
  cover, camp hero) and the rest of the marker set.
- **`design/`, `assets-src/`, `prompts/`** are references only and never ship. The third-party mood images
  (`assets-src/ref-*.jpg`) and the watermarked reference GIF and its frames are kept out of the repo; they're
  in the original handoff package.
