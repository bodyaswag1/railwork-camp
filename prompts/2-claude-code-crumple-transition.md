Rework the page transition on the landing page so it looks like real paper. On a page gesture (scroll, swipe, keys, menu), the current page crumples into a ball on a black stage. The next page then uncrumples out of that ball to fill the screen, in one continuous move. The reference GIF sets the motion; the current Claude Design file sets the art direction and holds the graphic elements.

This spec replaces the CRUMPLE TRANSITION section of the original brief. Paged navigation, the input lock and the fallbacks stay as they are unless changed below. If a transition already exists in the repo, rebuild it to this spec.

REFERENCES (in /design; nothing in /design ships)
- ref/crumple.gif: the motion to match. Reference only, never ship it (it has a makeagif watermark). A GIF won't play for you, so split it into PNG frames with their delays (ffmpeg or Pillow) plus one contact sheet. From the frames, note: phase timings as fractions of the whole, ball diameter as a fraction of frame height, how the outline breaks up, light direction.
- Ilia Baskakov.dc.html: the current Claude Design file. It is the source of truth for the stage graphics and for how the landed pages look. If it's a bundled export (a __bundler/manifest script with base64/gzip assets plus a __bundler/template), unpack it with a small script first. Take its graphic elements, colours, fonts and art direction, not its transition code: the motion is rebuilt to this spec. Don't redraw anything that already exists there; vector stays vector. Where an element matches the Figma marker set (SVG-elements 149:18395) or a bas-camp-splatter variant (265:18813), pull the original vector through the Figma MCP.

PROBLEMS IN THE PROTOTYPE (none may carry over)
- A pause between the ball and the unfold
- The motion isn't as smooth or as full-screen as the GIF
- Red marks and text sit on top of the paper and interrupt it
If the repo already has a transition, find what causes its pause before changing anything and tell me. Likely causes: a snapshot taken mid-move, a texture upload or shader compile on first use, a gap in the timeline, or eases that reach zero speed on both sides of the ball.

THE MOVE (one GSAP timeline, progress p 0→1, ball at p 0.5)
- About 1.2 s in total; take the phase split from the GIF, sped up to that length.
- Ends: at p 0 and p 1 the sheet is perfectly flat and covers the viewport pixel for pixel, aligned with the live DOM page, so the DOM ↔ canvas swap is invisible. Size the camera from the viewport. Draw the first canvas frame before hiding the DOM, and show the DOM before clearing the canvas, so nothing flashes.
- Crumple (p 0→0.5): speeds up and reaches the ball still moving. Paper doesn't stretch: the sheet gets smaller by folding over itself, not by scaling down. 3–6 big folds come first, then smaller creases, then compression into a lumpy ball. Uniform scaling is allowed only in the last third of the crumple (and the first third of the unfold). Edges go first, so the outline turns jagged within the first frames.
- Ball (p 0.5): a turning point, not a hold. Centred; diameter measured from the GIF (roughly a quarter of the short side). The crumple peaks and turns straight back (a rounded peak under ~100 ms is fine) while the ball keeps tumbling: nothing on screen ever stops. Tumble direction follows navigation direction.
- Swap the outgoing texture for the incoming one at the tightest moment, crossfaded over 2–3 frames.
- Uncrumple (p 0.5→1): slows as it opens and lands exactly on the viewport rectangle, axis-aligned, then hands over to the live DOM.
- It must not look like the crumple played backwards: same ball at the swap (no pop), but the folds open in a different order.
- Same behaviour at 1440×900 and 390×844 (portrait sheet).

PAPER LOOK
- Sharp, straight creases and flat facets, not soft noise bumps. Flat-shade from derivative normals so the facets catch the light. Light direction and contrast as in the GIF; matte paper, slight sheen, darker in deep folds, slight rim darkening.
- Back of the sheet (gl_FrontFacing): blank paper in the design file's paper colour, a touch darker, with faint mirrored show-through of the print (~5%).
- The black back cover crumpling on the black stage must still read: the light paper back shows in the folds, plus a faint rim light. Check it specifically.
- Mesh: aspect-matched grid with roughly square cells, ~150–200 segments on the long side; creases must not stair-step at 1440×900.
- New random seed on every transition.

