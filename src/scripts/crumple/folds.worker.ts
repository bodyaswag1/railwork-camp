// Fold sets are generated off the main thread: finding non-crossing fold lines is a few hundred
// milliseconds of trial and error on a phone, which would otherwise stutter scrolling or a swipe.
import { generate } from './folds';

self.onmessage = (e: MessageEvent<{ id: number; W: number; H: number; seed: number }>) => {
  const { id, W, H, seed } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, set: generate(W, H, seed) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) }); // the page generates it instead
  }
};
