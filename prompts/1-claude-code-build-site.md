Build the website for Ilia Baskakov, pro snowboarder and freestyle coach: a landing page that behaves like an old sports magazine (5 full-screen pages with a paper-crumple transition between them), plus a separate page for his December camp, BAS CAMP Italy 2026.

Start in plan mode: inspect the Figma file and /assets-src, list what you found and what's missing, propose the plan, and wait for my OK before writing code.

SOURCES
- Figma via the Figma MCP (get_metadata, then get_screenshot / get_design_context). Export marks, logos and the mascot as SVG and keep them vector.
  https://www.figma.com/design/rW0npDn5RA8K1a2aaV202E/BAS-CAMP?node-id=0-1 (page "Logo / posters")
  - Color palette 271:35281 · Typography 271:35282
  - Logo 271:35266: 9× bas-camp-logo (basic / red / letters × grey / white / inverted background)
  - Mascot 271:35267: 6× mascot-snowboard (black / red)
  - SVG-elements 149:18395, the red marker set: photo_frame, punk_starburst, trophy, crown, crow, idea_bulb, number_one, leopard_spots, scribble, rock_horns, freestyle_snowboard, snowboard_jump_arrow, snowboard_carve_track, snowboard_speed_arrows, smiley, snowboard_goggles, snowboard, spiky, triple_zigzag, tic_tac_toe, leopard_goggles, leopard_goggles_drips, grin_drips
  - logo variants 265:18813: 8× bas-camp-splatter with the "Italy 2026" tag
  - Posters 271:35268: 8 Instagram posters + the "Poster style" note (in Russian). This is the house style to match.
- Approved screens from Claude Design (if attached) are the visual source of truth. This brief covers structure and behaviour.
- /assets-src: ilia-studio.jpg, ilia-night.jpg, ilia-smile.jpg, board-1-pro-model.jpg, board-2-pro-2025-26.jpg, board-3-pro-collage.jpg, ref-*.jpg. References are mood only: never ship them, never copy their logos or text.

STACK
- Astro + TypeScript, static output, routes / and /camp, deploy-ready for Vercel
- GSAP for timelines, DrawSVGPlugin for the marker draw-on
- Three.js only for the crumple transition, loaded after first paint
- modern-screenshot for page snapshots
- Self-hosted fonts: Onest and Archivo via Fontsource (Archivo variable; use the width axis), Most Wazted from /public/fonts (not on Google Fonts; I'll supply the file, flag it if its licence doesn't allow web use)

TOKENS (CSS custom properties, Figma names)
--night-run #101314 · --lift-tower #474C48 · --slush-concrete #ABAAA6 · --airbag-ice #E1EFFA · --park-signal #BA1422 · --goggle-tint #FF94E3
--font-display Archivo · --font-body Onest · --font-graffiti Most Wazted (short accents only)
Contrast: red text only on light paper; on dark pages red is decoration only; pink never as text on light paper. Add an automated contrast check.

CONTENT: every string in src/content/site.ts, unknowns marked TODO
- Rider: Ilia Baskakov, pro snowboarder and freestyle coach · 20 years riding · 3 years coaching · stance regular · biggest spin 1620° · favorite trick Miller flip · 3× National Champion · several Europa Cup podiums · Junior World Championship participant · 3 snowboard pro models (Joint) · Instagram @baskakov74
- Camp (from the posters): BAS CAMP, Freestyle Progression Camp, hosted by Ilia Baskakov · December 23–27, 2026 · Italy, location TODO (brief says Livigno, posters say Valdidentro) · level Piste+ · small group, park riding, airbag sessions, personal video feedback · "For riders who want more air, more style, more control. Small crew. Big progression." · taglines: RIDE HARD. LEARN FAST. SEND IT. / TAKE THE SPOT / LAST SPOTS
- TODO: price, spots, program, accommodation, training formats, Jan–Apr schedule, board seasons, gallery media

LANDING: 5 pages, each 100svh, full-bleed
01 Cover: Ilia cut-out over giant "BASKAKOV", name, 2–3 intro lines, cover lines, barcode
02 Career stats: Rodman-card layout with portrait block, stat badges, a row of 3 vertical boards
03 Gallery: marked-up contact sheet of photos + muted looping clips, lightbox
04 Training: intro, 3 formats, season schedule as tour dates
05 Back cover: camp ad + coupon CTA "TAKE THE SPOT →" linking to /camp
Always visible: masthead (BAS★CAMP logo), page counter "01/05" with the mascot, menu with page links.

