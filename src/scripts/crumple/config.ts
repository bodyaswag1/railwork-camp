// Every tunable number of the page transition lives here. ?debug exposes all of it in a lil-gui panel.
// p runs 0 → 1 over `duration`; the ball is at p = 0.5.

export const config = {
  /** total length of one transition, seconds */
  duration: 1.2,
  /** half-width of the rounded turn at the ball, in p (0.03 ≈ 36 ms each side at 1.2 s) */
  peakRound: 0.03,

  // ---------- folding ----------
  /** big folds that come first (3–6) */
  bigFolds: 5,
  /** smaller folds after the big ones */
  smallFolds: 9,
  /** small edge/corner tucks that turn the outline jagged in the first frames */
  edgeTucks: 8,
  /** max fold angle of the big folds, degrees (<180 so layers never sit exactly on top of each other) */
  bigAngle: 168,
  smallAngle: 120,
  tuckAngle: 95,
  /** straight-crease web (facets) strength at the ball, as a slope */
  creaseStrength: 0.42,
  /** number of crease lines in the facet web */
  creaseLines: 26,
  /** width of the bend at each fold, in sheet short-side units (prevents stair-stepping) */
  foldSoftness: 0.014,

  // ---------- ball ----------
  /** ball diameter as a fraction of the viewport's short side (GIF: 0.227 of frame height ≈ 0.32 of sheet short side) */
  ballSize: 0.3,
  /** how lumpy the ball is (0 = sphere) */
  ballLumps: 0.22,
  /** how much of the folded stack is pushed onto the ball shape at p = 0.5 */
  spherize: 0.92,
  /** crease relief on the ball's surface (the crease web becomes its facets) */
  ballCrease: 0.55,
  /** unfold phase by which the ball shape has fully let go (the folds keep the sheet small after that) */
  ballRelease: 0.8,
  /** crumple phase where uniform scaling may begin (spec: only in the last third) */
  compressStart: 0.67,
  /** unfold phase where uniform scaling must be finished (spec: first third) */
  releaseEnd: 0.33,

  // ---------- tumble ----------
  /** roll toward the navigation direction, degrees of swing either side of the ball */
  tumble: 46,
  /** twist about the view axis, degrees at the ball */
  twist: 24,
  /** side-to-side yaw, degrees */
  yaw: 14,

  // ---------- light (from the GIF: lit from above, slightly left; deep folds ≈ 0.5× highlight) ----------
  lightAngle: -120,
  lightElevation: 52,
  ambient: 0.56,
  diffuse: 0.58,
  sheen: 0.10,
  foldDarkening: 0.45,
  rimDarkening: 0.22,
  /** light rim on the dark back cover so its silhouette reads on the black stage */
  rimLight: 0.22,
  /** paper back: the design file's paper colour a touch darker, with faint mirrored show-through */
  backTint: [0.82, 0.86, 0.88] as [number, number, number],
  showThrough: 0.05,

  // ---------- creases left on the page after landing ----------
  /** multiply strength on paper pages (8–12%) */
  residualLight: 0.1,
  /** screen strength on the dark back cover (3–5%) */
  residualDark: 0.04,
  /** how deep the left-over creases are, as a fraction of the ball's crease strength */
  residualDepth: 0.22,

  // ---------- old film ----------
  FILM_FPS: 24,
  /** held frames per transition (1–2), never within holdGuard seconds of the ball */
  holds: 2,
  holdGuard: 0.15,
  /** stop-motion handling of the paper per film frame */
  jitterPx: 1.5,
  jitterDeg: 0.3,
  /** whole-frame gate weave (px) and exposure flicker (fraction) */
  weavePx: 1,
  flicker: 0.03,

  // ---------- stage graphics ----------
  stageStart: 0.15,
  stageEnd: 0.5,
  /** 0–1: share of a composition's elements shown per transition */
  stageDensity: 0.85,
  /** clear zone around the ball, fraction of the short side */
  clearZone: 0.34,

  // ---------- mesh ----------
  /** segments on the long side of the sheet (cells stay roughly square) */
  segments: 200,
  /** device-pixel-ratio cap for the canvas and snapshots */
  maxDpr: 2,

  // ---------- fallbacks ----------
  /** longest a gesture waits for page snapshots before this turn uses the CSS version instead, seconds */
  snapshotWait: 0.15,
  reducedFade: 0.2,
  cssDuration: 1.0,
};

export type Config = typeof config;
