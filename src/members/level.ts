// The level chip, the same everywhere: a dashed outline while self-rated, a solid filled pill once a coach has
// verified it ("verified by Ilia · 12 Jan 2027"). Never a number on its own, never an arrow or a history.
import { levelName } from '../lib/members/rules';
import { esc, fmtDate } from './ui';

export type LevelRow = { band: number | null; self_band: number | null; verified_at?: string | null; verified_by_name?: string | null };

export function levelChip(l: LevelRow | null | undefined, opts: { long?: boolean } = {}): string {
  if (l?.band) {
    const who = l.verified_by_name ? ` by ${esc(l.verified_by_name)}` : '';
    const when = opts.long && l.verified_at ? ` · ${esc(fmtDate(l.verified_at))}` : '';
    return `<span class="chip chip--verified">${esc(levelName(l.band))} <small>· verified${opts.long ? who + when : ''}</small></span>`;
  }
  if (l?.self_band) return `<span class="chip">${esc(levelName(l.self_band))} <small>· self-rated</small></span>`;
  return '';
}

export const LEVEL_NOTE = 'Self-rated levels are dashed. Your coach confirms your level after riding with you, and the chip fills in. No tests, no pressure.';
