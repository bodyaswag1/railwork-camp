# BAS CAMP rider area: design system

The public site (magazine, camp page) is punk/zine and keeps its own CSS (`tokens.css`, `punk.css`,
`magazine.css`, `camp.css`). The rider area (`/me`, `/book`, `/community`, `/camps`, `/coach`, sign-in, join,
welcome) is an **app**: usable first, BAS in the details. Its whole system lives in `src/styles/app.css`
and is scoped under `body.app`.

## Direction

- Mode: Operate (riders on phones at the hall or the resort, bright light; coaches on laptops).
- Style: accent ladder (taste-skill app style, seed 147664875) mapped onto the BAS palette. Light theme
  chosen from the use scene, not the category.
- Signature: the **season pass**, the week streak drawn as one punched cell per week
  (`src/members/timeline.ts`, `renderPass`). Ridden weeks are Park Signal, a trip is a diagonal hatch
  (paused, not broken), and the current week is outlined.
- Zine traces kept on purpose: condensed Archivo (62% stretch) for day numbers and date stubs, the
  "Founding rider" double-border stamp on the profile. Nothing else from the zine.

## Tokens (`:root` in app.css)

| Role | Value |
| --- | --- |
| ground | `#f3f7fa` (one step toward Airbag Ice) |
| surface / raised / hover | `#ffffff` / `#eaf1f6` / `#f5f8fa` |
| border / line / control | `#dde4e9` / `#edf1f4` / `#c4cdd3` |
| text / muted / faint | Night Run `#101314` / Lift Tower `#474C48` / `#5e6562` |
| primary (filled buttons) | Night Run |
| accent (small marks only) | Park Signal `#BA1422`, ink `#8f0f1a`, tints `#fdf2f3` `#f9e0e3` `#f1bcc2` |
| positive / negative / notice | `#1f7a4a` on `#e0f4e7` / Park Signal on `#fde9eb` / `#7a4a00` on `#fff6dc` |
| radius | card 8, control 6, chip 4, pill 999 |
| spacing | gap 16, card padding 20, bar 56, phone tab bar 64 |
| type | Onest (text, 15px body, 13 small, 12 meta), Archivo 800 at 108% stretch for h1 (24px; 22px on phones) |

Colour budget: about 3–10% of pixels, nearly all as pale accent tints. Red never fills a large area.

## Shell

- One slim Night Run top bar (56px) with a 34px logo. Wide screens: the four tabs (Home, Book, Sessions,
  Crew, plus Coach for staff) sit in the bar, the active one marked by a 3px red underline.
- Phones: the same four or five tabs move to a fixed bottom tab bar (icon and label, active icon red).
- Everything else (Progress, Profile, Camps, Settings, the coach pages, sign out) is in the avatar menu,
  which is the same list at every width.
- Coach pages: `CoachTabs.astro` adds the title plus underline sub-tabs (Riders, Schedule, Camp roster).

## Components

`.card` (+ `--flush`, `--tint`, `--quiet`) · `.rows` / `.row__main` / `.row__sub` / `.row__end` · `.daystub`
(date stub, `--mine` in accent tint) · `.ticket` (next session) · `.pass` (season pass) · `.week` (seven-day
timetable; on phones a list of days) · `.slot--mine|open|loopreq` · `.bars` (month chart, one hue) · `.figs`
(divided figure strip) · `.badge` · `.trick` · `.seg` (segmented filter) · `.utabs` · `.chip` (level:
dashed while self-rated, filled once verified) · `.pill` (status) · `.switch` (self-saving toggle) ·
`.settings-row` (label column and panel) · `.sheet` (dialog; a bottom sheet on phones, created by
`sheet()` in `ui.ts`) · `.photo--empty` (a photo slot waiting for coach uploads) · `.btn` (primary
near-black, `--ghost`, `--danger`, `--small`).

## Rules

- Typing happens in sheets opened on demand (password, trips, profile details, ride posts, camp
  applications, moves and cancels). Switches save themselves. No form sits open on a page by default.
- One primary action per screen. The next session is always the biggest thing on Home.
- No rankings, no leaderboards, no zero walls. Empty modules keep their frame and say one honest sentence.
- Photo slots are marked as slots (hatched, with a camera label) and are never filled with stock images.
- Page styles that touch script-rendered markup use `<style is:global>`.
