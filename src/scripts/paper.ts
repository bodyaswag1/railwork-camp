// Paper ageing on the pages: textures come from a worker (OffscreenCanvas) so start-up never blocks;
// without OffscreenCanvas they're drawn on the main thread, one per idle slot.
// Everything ends up as same-origin blob: URLs, so page snapshots never taint the WebGL canvas.
import { rng, noise, creaseFacets, age, useDomCanvas, type AnyCanvas } from './paper-gen';

export { rng };

type Job = { kind: 'noise' | 'crease' | 'age'; dark?: boolean; seed: number; rgb?: [number, number, number]; alpha?: number; q: number };

const idle = (fn: () => void) =>
  ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 120));

let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, { job: Job; done: (url: string) => void }>();

function renderHere(job: Job): Promise<string> {
  return new Promise((res) => idle(() => {
    const c = (job.kind === 'noise' ? noise(job.rgb!, job.alpha!, job.seed) : job.kind === 'crease' ? creaseFacets(job.seed) : age(!!job.dark, job.seed)) as HTMLCanvasElement;
    c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', job.q)), 'image/webp', job.q);
  }));
}
// a worker that can't load, errors or stalls hands its jobs back to the page
function takeBack(id: number) {
  const w = waiting.get(id);
  if (!w) return;
  waiting.delete(id);
  renderHere(w.job).then(w.done);
}
function dropWorker() {
  worker?.terminate();
  worker = null;
  useDomCanvas();
  [...waiting.keys()].forEach(takeBack);
}

/** started on first use, so pages that only need makeNoise() never spin one up */
function getWorker() {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype) {
      worker = new Worker(new URL('./paper.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const w = waiting.get(e.data.id);
        if (!w) return;
        if (!e.data.blob) { takeBack(e.data.id); return; }
        waiting.delete(e.data.id);
        w.done(URL.createObjectURL(e.data.blob));
      };
      worker.onerror = dropWorker;
      worker.onmessageerror = dropWorker;
    }
  } catch { worker = null; }
  if (!worker) useDomCanvas();
  return worker;
}

function render(job: Job): Promise<string> {
  const w = getWorker();
  if (!w) return renderHere(job);
  const id = ++seq;
  return new Promise((done) => {
    waiting.set(id, { job, done });
    w.postMessage({ ...job, id });
    setTimeout(() => takeBack(id), 6000);
  });
}

/**
 * Paint the wear layers of every page under `root`. Seeds are fixed so the ageing is stable between visits.
 * The page on screen goes first. Resolves once every page is done.
 */
export async function agePaper(root: ParentNode, first?: Element) {
  const shared = Promise.all([
    render({ kind: 'noise', rgb: [16, 19, 20], alpha: 120, seed: 11, q: 0.9 }),
    render({ kind: 'noise', rgb: [225, 239, 250], alpha: 90, seed: 23, q: 0.9 }),
    render({ kind: 'crease', seed: 37, q: 0.82 }),
  ]);
  const pos = ['0% 0%', '30% 70%', '90% 20%', '60% 100%', '15% 45%'];
  const creases = Array.from(root.querySelectorAll<HTMLElement>('[data-crease]'));
  const ages = Array.from(root.querySelectorAll<HTMLElement>('[data-age]'));
  const sections = Array.from(new Set(ages.map((el) => el.closest('[data-page], section, body')!)));
  const order = first ? [first, ...sections.filter((s) => s !== first)] : sections;
  const paint = async (sec: Element) => {
    const i = ages.findIndex((el) => sec.contains(el));
    const el = ages[i];
    const [[gL, gD, cr], ageUrl] = await Promise.all([shared, el ? render({ kind: 'age', dark: el.dataset.age === 'D', seed: 7 + i * 977, q: 0.85 }) : Promise.resolve('')]);
    if (el) el.style.backgroundImage = `url(${ageUrl})`;
    sec.querySelectorAll<HTMLElement>('[data-grain]').forEach((g) => { g.style.backgroundImage = `url(${g.dataset.grain === 'D' ? gD : gL})`; });
    sec.querySelectorAll<HTMLElement>('[data-crease]').forEach((c) => {
      const k = creases.indexOf(c);
      c.style.backgroundImage = `url(${cr})`;
      c.style.backgroundPosition = pos[k % 5];
      if (k % 2) c.style.transform = 'scaleX(-1)';
    });
  };
  await paint(order[0]);
  await Promise.all(order.slice(1).map(paint));
}

/** Small grain tile as a data: URL, drawn on the main thread (used by /camp). */
export function makeNoise(rgb: [number, number, number], alpha: number, seed: number) {
  const c = noise(rgb, alpha, seed) as AnyCanvas;
  if (c instanceof HTMLCanvasElement) return c.toDataURL();
  const d = document.createElement('canvas'); d.width = c.width; d.height = c.height;
  d.getContext('2d')!.drawImage(c as OffscreenCanvas, 0, 0);
  return d.toDataURL();
}
