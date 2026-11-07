// The rider's own time: bookings, weekly slots and trips, drawn two ways.
//  - the season pass: one cell per week (Monday to Sunday, Vienna time), punched red when you rode,
//    hatched when a trip paused the streak, outlined for the week you are in;
//  - the week timetable: seven days with your sessions, your weekly slot requests and what is open to book.
import { esc } from './ui';
import { KIND, TZ, time } from './labels';
import { ICON } from './icons';
import { sb } from './sb';

export type Booking = {
  id: string; status: string; source: string; pack_id: string | null;
  sessions: { id: string; title: string; kind: string; starts_at: string; ends_at: string; venues: { name: string } | null; profiles?: { first_name: string } | null };
};
export type Loop = { id: string; status: string; weekday: number; start_time: string; title: string; kind: string; change_request: string | null };
export type Absence = { id: string; from_date: string; to_date: string; note: string | null };
export type Open = { id: string; kind: string; title: string; starts_at: string; ends_at: string; venue: string | null; coach: string | null;
  capacity: number; seats_left: number; price_eur: number | null; level_min: number | null; level_max: number | null; notes: string | null;
  my_booking: string | null; my_status: string | null };

const LIVE = ['reserved', 'paid', 'attended'];

/** yyyy-mm-dd of an instant, on the club calendar */
export function dayKey(d: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
  return parts; // en-CA formats as 2026-11-07
}
/** a yyyy-mm-dd key as a local-noon Date, safe for adding days */
export const keyDate = (k: string) => new Date(`${k}T12:00:00`);
export const addDays = (k: string, n: number) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
/** the Monday of the week holding this day */
export function monday(k: string): string {
  const d = keyDate(k);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return dayKey(d);
}
export const todayKey = () => dayKey(new Date());

/** everything the rider-side timetable needs, in one round trip */
export async function loadMine() {
  const [{ data: bs }, { data: loops }, { data: abs }] = await Promise.all([
    sb.from('bookings').select('id, status, source, pack_id, sessions(id, title, kind, starts_at, ends_at, venues(name), profiles:coach_id(first_name))'),
    sb.from('loops').select('*').in('status', ['requested', 'active']),
    sb.from('absences').select('*').order('from_date'),
  ]);
  const bookings = ((bs ?? []) as unknown as Booking[]).filter((b) => b.sessions).sort((a, b) => a.sessions.starts_at.localeCompare(b.sessions.starts_at));
  return { bookings, loops: (loops ?? []) as Loop[], absences: (abs ?? []) as Absence[] };
}

// ---------------------------------------------------------------- season pass
export type PassWeek = { start: string; ride: number; trip: boolean; now: boolean };

export function passWeeks(bookings: Booking[], absences: Absence[], n = 16): PassWeek[] {
  const now = Date.now();
  const thisMon = monday(todayKey());
  const weeks: PassWeek[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisMon, -7 * i);
    const end = addDays(start, 6);
    const ride = bookings.filter((b) => LIVE.includes(b.status) && new Date(b.sessions.starts_at).getTime() <= now
      && dayKey(b.sessions.starts_at) >= start && dayKey(b.sessions.starts_at) <= end).length;
    const trip = absences.some((a) => a.from_date <= end && a.to_date >= start);
    weeks.push({ start, ride, trip: trip && !ride, now: start === thisMon });
  }
  return weeks;
}

