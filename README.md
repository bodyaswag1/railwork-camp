# Tier S Specialists — landing site

Static marketing site for **Tier S Specialists**, an IT consulting and technical
recruitment agency. Two practices on one page: consulting delivery and talent
placement, joined by the grading rubric the company is named after.

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8000
```

## Files

| File | What's in it |
| --- | --- |
| `index.html` | All markup — hero, practices, grading, process, roles, engagements, proof, contact, FAQ |
| `styles.css` | Design tokens + every component style; tokens map 1:1 onto a shadcn/Tailwind theme |
| `app.js` | Scroll progress, nav state, mobile drawer, grading tabs, role filter, brief form, reveal |
| `vercel.json` | Clean URLs, security headers, cache policy for static assets |

## Page structure

`hero → practices → grading → process → roles → engagements → proof → contact → faq`

Sections carry `data-label` for orientation while editing; only the five in the
top nav are linked from the header. Adding a section means adding an `id`, and a
`<li>` in both the `.topnav` and the `.drawer` lists if it should be navigable.

## Behaviour

Every module in `app.js` finds its own DOM and returns early if it is missing,
so deleting a section never breaks the others.

**Grading ladder** (`#grading`) — a real ARIA tab set: `role="tablist"` with
roving `tabindex`, arrow keys, Home/End. The initially selected tab is read from
the markup (`aria-selected="true"`), so the page shows the same panel with or
without JavaScript. Adding a tier means adding a `<button role="tab">` and a
matching `<div role="tabpanel">` whose `id` the button's `aria-controls` points
at — no JS change needed.

**Role filter** (`#roles`) — buttons carry `data-filter`, chips carry
`data-cat`; matching the two is the whole mechanism. A discipline with no chips
shows the empty note instead of a blank row, so new filter buttons can go in
before their chips exist.

**Brief form** (`#contact`) — one form, two intents. The "I'm hiring" / "I'm
looking" toggle swaps the `data-only` fields and **disables** the hidden ones,
so they never reach the payload. Name and email are validated inline. Nothing is
sent anywhere yet; to wire it up, put a handler URL on the form:

```html
<form class="brief" data-brief data-endpoint="https://your-handler.example/brief" novalidate>
```

With `data-endpoint` set, `app.js` POSTs the fields as JSON (including `intent`)
and only shows the confirmation on a 2xx; failures re-enable the button and point
the sender at the email address. Without it, the submit is logged to the console
and the confirmation shows anyway.

**Scroll progress + nav state** — the gold hairline at the top tracks document
progress; the top bar gets `.is-stuck` past 8px; the current section's nav link
gets `.is-current` from an IntersectionObserver keyed to the middle band of the
viewport.

**Mobile drawer** — below 860px the desktop nav is replaced by the burger. The
drawer closes on link click, on Escape (returning focus to the burger), and when
the viewport crosses back above the breakpoint.

**Scroll reveal** — anything marked `data-reveal` slides in the first time it
enters the viewport. `initReveal` adds the hidden `is-armed` state itself rather
than the stylesheet carrying it, so content stays visible when the script does
not run; it bails out entirely under `prefers-reduced-motion: reduce` or without
`IntersectionObserver`, instead of leaving anything at `opacity: 0`.

## Still placeholder — do not launch without replacing

- **Testimonials** (`#proof`) — the three quotes are marked in the page with
  `[ PLACEHOLDER QUOTES — … ]` and are attributed to "Placeholder name". They are
  invented copy for layout only. Replace them with real, attributed client
  feedback or delete the section; publishing them as-is would be presenting
  fabricated reviews as genuine.
- **Contact email** — `hello@tiersspecialists.com` is a stand-in. It appears in
  `index.html` (contact facts, confirmation panel, footer) and in `app.js` (the
  send-failure message). Swap all four.
- **Rates** (`#engagements`) — the figures are wrapped in
  `<span data-placeholder-figure>`; grep for that attribute to find them. The
  15–22% band and "day rate" are illustrative, not quoted prices.
- **Hero fact bar** — `1 business day` reply, `EU · UK · remote` coverage, and
  `3 names` per shortlist are claims the business has to be able to keep. Confirm
  or edit them.
- **Guarantee wording** — the FAQ and process copy say a replacement guarantee
  exists and that its term lives in the agreement. Make sure it does.
- **Footer legal** — company registration details and a privacy policy link are
  called out as missing in the footer line. The FAQ also references a privacy
  policy that does not exist yet.

## Notes

- Colours are in `:root` as both brand names (`--gold`, `--ink`) and semantic
  aliases (`--surface`, `--on-surface`, `--accent-on-surface`). A section flips to
  the dark palette by re-declaring the semantic tokens on itself — that is all
  `.section--dark` and `.footer` do — so the palette can move to a Tailwind theme
  without touching component rules.
- Fonts (Space Grotesk, Inter, IBM Plex Mono) load from Google Fonts. Self-host
  them if the site needs to work offline or you want to drop the third-party
  request.
- `prefers-reduced-motion: reduce` disables every animation, transition, and
  smooth scroll.
- Both `color-mix()` uses (top bar, selected tier) have a solid colour declared
  immediately before them, so browsers without support fall back rather than
  rendering a transparent bar.

## Deploying

`vercel.json` is ready for a static Vercel project — no framework, no build
command, output directory is the repo root.