SNAPSHOTS
- Use modern-screenshot; keep every asset same-origin so the canvas isn't tainted.
- Never snapshot during the move. Both textures are ready before it starts: cached per page, neighbours pre-warmed on idle, refreshed after fonts/images load and on resize. Compile the shader at load and upload both textures (renderer.initTexture) before p 0. If the target isn't ready, wait before starting, never mid-move.
- Outgoing = exactly what's on screen, including its drawn marker layer.
- Incoming = its pre-landing state: marker layer hidden, entrance animations (the board drop on 02) at their start. The live DOM must match the texture at handover.

OLD FILM (from the design file; it must read as texture, never as lag)
- Paper motion is computed continuously and shown at a film cadence: FILM_FPS, default 24. Stage graphics step on the same cadence.
- 1–2 held frames per transition, never within ~150 ms of the ball.
- Stop-motion handling: a tiny random offset per film frame on the paper (±1.5 px, ±0.3°). Gate weave (±1 px) and exposure flicker (±3%) apply to the whole frame.
- Film scratches and dust from the design file, on the black stage.

STAGE GRAPHICS (from the design file: red marks, splatters, handwritten notes, film scratches)
- Z-order, back to front: black stage (the design file's black; Night Run #101314 if unsure) → scratches and dust → red marks, splatters, notes → paper. Nothing is drawn over the paper.
- Fixed UI (masthead, page counter, menu): follow the design file. If it doesn't say, keep it above everything, uncrumpled, and flip the counter to the new number at the ball.
- The graphics draw on as the black opens up (start ~p 0.15, complete ~p 0.5) and get covered by the unfolding page. Keep the area around the ball clear (about a third of the short side, centred).
- Use the design file's compositions. If it has a single set, vary which elements appear per transition (seeded) so consecutive transitions don't repeat. Notes use the design file's text; where it has none, use the destination page's name in Most Wazted (e.g. "STATS →").
- Strokes draw on with DrawSVG; splatters pop in over 2–3 film frames. Handwriting appears through a stepped mask in writing direction, not by tracing glyph outlines.
- Decorative only: aria-hidden; red stays decoration on black, per the contrast rule.

AFTER LANDING
- The creases stay: bake the final frame's crease shading into a texture and lay it over the live page (pointer-events: none), so the wrinkles are the ones it just opened from. The canvas's last frame and DOM + overlay must look identical. Multiply at 8–12% on paper pages; on the black back cover, use a light crease highlight (screen or soft-light) at 3–5%. New seed per visit.
- First load: the cover gets subtle random fold lines and wear the same way, without a transition.
- Then the page's own marker layer draws on, as before.

TUNING AND CHECKS
- Every number above lives in one config object: durations, ball size, fold count, crease strength, FILM_FPS, holds, jitter, stage density.
- ?debug loads a lil-gui panel for the config, a progress scrubber, and window.__crumple.seek(p) to freeze any frame. None of it loads without ?debug.
- Comparison pass: with Playwright, capture our transition at the GIF's aspect at the same relative times as its frames. Put both rows in one sheet (design/compare.png) and compare outline, crease density, lighting, ball size and timing (not content). Fix the gaps, then point me to the sheet.
- 60 fps on desktop, ≥50 fps on a mid-range phone (Chrome 4× CPU throttle); DPR capped at 2; dispose textures and geometry; no layout shift at handover.
- Fallbacks: reduced motion → 200 ms crossfade with static marks; no WebGL or a failed snapshot → the CSS version, also on black with the stage graphics underneath.

IF IT STILL READS AS A BLOB
If after the comparison pass the sheet still looks like a blob rather than paper, stop and propose a baked route: a Blender cloth crumple exported as glTF morph targets or a vertex-animation texture, played by p, with the page texture on the UVs. Don't switch without asking.

PROCESS
1. Unpack the design file, split the GIF, read the current code. Send me: what causes the pause (in the current code, or in the prototype if there's no code yet), the stage elements you found (by name), the GIF measurements, and your approach. Wait for my OK.
2. Build it, with the debug panel from the start.
3. Comparison pass, performance pass, reduced-motion and fallback checks.
4. README: how to tune the transition from the config.