export function renderPass(el: HTMLElement, weeks: PassWeek[], figures: { streak: number; longest: number; sessions: number; hours: string }) {
  const months = weeks.map((w, i) => {
    const m = keyDate(w.start).toLocaleDateString('en-GB', { month: 'short' });
    const prev = i ? keyDate(weeks[i - 1].start).toLocaleDateString('en-GB', { month: 'short' }) : '';
    return m !== prev && i < weeks.length - 1 ? m : '';
  });
  const title = (w: PassWeek) => {
    const d = keyDate(w.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `Week of ${d}: ${w.ride ? `${w.ride} session${w.ride > 1 ? 's' : ''}` : w.trip ? 'away (streak paused)' : w.now ? 'this week' : 'no session'}`;
  };
  el.innerHTML = `<div class="pass">
    <div class="pass__figures">
      <div class="pass__fig pass__fig--lead" data-fig="streak"><b>${figures.streak}</b><span>${figures.streak === 1 ? 'week' : 'weeks'} running</span></div>
      <div class="pass__fig" data-fig="longest"><b>${figures.longest}</b><span>longest run</span></div>
      <div class="pass__fig" data-fig="sessions"><b>${figures.sessions}</b><span>sessions</span></div>
      <div class="pass__fig" data-fig="hours"><b>${esc(figures.hours)}</b><span>hours</span></div>
    </div>
    <div class="pass__strip" style="--weeks:${weeks.length}" role="img" aria-label="Your last ${weeks.length} weeks: ${weeks.filter((w) => w.ride).length} with a session">
      ${weeks.map((w) => `<span class="pass__week${w.ride ? ' pass__week--ride' : ''}${w.trip ? ' pass__week--trip' : ''}${w.now ? ' pass__week--now' : ''}" title="${esc(title(w))}"></span>`).join('')}
    </div>
    <div class="pass__months" style="--weeks:${weeks.length}" aria-hidden="true">${months.map((m) => `<span>${m}</span>`).join('')}</div>
    <div class="pass__key"><span><i class="ride"></i>Rode</span><span><i class="trip"></i>Away: paused, not broken</span><span><i class="now"></i>This week</span></div>
  </div>`;
}

// ---------------------------------------------------------------- week timetable
export function renderWeek(el: HTMLElement, startMon: string, mine: Booking[], open: Open[], loops: Loop[]) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(startMon, i));
  const loopFor = (k: string) => {
    const wd = ((keyDate(k).getDay() + 6) % 7) + 1;
    return loops.filter((l) => l.status === 'requested' && l.weekday === wd);
  };
  el.innerHTML = `<div class="week">${days.map((k) => {
    const d = keyDate(k);
    const booked = mine.filter((b) => b.status !== 'cancelled' && dayKey(b.sessions.starts_at) === k);
    const free = open.filter((s) => !s.my_booking && s.seats_left > 0 && dayKey(s.starts_at) === k);
    const asked = k >= today ? loopFor(k) : [];
    const cls = ['week__day', k === today ? 'week__day--today' : '', k < today ? 'week__day--past' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">
      <div class="week__date"><span>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</span><b>${d.getDate()}</b></div>
      <div class="week__slots">${[
        ...booked.map((b) => `<a class="slot slot--mine" href="/me/sessions#b-${b.id}" title="${esc(`${b.sessions.title}${b.source === 'loop' ? ' (weekly)' : ''}`)}"><b>${esc(time(b.sessions.starts_at))}</b>${esc(KIND[b.sessions.kind] ?? b.sessions.title)}</a>`),
        ...asked.map((l) => `<span class="slot slot--loopreq" title="Weekly slot waiting for your coach"><b>${esc(String(l.start_time).slice(0, 5))}</b>Asked</span>`),
        ...free.slice(0, 3).map((s) => `<a class="slot slot--open" href="/book?kind=${s.kind}&day=${k}" title="${esc(s.title)}"><b>${esc(time(s.starts_at))}</b>${s.kind === 'trampoline' ? 'Trampoline' : 'Personal'}</a>`),
      ].join('')}</div></div>`;
  }).join('')}</div>
  <div class="legend"><span><i class="mine"></i>Booked</span><span><i class="loopreq"></i>Weekly slot asked</span><span><i class="open"></i>Open to book</span></div>`;
}

/** "Mon 3 – Sun 9 Nov" */
export function weekLabel(startMon: string) {
  const a = keyDate(startMon), b = keyDate(addDays(startMon, 6));
  const sameMonth = a.getMonth() === b.getMonth();
  return `${a.getDate()}${sameMonth ? '' : ' ' + a.toLocaleDateString('en-GB', { month: 'short' })} – ${b.getDate()} ${b.toLocaleDateString('en-GB', { month: 'short' })}`;
}

/** the day stub used at the left of a session row */
export function dayStub(iso: string, mine = true) {
  const d = new Date(iso);
  const wd = d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short' });
  const dd = d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' });
  return `<span class="daystub${mine ? ' daystub--mine' : ''}"><small>${esc(wd)}</small><b>${esc(dd)}</b></span>`;
}

/** "in 3 days", "tomorrow", "today 18:00", or the date */
export function relDay(iso: string) {
  const k = dayKey(iso), t = todayKey();
  const diff = Math.round((keyDate(k).getTime() - keyDate(t).getTime()) / 864e5);
  if (diff === 0) return `Today at ${time(iso)}`;
  if (diff === 1) return `Tomorrow at ${time(iso)}`;
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return '';
}

export const repeatIcon = ICON.repeat;
