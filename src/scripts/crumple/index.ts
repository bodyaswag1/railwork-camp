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

// fold sets come from a worker (see folds.worker.ts); the main thread only generates them if that fails
let foldWorker: Worker | null | undefined;
let foldSeq = 0;
type FoldJob = { W: number; H: number; seed: number; done: (s: FoldSet) => void };
const foldWaiting = new Map<number, FoldJob>();
// if the worker can't load, errors, or is too slow, the page generates the folds itself (never hang a turn)
const generateHere = (id: number) => {
  const j = foldWaiting.get(id);
  if (!j) return;
  foldWaiting.delete(id);
  j.done(generate(j.W, j.H, j.seed));
};
const dropFoldWorker = () => {
  foldWorker?.terminate();
  foldWorker = null;
  [...foldWaiting.keys()].forEach(generateHere);
};
function generateOffThread(W: number, H: number, seed: number): Promise<FoldSet> {
  if (foldWorker === undefined) {
    try {
      foldWorker = new Worker(new URL('./folds.worker.ts', import.meta.url), { type: 'module' });
      foldWorker.onmessage = (e) => {
        const j = foldWaiting.get(e.data.id);
        if (!j) return;
        if (e.data.error) { generateHere(e.data.id); return; }
        foldWaiting.delete(e.data.id);
        j.done(e.data.set);
      };
      foldWorker.onerror = dropFoldWorker;
      foldWorker.onmessageerror = dropFoldWorker;
    } catch { foldWorker = null; }
  }
  // tuning from ?debug changes the config on the main thread only: generate here then
  if (!foldWorker || (window as any).__crumple) return Promise.resolve(generate(W, H, seed));
  const id = ++foldSeq;
  return new Promise((done) => {
    foldWaiting.set(id, { W, H, seed, done });
    foldWorker!.postMessage({ id, W, H, seed });
    setTimeout(() => generateHere(id), 2000);
  });
}