PAGED NAVIGATION
- One gesture = one page: wheel/trackpad (accumulate delta; ignore inertia for ~400 ms after a transition), touch swipe, ↑ ↓ PgUp PgDn Space Home End, menu links
- A hash per page (#cover #stats #gallery #training #camp-ad); deep links and browser back/forward work
- Input is locked while a transition runs
- A page that overflows (gallery on mobile) scrolls inside; the transition fires only when you push past its top or bottom edge

CRUMPLE TRANSITION (the signature effect)
- Fixed Three.js canvas over the page (pointer-events: none, aria-hidden)
- Snapshot the current page to a texture with modern-screenshot; cache per page; refresh after fonts and images load and on resize; pre-warm neighbouring pages on idle; keep every asset same-origin so the canvas isn't tainted
- Crumple, ~550 ms ease-in: a subdivided plane (~128×128); vertex shader with layered 3D simplex noise plus random crease lines, amplitude driven by uProgress; the sheet shrinks to a ~25% ball and turns slightly; flat-shade from derivative normals so the creases catch light
- Uncrumple, ~650 ms ease-out: the next page starts as a ball and opens flat; then swap to the live DOM and keep a faint wrinkle overlay (10–15% opacity, different per page) so the paper looks handled
- Then the page's marker layer draws on (DrawSVG, staggered, ~600 ms)
- Fallbacks: prefers-reduced-motion → 200 ms crossfade with static marks; no WebGL or a failed snapshot → CSS version (scale + rotate + SVG feTurbulence/feDisplacementMap + crumpled-paper texture)
- Budget: ≥50 fps on a mid-range phone (Chrome 4× CPU throttle); DPR capped at 2; dispose textures

VERTICAL SNOWBOARD ANIMATION (page 02)
- Assets: each board image holds the top sheet (left, with insert holes) and the base (right). Crop, remove the background, trim to transparent WebP. If the cut-outs come out rough, stop and ask me for clean exports.
- Each board is a CSS 3D card standing vertically: top sheet in front, base on the back, a 2–3 px edge for thickness
- When the page lands: boards drop in one by one with a small landing bounce, flip to show the base, flip back
- Hover/tap: a 360° spin. Easter egg on the first board: 1620° (4.5 turns, ends on the base) and a "1620°!" marker note draws on
- A label under each board, like a jersey number: name · season · length (e.g. 157W)

MARKER LAYER
- Inline SVG per page built from the Figma marker set, anchored to the content so the halo stays on his head and arrows stay on their targets at every breakpoint
- Park Signal red + Goggle Tint pink, Most Wazted for words, slight hand-jitter; redraws each time you return to a page

MAGAZINE LOOK
- Paper: aged and slightly rusty. Generate it (SVG noise grain, yellowed edges, rust and staple marks, fold creases, foxing) unless textures come from Figma; keep it subtle enough that text stays readable
- Photos: high-contrast B&W or duotone, halftone where it fits; colour only when red/pink dominates (poster style)

GALLERY
- Photos + clips (muted, loop, playsinline, poster frame, lazy-loaded; play only while the page is active)
- Lightbox with swipe, arrows, Esc and captions

CAMP PAGE /camp
- Normal scroll, same visual language, styled as a pull-out insert; sections divided by torn edges
- Hero (splatter logo with "Italy 2026", dates, place, level, LAST SPOTS stamp) · camp facts · who it's for · day-by-day program · included / not included · coach card · price and spots · FAQ · apply form · contacts with @baskakov74
- Form: name, contact (Telegram / WhatsApp / email), level, message; posts to FORM_ENDPOINT from env; validation and a success state

ACCESSIBILITY + SEO
- Semantic HTML, one h1 per route, live text, alt text, captions for video
- After each page change, move focus to the new page's heading and announce "Page 2 of 5: Career stats" via aria-live; visible focus states; skip link; everything keyboard-reachable
- Meta + OG image (cover style), JSON-LD Person (Ilia) and Event (the camp)
- Lighthouse mobile: Performance ≥90, Accessibility ≥95; AVIF/WebP with srcset

PROCESS
1. Plan, then wait for my OK
2. Static layout of all 5 pages + /camp: responsive, tokens, no motion
3. Paged navigation → crumple transition → board animation → marker draw-on → gallery lightbox
4. Playwright screenshots of every page at 390×844 and 1440×900, plus a reduced-motion pass; fix overflow and contrast
5. README: run, edit copy, swap photos and boards, deploy

DONE WHEN
- Every landing page fits one screen at 390×844 and 1440×900 (gallery may scroll inside)
- One gesture moves exactly one page, with no double jumps on trackpads
- Crumple and uncrumple run smoothly on a mid-range phone, and both fallbacks work
- Only BAS CAMP, Joint and Ilia assets ship: no reference images or third-party marks
- All copy lives in src/content/site.ts
