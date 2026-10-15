// Paints the paper-ageing textures off the main thread.
import { noise, creaseFacets, age } from './paper-gen';

type Job = { id: number; kind: 'noise' | 'crease' | 'age'; dark?: boolean; seed: number; rgb?: [number, number, number]; alpha?: number; q: number };

self.onmessage = async (e: MessageEvent<Job>) => {
  const j = e.data;
  try {
    const c = (j.kind === 'noise' ? noise(j.rgb!, j.alpha!, j.seed) : j.kind === 'crease' ? creaseFacets(j.seed) : age(!!j.dark, j.seed)) as OffscreenCanvas;
    const blob = await c.convertToBlob({ type: 'image/webp', quality: j.q });
    (self as unknown as Worker).postMessage({ id: j.id, blob });
  } catch {
    (self as unknown as Worker).postMessage({ id: j.id, blob: null }); // the page renders it instead
  }
};