const idle = (fn: () => void, timeout = 1200) =>
  ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout }) : setTimeout(fn, 150));

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
  snaps.waitFor(Promise.all([state.paperReady, document.fonts?.ready ?? Promise.resolve()]));
  // the wear textures are decoded, and drawn once, before the first turn composes with them
  state.paperReady.then(() => idle(() => { if (!running) snaps.warmCompose(pages).catch(() => {}); }));
  snaps.setInputClock(() => performance.now() - state.quietFor());
  const isDark = (i: number) => pages[i].dataset.tone === 'D';
  const overlay = (i: number) => pages[i].querySelector<HTMLElement>('[data-handled]')!;
  const scrollTop = (i: number) => pages[i].querySelector<HTMLElement>('[data-scroll]')?.scrollTop ?? 0;
  const ensure = (i: number, look: snaps.Look, background = false) => {
    const variantNow = () => (look === 'landed' ? state.variant(i) : '');
    return snaps.ensure(pages, i, look, (k, l) => state.setLook(k, l), variantNow(), background, variantNow);
  };
  let running = false;
  // WebGL contexts get dropped on phones (tab in the background, memory pressure): turns become fades until
  // the context is back, never a blank sheet
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; dropAhead(ahead); ahead = null; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; try { engine.warm(); } catch { /* next turn retries */ } warm(); });
  const contextOk = () => !lost && !engine.renderer.getContext().isContextLost();
  // a turn that takes longer than this to prepare becomes a fade, so nothing can freeze navigation
  const PREP_DEADLINE_MS = 4000;
  let runToken = 0;
  class Abandoned extends Error {}

  // ------------------------------------------------------------ one frame of the move
  const tumbleMat = new THREE.Matrix3();
  const m4 = new THREE.Matrix4(), e = new THREE.Euler();
  const sigma = 0.17, gnorm = 1 / (Math.SQRT2 * sigma * Math.exp(-0.5));
  const swing = (p: number) => { const d = p - 0.5; return 2 * d * Math.exp(-((d / sigma) ** 2)) * Math.sin(Math.PI * p) * gnorm; };

  type Run = { set: FoldSet; dir: 1 | -1; twistSign: number; yawSign: number; resMode: 1 | 2; resAlpha: number; tex: THREE.Texture[] };
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
  // so a gesture goes straight to the move.
  type Ahead = { seed: number; W: number; H: number; set: FoldSet; bakes: Record<1 | 2, HTMLCanvasElement> };
  let ahead: Ahead | null = null;
  let aheadJob: Promise<Ahead> | null = null;
  async function makeAhead(seed: number): Promise<Ahead> {
    if (!contextOk()) throw new Error('context lost');
    engine.resize();
    performance.mark('ahead:start');
    const set = await generateOffThread(engine.W, engine.H, seed);
    performance.mark('ahead:generated');
    const r = rng(seed ^ 0x2545f491);
    engine.setFolds(set, () => (r() - 0.5) * 0.09);
    const bakes = { 1: await engine.bakeResidual(1), 2: await engine.bakeResidual(2) } as Record<1 | 2, HTMLCanvasElement>;
    if (!contextOk()) throw new Error('context lost'); // a bake from a dead context is all zeros
    performance.mark('ahead:baked');
    return { seed, W: engine.W, H: engine.H, set, bakes };
  }
  const startAhead = () => {
    if (aheadJob || ahead) return;
    aheadJob = makeAhead((Math.random() * 2 ** 31) | 0).then((a) => { ahead = a; return a; }).finally(() => { aheadJob = null; });
  };
  const planAhead = () => {
    if (!running) startAhead();
    return (aheadJob ?? Promise.resolve()).then(() => {}, () => {});
  };
  const dropAhead = (a: Ahead | null) => {
    if (!a) return;
    Object.values(a.bakes).forEach((c) => { c.width = 0; c.height = 0; });
  };

  async function prepareRun(from: number, to: number, dir: 1 | -1, seed?: number, token = runToken) {
    const live = () => { if (token !== runToken) throw new Abandoned('turn abandoned'); };
    // the outgoing page as it is on screen: its entrance animations jump to their end so the DOM shows its
    // landed look, which was copied ahead of time; composing that with the scroll position is cheap
    performance.mark('prep:start');
    // no folds made ahead yet (a swipe right after load): they're generated in a worker while the pages copy
    if (seed === undefined) startAhead();
    state.finishLanding(from);
    const [out, inn] = await Promise.all([ensure(from, 'landed'), ensure(to, 'pre')]);
    live();
    performance.mark('prep:copies');
    if (out.vw !== innerWidth || out.vh !== innerHeight) throw new Error('viewport changed');
    const [outCanvas, inCanvas] = await Promise.all([snaps.compose(pages[from], out, scrollTop(from), true), snaps.compose(pages[to], inn, 0, false)]);
    live();
    performance.mark('prep:composed');
    engine.resize();
    const A: Tex = { tex: engine.texture(outCanvas), dark: isDark(from) };
    const B: Tex = { tex: engine.texture(inCanvas), dark: isDark(to) };
    const tex = [A.tex, B.tex];
    try {
      performance.mark('prep:textures');
      if (aheadJob) await aheadJob.catch(() => {});
      live();
      performance.mark('prep:ahead-waited');
      let plan = ahead;
      ahead = null;
      if (seed !== undefined || !plan || plan.W !== engine.W || plan.H !== engine.H) {
        dropAhead(plan);
        plan = await makeAhead(seed ?? ((Math.random() * 2 ** 31) | 0));
        live();
        } else {
        const r = rng(plan.seed ^ 0x2545f491);
        engine.setFolds(plan.set, () => (r() - 0.5) * 0.09);
      }
      performance.mark('prep:folds');
      engine.setTextures(A, B);
      const resMode: 1 | 2 = isDark(to) ? 2 : 1;
      const resAlpha = isDark(to) ? config.residualDark : config.residualLight;
      const url = plan.bakes[resMode];
      const other = plan.bakes[resMode === 1 ? 2 : 1];
      other.width = 0; other.height = 0;
      prepareStage(to, plan.seed);
      const r = rng(plan.seed ^ 0x9e3779b9);
      const R: Run = { set: plan.set, dir, twistSign: r() < 0.5 ? -1 : 1, yawSign: r() < 0.5 ? -1 : 1, resMode, resAlpha, tex };
      return { R, url, resAlpha, seed: plan.seed };
    } catch (err) {
      tex.forEach((t) => t.dispose());
      throw err;
    }
  }
  const releaseRun = (R: Run) => R.tex.forEach((t) => t.dispose());

  /** the creases a page carries after landing: the baked canvas itself, under the page's blend mode */
  const setOverlay = (i: number, bake: HTMLCanvasElement | null, alpha: number) => {
    const o = overlay(i);
    const old = o.firstElementChild as HTMLCanvasElement | null;
    if (old && old !== bake) { old.remove(); old.width = 0; old.height = 0; }
    if (bake && bake.parentElement !== o) { bake.style.cssText = 'display:block;width:100%;height:100%'; o.append(bake); }
    o.style.opacity = bake ? String(alpha) : '0';
  };

  const transition: Transition = {
    async run(from, to, dir, hooks: Hooks) {
      if (running) throw new Error('busy');
      if (!contextOk()) throw new Error('WebGL context lost');
      running = true;
      let R: Run | null = null;
      const token = ++runToken;
      try {
        // nothing else copies pages while this turn prepares and moves (a copy it needs carries on)
        await snaps.hold([snaps.keyOf(from, 'landed', state.variant(from)), snaps.keyOf(to, 'pre')]);
        // prepared within the deadline, or this turn becomes a fade (late results are thrown away)
        const prep = await Promise.race([
          prepareRun(from, to, dir, undefined, token),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('preparing the turn took too long')), PREP_DEADLINE_MS)),
        ]);
        R = prep.R;
        const { url, resAlpha, seed } = prep;
        // first canvas frame drawn before the DOM page goes away
        const film0 = filmClock(seed);
        const g0 = drawFrame(R, 0, film0);
        renderStage(0, g0, film0.rand);
        canvas.classList.add('is-on');
        showStage(true);
        hooks.hideOut();
        performance.mark('crumple:move-start');
        const run = R;
        await runClock(seed, (p, _f, film) => {
          const g = drawFrame(run, p, film);
          renderStage(p, g, film.rand);
        }, hooks.atBall);
        performance.mark('crumple:move-end');
        // hand over: the DOM page (+ the creases it just opened from) shows before the canvas clears
        if (contextOk()) setOverlay(to, url, resAlpha);
        hooks.showIn();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        canvas.classList.remove('is-on');
        showStage(false);
        engine.clear();
        setOverlay(from, null, 0); // new creases per visit
      } catch (err) {
        runToken++; // a preparation still in flight is abandoned
        canvas.classList.remove('is-on');
        showStage(false);
        throw err;
      } finally {
        if (R) releaseRun(R);
        snaps.release();
        running = false;
      }
    },
  };
  mag.setTransition(transition);

  // ------------------------------------------------------------ copying pages ahead of time
  // One copy per idle slot, only while the reader is quiet and the page on screen has settled, nearest
  // pages first: the landed look of the page on screen (what leaves on the next swipe), the pre-landing
  // look of its neighbours (what arrives), then their landed looks, then the rest.
  const QUIET_MS = 700;
  let warming = false;
  const jobs = (): [number, snaps.Look][] => {
    const c = state.cur, out: [number, snaps.Look][] = [];
    if (state.isSettled(c)) out.push([c, 'landed']);
    for (const d of [1, -1]) if (pages[c + d]) out.push([c + d, 'pre']);
    for (const d of [1, -1]) if (pages[c + d]) out.push([c + d, 'landed']);
    for (const d of [2, -2, 3, -3, 4, -4]) if (pages[c + d]) out.push([c + d, 'pre'], [c + d, 'landed']);
    return out.filter(([i, l]) => !snaps.has(i, l, l === 'landed' ? state.variant(i) : ''));
  };
  const warm = () => {
    if (warming) return;
    const tick = () => {
      if (state.busy || running) { warming = false; return; }
      // never while the page on screen is busy animating in (a copy would stutter its marks or the board
      // drops), nor while the reader is touching or scrolling
      if (state.quietFor() < QUIET_MS || !state.isCalm(state.cur)) { setTimeout(tick, 250); return; }
      // the next turn's folds first: generated in a worker, only the small crease bake runs here
      if (!ahead && !aheadJob) { planAhead().finally(() => idle(tick)); return; }
      const job = jobs()[0];
      if (!job) {
        // the page on screen is copied straight from the screen once it has fully settled
        if (!state.isSettled(state.cur) && !snaps.has(state.cur, 'landed', state.variant(state.cur))) { setTimeout(tick, 300); return; }
        warming = false; return;
      }
      ensure(job[0], job[1], true).catch(() => {}).finally(() => idle(tick));
    };
    warming = true;
    idle(tick);
  };
  state.onDirty = () => warm();
  state.onLanded = () => warm();
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => { if (running) return; engine.resize(); warm(); }, 250);
  });

  // ------------------------------------------------------------ first load: the page arrives already handled
  idle(async () => {
    if (running || !contextOk()) return;
    const seed = (Math.random() * 2 ** 31) | 0;
    const set = await generateOffThread(engine.W, engine.H, seed);
    if (running) return;
    const r = rng(seed);
    engine.setFolds(set, () => (r() - 0.5) * 0.07);
    const i = state.cur, mode: 1 | 2 = isDark(i) ? 2 : 1;
    // (copies never include these creases: they're drawn onto the texture when it's composed)
    engine.bakeResidual(mode).then((bake) => {
      if (state.cur === i && !state.busy && !running && contextOk()) setOverlay(i, bake, isDark(i) ? config.residualDark : config.residualLight);
      warm();
    }).catch(() => warm());
  });

  // ------------------------------------------------------------ ?debug
  if (state.debug) {
    let frozen: { R: Run; from: number; to: number; url: HTMLCanvasElement; resAlpha: number } | null = null;
    const api = {
      config,
      /** freeze any frame of a transition from the current page (to the next one by default) */
      async seek(p: number, opts: { to?: number; seed?: number; stage?: boolean } = {}) {
        const from = state.cur;
        const to = opts.to ?? (from < pages.length - 1 ? from + 1 : from - 1);
        if (!frozen || frozen.to !== to || opts.seed !== undefined) {
          if (frozen) releaseRun(frozen.R);
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
        releaseRun(frozen.R);
        frozen = null;
      },
      /** wait until every page has been copied (tests) */
      async warmAll() {
        for (let i = 0; i < pages.length; i++) for (const l of ['pre', 'landed'] as snaps.Look[]) {
          if (i === state.cur && l === 'landed') { state.finishLanding(i); }
          await ensure(i, l);
        }
      },
      snapshots: snaps,
      engine,
    };
    (window as any).__crumple = api;
    import('./debug').then((m) => m.panel(api, mag));
  }
}
