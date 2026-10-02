// WebGL crumple transition, loaded after first paint. Replaces the CSS fallback once it is ready.
import * as THREE from 'three';
import { config } from './config';
import { PaperEngine, type Tex } from './engine';
import { generate, frameAt, type FoldSet } from './folds';
import { envelope, runClock, smooth, filmClock } from './timing';
import * as snaps from './snapshots';
import { prepareStage, renderStage, showStage, filmGate } from '../stagefx';
import { rng } from '../paper';
import type { Mag } from '../magazine';
import type { Hooks, Transition } from '../transitions';

const texCache = new WeakMap<HTMLCanvasElement, THREE.Texture>();
const liveTex = new Set<THREE.Texture>();

export function install(mag: Mag) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-paper-canvas]')!;
  let engine: PaperEngine;
  try {
    engine = new PaperEngine(canvas);
    engine.warm();
  } catch (err) {
    canvas.remove();
    throw err;
  }
  const { state } = mag;
  const pages = state.secs;
  snaps.waitForPaper(state.paperReady);
  const isDark = (i: number) => pages[i].dataset.tone === 'D';
  const overlay = (i: number) => pages[i].querySelector<HTMLElement>('[data-handled]')!;
  let running = false;

  const texOf = (c: HTMLCanvasElement): THREE.Texture => {
    let t = texCache.get(c);
    if (!t) { t = engine.texture(c); texCache.set(c, t); liveTex.add(t); }
    return t;
  };
  // keep GPU memory bounded: drop textures whose snapshot is gone
  const gc = (keep: THREE.Texture[]) => {
    if (liveTex.size <= 8) return;
    liveTex.forEach((t) => { if (!keep.includes(t)) { t.dispose(); liveTex.delete(t); } });
  };

  // ------------------------------------------------------------ one frame of the move
  const tumbleMat = new THREE.Matrix3();
  const m4 = new THREE.Matrix4(), e = new THREE.Euler();
  const sigma = 0.17, gnorm = 1 / (Math.SQRT2 * sigma * Math.exp(-0.5));
  const swing = (p: number) => { const d = p - 0.5; return 2 * d * Math.exp(-((d / sigma) ** 2)) * Math.sin(Math.PI * p) * gnorm; };

  type Run = { set: FoldSet; dir: 1 | -1; twistSign: number; yawSign: number; resMode: 1 | 2; resAlpha: number };
  function drawFrame(R: Run, p: number, film: { rand: () => number }) {
    const f = frameAt(R.set, p);
    const env = envelope(p);
    const r = film.rand;
    const D = Math.PI / 180;
    const s = swing(p), b = Math.sin(Math.PI * p) ** 2;
    // tumble never stops at the ball: the swing term passes zero there at full speed
    const jr = (r() - 0.5) * 2 * config.jitterDeg * env;
    e.set(R.dir * config.tumble * s * D, R.yawSign * config.yaw * s * 0.7 * D, (R.twistSign * config.twist * b + R.dir * config.twist * 0.5 * s + jr) * D, 'ZXY');
    m4.makeRotationFromEuler(e);
    tumbleMat.setFromMatrix4(m4);
    const j = config.jitterPx * env;
    const shift: [number, number] = [(r() - 0.5) * 2 * j, (r() - 0.5) * 2 * j];
    const gate = filmGate(env, r);
    const w = 1.25 / (config.FILM_FPS * config.duration); // crossfade over ~2.5 film frames at the ball
    const mix = smooth(0.5 - w, 0.5 + w, p);
    engine.draw(p, f, mix, tumbleMat, shift, gate, { mode: R.resMode, alpha: R.resAlpha });
    return gate;
  }

  // The next turn's fold set and left-over crease bakes are made ahead of time on idle,
  // so a gesture goes straight to the move once its snapshots are ready.
  type Ahead = { seed: number; W: number; H: number; set: FoldSet; bakes: Record<1 | 2, string> };
  let ahead: Ahead | null = null;
  let aheadJob: Promise<Ahead> | null = null;
  async function makeAhead(seed: number): Promise<Ahead> {
    engine.resize();
    const set = generate(engine.W, engine.H, seed);
    const r = rng(seed ^ 0x2545f491);
    engine.setFolds(set, () => (r() - 0.5) * 0.09);
    const bakes = { 1: await engine.bakeResidual(1), 2: await engine.bakeResidual(2) } as Record<1 | 2, string>;
    await Promise.all(Object.values(bakes).map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); }));
    return { seed, W: engine.W, H: engine.H, set, bakes };
  }
  const planAhead = () => {
    if (running || aheadJob) return;
    aheadJob = makeAhead((Math.random() * 2 ** 31) | 0).then((a) => { ahead = a; return a; }).finally(() => { aheadJob = null; });
  };
  const dropAhead = (a: Ahead | null) => {
    if (!a) return;
    Object.values(a.bakes).forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
  };

  async function prepareRun(from: number, to: number, dir: 1 | -1, seed?: number) {
    // both textures ready before p = 0 — wait here if needed, never mid-move
    const [a, b] = await Promise.all([snaps.get(pages, from, 'live'), snaps.get(pages, to, 'pre')]);
    if (a.w !== innerWidth || a.h !== innerHeight) throw new Error('viewport changed');
    engine.resize();
    const A: Tex = { tex: texOf(a.canvas), dark: isDark(from) };
    const B: Tex = { tex: texOf(b.canvas), dark: isDark(to) };
    gc([A.tex, B.tex]);
    if (aheadJob) await aheadJob.catch(() => {});
    let plan = ahead;
    ahead = null;
    if (seed !== undefined || !plan || plan.W !== engine.W || plan.H !== engine.H) {
      dropAhead(plan);
      plan = await makeAhead(seed ?? ((Math.random() * 2 ** 31) | 0));
    } else {
      const r = rng(plan.seed ^ 0x2545f491);
      engine.setFolds(plan.set, () => (r() - 0.5) * 0.09);
    }
    engine.setTextures(A, B);
    const resMode: 1 | 2 = isDark(to) ? 2 : 1;
    const resAlpha = isDark(to) ? config.residualDark : config.residualLight;
    const url = plan.bakes[resMode];
    const other = plan.bakes[resMode === 1 ? 2 : 1];
    if (other.startsWith('blob:')) URL.revokeObjectURL(other);
    prepareStage(to, plan.seed);
    const r = rng(plan.seed ^ 0x9e3779b9);
    const R: Run = { set: plan.set, dir, twistSign: r() < 0.5 ? -1 : 1, yawSign: r() < 0.5 ? -1 : 1, resMode, resAlpha };
    return { R, url, resAlpha, seed: plan.seed };
  }

  const setOverlay = (i: number, url: string, alpha: number) => {
    const o = overlay(i);
    const old = o.dataset.url;
    o.style.backgroundImage = url ? `url(${url})` : '';
    o.style.opacity = url ? String(alpha) : '0';
    o.dataset.url = url;
    if (old && old !== url && old.startsWith('blob:')) URL.revokeObjectURL(old);
  };

  const transition: Transition = {
    async run(from, to, dir, hooks: Hooks) {
      if (running) throw new Error('busy');
      running = true;
      try {
        const { R, url, resAlpha, seed } = await prepareRun(from, to, dir);
        // first canvas frame drawn before the DOM page goes away
        const film0 = filmClock(seed);
        const g0 = drawFrame(R, 0, film0);
        renderStage(0, g0, film0.rand);
        canvas.classList.add('is-on');
        showStage(true);
        hooks.hideOut();
        performance.mark('crumple:move-start');
        await runClock(seed, (p, _f, film) => {
          const g = drawFrame(R, p, film);
          renderStage(p, g, film.rand);
        }, hooks.atBall);
        performance.mark('crumple:move-end');
        // hand over: the DOM page (+ the creases it just opened from) shows before the canvas clears
        setOverlay(to, url, resAlpha);
        hooks.showIn();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        canvas.classList.remove('is-on');
        showStage(false);
        engine.clear();
        setOverlay(from, '', 0); // new creases per visit
      } catch (err) {
        canvas.classList.remove('is-on');
        showStage(false);
        throw err;
      } finally {
        running = false;
      }
    },
  };
  mag.setTransition(transition);

  // ------------------------------------------------------------ snapshots: keep them fresh
  state.onDirty = (i) => { snaps.markDirty(i, 'live'); schedule(); };
  state.onLanded = (i) => { snaps.markDirty(i, 'live'); schedule(); };
  let warmT = 0;
  // wait until the page has settled (marks drawn, boards landed) so snapshot work never stutters an animation
  const schedule = () => {
    clearTimeout(warmT);
    warmT = window.setTimeout(() => { snaps.prewarm(pages, state.cur, () => state.busy || running); planAhead(); }, 700);
  };
  document.fonts?.ready.then(() => { snaps.invalidateAll(); schedule(); });
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => { if (running) return; engine.resize(); snaps.invalidateAll(); schedule(); }, 200);
  });
  schedule();

  // ------------------------------------------------------------ first load: the cover arrives already handled
  (async () => {
    const seed = (Math.random() * 2 ** 31) | 0;
    const set = generate(engine.W, engine.H, seed);
    const r = rng(seed);
    engine.setFolds(set, () => (r() - 0.5) * 0.07);
    const i = state.cur, mode: 1 | 2 = isDark(i) ? 2 : 1;
    const url = await engine.bakeResidual(mode);
    setOverlay(i, url, isDark(i) ? config.residualDark : config.residualLight);
    snaps.markDirty(i, 'live');
  })().catch(() => {});

  // ------------------------------------------------------------ ?debug
  if (state.debug) {
    let frozen: { R: Run; from: number; to: number; url: string; resAlpha: number } | null = null;
    const api = {
      config,
      /** freeze any frame of a transition from the current page (to the next one by default) */
      async seek(p: number, opts: { to?: number; seed?: number; stage?: boolean } = {}) {
        const from = state.cur;
        const to = opts.to ?? (from < pages.length - 1 ? from + 1 : from - 1);
        if (!frozen || frozen.to !== to || opts.seed !== undefined) {
          mag.prepare(to);
          const { R, url, resAlpha } = await prepareRun(from, to, to > from ? 1 : -1, opts.seed ?? ((Math.random() * 2 ** 31) | 0));
          frozen = { R, from, to, url, resAlpha };
        }
        const film = filmClock(frozen.R.set.seed);
        const g = drawFrame(frozen.R, Math.min(1, Math.max(0, p)), film);
        renderStage(opts.stage === false ? 0 : p, g, film.rand);
        canvas.classList.add('is-on');
        showStage(true);
        document.querySelector<HTMLElement>('[data-stage]')!.style.visibility = opts.stage === false ? 'visible' : '';
        pages[from].classList.remove('is-active');
      },
      /** hand-over check: show the live incoming page (with the creases it opened from) instead of the canvas */
      showDom(which: 'from' | 'to') {
        if (!frozen) return;
        canvas.classList.remove('is-on'); showStage(false);
        const i = which === 'to' ? frozen.to : frozen.from;
        pages.forEach((pg, k) => pg.classList.toggle('is-active', k === i));
        if (which === 'to') setOverlay(i, frozen.url, frozen.resAlpha);
      },
      release() {
        if (!frozen) return;
        canvas.classList.remove('is-on'); showStage(false); engine.clear();
        pages[frozen.from].classList.add('is-active');
        frozen = null;
      },
      snapshots: snaps,
      engine,
    };
    (window as any).__crumple = api;
    import('./debug').then((m) => m.panel(api, mag));
  }
}
