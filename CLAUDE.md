# BAS / bascamp.world: working notes for Claude

Read this first in a new session. The README covers how the site works; this file covers the current
state, how to ship, and what tends to go wrong.

## The project

- **Site:** https://bascamp.world (also www.bascamp.world, bas-camp.vercel.app). The home page is a
  six-page magazine for Ilia Baskakov (pro snowboarder and coach); `/camp` is BAS CAMP Italy 2026
  (Livigno, 23–27 Dec 2026, €999, 15 spots, snowboard + ski).
- **Stack:** Astro + TypeScript, static output. GSAP for marks/timelines, Three.js only for the WebGL
  paper-crumple page turn.
- **Branch:** all work happens on `redesign`. `bascamp` mirrors it. `main` still holds an old static
  site and is **not** what production serves. Ignore `fix/layout-polish`: it patches that old site's
  `styles.css`.
- **Copy:** every visible string lives in `src/content/site.ts`. The `TODO` object at the top lists
  what is still missing. Content rules are at the top of that file: €999 is the only camp price, every
  level is welcome, and nothing invented (no fake results, quotes or urgency).
- **Owner:** the person giving feedback relays Ilia's notes, often in Russian, with phone or laptop
  screenshots. Their phone shows about 393×667 of page; check that size as well as 390×844 and
  desktop (1440×900, 1660×877, 1118×733).

## Home page (src/pages/index.astro)

| # | id | What's on it |
| --- | --- | --- |
| 01 | `cover` | Studio portrait, name, CTAs |
| 02 | `ilia` | Career stats: a swipeable **pile** of trick prints (GIFs + photos), "2nd · X Games China" card, six facts, three pro boards (157 Pro Model 23/24 · 159 Pro 25/26 · 161 Pro Collage 24/25) |
| 03 | `next-camp` | Italy poster; on phones Ilia's jump photo fills the space under the button |
| 04 | `coaching` | 20 years riding / 3 coaching, "How a session works", a session GIF (`public/clips/coach-session.gif`) |
| 05 | `progress` | **Pile** of before/after postcards, easiest first: Katya (beginner, new technique in one session) → Max (beginner, 1 m → 14 m) → Timur (intermediate, never tried the BS rodeo → landed into the airbag in one day, next: snow). Phones show the story on the card; desktop shows it beside the pile |
| 06 | `train` | Private coaching (€100/h, €300/day, Instagram DM) vs BAS CAMP; Instagram, phone, email and "↑ Back to start" at the foot (this replaced the old 7th page) |

Contacts: +43 676 9828836 · baskakov.ilia74@gmail.com · Instagram @baskakov74 (fields in `rider`
in site.ts).

## /camp (src/pages/camp.astro)

Sections in order: poster · where we ride (Livigno) · progress with a plan (+ training-programme PDF)
· coaches (Ilia snowboard, Aleksey Bogatyrev ski) · level · camp life · the crew · camp organisation
(a training day: coaching photo, evening video GIF) · the five days · price · final poster + apply
form · FAQ. The form posts to `/api/apply` (`api/apply.ts`), which emails Ilia the application (with a
one-tap chat link and a ready message) and emails the rider a note from Ilia, through Resend from
ilia@bascamp.world. If that fails it hands the application over as an Instagram DM. Email copy is `campMail` in
site.ts, layout `src/emails/apply.ts`, graphics `public/mail/` (re-bake with `node scripts/mail-art.mjs`),
preview with `npm run mail:preview`. Payment terms: €250 reservation fee, the remaining €749 by 9 Dec or in
cash on arrival.

## Patterns worth reusing

- **Piles** (`src/scripts/pile.ts`): stacked prints you swipe, tap or arrow through. GIF prints are an
  `<img data-gif>` over a still poster; the GIF is fetched only once its page is coming up (`wake()` in
  `src/scripts/magazine.ts`, for the print on top and the next one). Text tied to each print uses
  `data-pile-text="<pile id>"`.
- **Single page GIFs:** `<img data-page-gif=…>` over a still, woken the same way.
- **Never in the page-turn copy:** anything marked `data-nocopy` is skipped by the crumple snapshots
  (GIFs, easter eggs).
- **Marks:** `data-draw` / `data-ink` / `data-pen` draw on when a page lands. Doodles come from the
  Figma set (`src/content/doodles.ts`, `<Doodle>`). `scripts/audit.mjs` screenshots six widths and
  lists decoration that leaves the screen or lies on copy.
- **GIFs from clips:** ffmpeg (installed): `fps=8,scale=300–400:-1`, `palettegen max_colors=64`,
  `paletteuse dither=bayer`. Aim for ≤1.5 MB, ~2.4 MB at most.
- **Before/after GIFs:** the clips are split screen. Overlay "before" / "after" in the graffiti font
  (`public/fonts/MostWazted.woff2`; convert it to TTF with fontTools for PIL), pink #FF94E3 with a
  #101314 outline, tilted ±6°. On the site they're cropped square.
- **Colours** (`src/styles/tokens.css`): night-run #101314, park-signal red #BA1422, goggle-tint pink
  #FF94E3, airbag-ice #E1EFFA. Pink doesn't read on white or photo backgrounds; use red there.

## Build, check, test

```bash
npm ci                       # if node_modules is missing
npm run build                # astro check + build; must say "0 errors" (the existing warnings are fine)
npx astro preview --port 4323
```

- **Playwright in this container:** launch Chromium with `executablePath: '/opt/pw-browsers/chromium'`.
  The pinned version wants a browser that isn't installed. For the test suite, copy a config that sets
  `use.launchOptions.executablePath` and `baseURL: 'http://localhost:4323'`.
- **Known failures (no GPU here):** the WebGL crumple tests (transitions "WebGL crumple", robustness
  worker/context/fonts/back-twice, touch "phone swipes always use the paper crumple") and the `/camp`
  form hand-off test. They fail on untouched code too. Everything else should pass.
- **One-screen rule:** `tests/screens.spec.ts` requires every page to fit one screen at 390×844 and
  1440×900, except `ilia`, `coaching` and `train` on phones, which scroll inside.

## Deploy to production (Vercel CLI, from this container)

Pushing to `redesign` does **not** go live. Vercel builds a preview for each push; production goes out
through the CLI:

```bash
export NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1   # Node's fetch must use the agent proxy
npx vercel whoami                                # logged in?
npx vercel login                                 # if not: prints a device-code link; the user approves it
npx vercel link --yes --project railwork-camp --scope contora-s-projects   # once per container
npx vercel deploy --prod --yes                   # look for "Aliased https://bascamp.world"
```

- Without `NODE_USE_ENV_PROXY=1`, login and deploy die with `fetch failed`.
- Even with it, the final request sometimes drops. Retry; uploaded files are reused.
- `vercel link` writes `.env.local`. It's gitignored, and `.vercelignore` keeps `/.env*` out of the
  upload.
- After a deploy, curl the live page with a cache-busting query and grep for a string you just changed.

## Still open

See `TODO` in `src/content/site.ts`: fuller student write-ups and quotes from Ilia; our own photos of
the Christmas market, ice karting and spa; FAQ answers on travel, payment and cancellation;
original-quality photos; the BAS CAMP Telegram channel link (`campMail.channelUrl`) and how to pay the
fee (`campPay.how`). Two smaller ones: a real coaching-moment
clip to replace the slope GIF on the coach page (it's the same footage as /camp's evening video), and
Ilia confirming each student's level (he listed beginner / intermediate / advanced in the same order
as Max, Timur, Katya).
