// ?debug only: lil-gui panel for the whole config, a progress scrubber and seek/release.
import GUI from 'lil-gui';
import type { Config } from './config';
import type { Mag } from '../magazine';

type Api = { config: Config; seek(p: number, o?: { to?: number; seed?: number; stage?: boolean }): Promise<void>; release(): void };

const groups: Record<string, (keyof Config)[]> = {
  Timing: ['duration', 'peakRound', 'compressStart', 'releaseEnd', 'snapshotWait'],
  Folding: ['bigFolds', 'smallFolds', 'edgeTucks', 'bigAngle', 'smallAngle', 'tuckAngle', 'creaseStrength', 'creaseLines', 'foldSoftness'],
  Ball: ['ballSize', 'ballLumps', 'spherize'],
  Tumble: ['tumble', 'twist', 'yaw'],
  Light: ['lightAngle', 'lightElevation', 'ambient', 'diffuse', 'sheen', 'foldDarkening', 'rimDarkening', 'rimLight', 'showThrough'],
  'After landing': ['residualLight', 'residualDark', 'residualDepth'],
  Film: ['FILM_FPS', 'holds', 'holdGuard', 'jitterPx', 'jitterDeg', 'weavePx', 'flicker'],
  Stage: ['stageStart', 'stageEnd', 'stageDensity', 'clearZone'],
  Mesh: ['segments', 'maxDpr'],
};
const ranges: Partial<Record<keyof Config, [number, number, number]>> = {
  duration: [0.4, 3, 0.05], snapshotWait: [0, 3, 0.05], peakRound: [0, 0.1, 0.005], compressStart: [0.4, 0.95, 0.01], releaseEnd: [0.05, 0.6, 0.01],
  bigFolds: [3, 6, 1], smallFolds: [0, 14, 1], edgeTucks: [0, 12, 1], bigAngle: [90, 179, 1], smallAngle: [20, 179, 1], tuckAngle: [20, 179, 1],
  creaseStrength: [0, 1, 0.01], creaseLines: [0, 28, 1], foldSoftness: [0, 0.03, 0.001],
  ballSize: [0.15, 0.45, 0.005], ballLumps: [0, 0.6, 0.01], spherize: [0, 1, 0.01],
  tumble: [0, 120, 1], twist: [0, 90, 1], yaw: [0, 60, 1],
  lightAngle: [-180, 180, 1], lightElevation: [5, 90, 1], ambient: [0, 1, 0.01], diffuse: [0, 1.5, 0.01], sheen: [0, 0.6, 0.01],
  foldDarkening: [0, 1, 0.01], rimDarkening: [0, 1, 0.01], rimLight: [0, 1, 0.01], showThrough: [0, 0.3, 0.005],
  residualLight: [0, 0.3, 0.005], residualDark: [0, 0.15, 0.005], residualDepth: [0, 1, 0.01],
  FILM_FPS: [6, 60, 1], holds: [0, 4, 1], holdGuard: [0, 0.4, 0.01], jitterPx: [0, 5, 0.1], jitterDeg: [0, 2, 0.05], weavePx: [0, 4, 0.1], flicker: [0, 0.2, 0.005],
  stageStart: [0, 0.5, 0.01], stageEnd: [0.2, 1, 0.01], stageDensity: [0, 1, 0.05], clearZone: [0, 0.6, 0.01],
  segments: [40, 260, 1], maxDpr: [1, 3, 0.25],
};

export function panel(api: Api, mag: Mag) {
  const gui = new GUI({ title: 'Crumple' });
  const s = { p: 0, seed: 1, stage: true, next: () => mag.go(mag.state.cur + 1), prev: () => mag.go(mag.state.cur - 1), release: () => api.release(), reroll: () => { s.seed = (Math.random() * 1e9) | 0; api.seek(s.p, { seed: s.seed, stage: s.stage }); } };
  const scrub = gui.addFolder('Scrub');
  scrub.add(s, 'p', 0, 1, 0.001).name('progress p').onChange((v: number) => api.seek(v, { stage: s.stage }));
  scrub.add(s, 'stage').name('stage graphics');
  scrub.add(s, 'reroll').name('new seed');
  scrub.add(s, 'release').name('release');
  scrub.add(s, 'next').name('play → next page');
  scrub.add(s, 'prev').name('play → previous page');
  for (const [name, keys] of Object.entries(groups)) {
    const f = gui.addFolder(name).close();
    for (const k of keys) {
      const rg = ranges[k];
      if (rg) f.add(api.config, k, rg[0], rg[1], rg[2]);
    }
  }
  gui.onFinishChange(() => { if (s.p > 0) api.seek(s.p, { seed: s.seed, stage: s.stage }); });
}
