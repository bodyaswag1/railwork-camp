# RAILWORK — park camp landing page

Static landing page for a three-day snowboard park camp at Klínovec (28–30 Aug 2026).
Implemented from the `Railwork Camp.dc.html` Claude Design file.

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8000 --directory railwork-camp
```

## Files

| File | What's in it |
| --- | --- |
| `index.html` | All markup — hero, coach, three days, reviews, pricing, register, FAQ |
| `styles.css` | Design tokens + every component style; tokens map 1:1 onto a shadcn/Tailwind theme |
| `app.js` | Elevation rail, photo pile, pricing→form handoff, signup form |

## Behaviour

**Elevation rail** (left edge) — markers are generated from `main section[data-alt]`, so
adding a section with `data-alt` and `data-label` is enough to put it on the rail. The
readout interpolates 1244 m → 900 m across scroll progress; below 760 px the rail is too
thin for names, so markers show altitudes instead.

**Photo pile** (coach section) — click, scroll, or arrow/enter keys to flip through three
frames. Scrolling advances the pile without hijacking page scroll.

**Pricing → form** — each tier's "Reserve your spot" preselects that tier in the signup
`RUN` dropdown.

**Signup form** — validates name and email inline, then shows the confirmation panel.
Nothing is sent anywhere yet. To wire it up, put a handler URL on the form:

```html
<form class="signup" data-signup data-endpoint="https://your-handler.example/signup">
```

With `data-endpoint` set, `app.js` POSTs the fields as JSON and only shows the
confirmation on a 2xx; failures re-enable the button and point the rider at the email
address. Without it, the submit is logged to the console and the confirmation shows
anyway — which is what the design mockup did.

## Still placeholder

These are stand-ins from the design and need real content before launch:

- **Hero footage** — `<video data-hero-video>` has no `<source>`. Add one plus a
  `poster`, and the `[ HERO FOOTAGE ]` slate hides itself automatically.
- **Photo pile frames** — three `<img data-pile-img>` slots with no `src`. Set `src`
  and `alt` on each; the mono caption drops out once an image is present.
- **Rider quotes** — marked in the page with `[ PLACEHOLDER QUOTES — … ]`.
- **Coach specs** — `YEARS RIDING` and `STANCE` are `TBC`.
- **Social links** — Instagram and YouTube in the footer point at `#`.

## Notes

- Fonts (Archivo, Public Sans, JetBrains Mono) load from Google Fonts. Self-host them if
  the site needs to work offline or you want to drop the third-party request.
- `prefers-reduced-motion: reduce` disables every animation, transition, and smooth
  scroll.
- Colours are in `:root` as both brand names (`--signal`, `--asphalt`) and semantic
  aliases (`--primary`, `--background`), so the palette can move to a Tailwind theme
  without touching component rules.
