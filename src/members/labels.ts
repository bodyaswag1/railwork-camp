// Words and formats shared by the rider-area pages. Plain on purpose: the UI layer will be restyled later.
export const TZ = 'Europe/Vienna';

export const KIND: Record<string, string> = { personal: 'Personal session', trampoline: 'Trampoline' };

export const BOOK_RESULT: Record<string, string> = {
  ok: 'Booked. Your spot is reserved: pay your coach on the day.',
  full: 'That session just filled up.',
  already: 'You are already booked on this one.',
  closed: 'This session is no longer running.',
  started: 'This session has already started.',
  not_found: 'That session is gone. Pick another one.',
  need_level: 'This group is matched by level. Set your level on your profile, or book a personal session first and your coach will place you.',
  level_too_low: 'This group is a step or two above your level. Start with a personal session: your coach will move you up.',
  signed_out: 'Sign in to book.',
  too_late: 'Changes close 48 hours before the session. Message your coach.',
  not_cancellable: 'This booking can no longer be changed.',
};

export const BOOKING_STATUS: Record<string, string> = {
  reserved: 'Reserved', paid: 'Paid', cancelled: 'Cancelled', attended: 'Attended', no_show: 'Missed',
};

export const CAMP_STATUS: Record<string, string> = {
  applied: 'Applied: your coach will get back to you', waitlist: 'On the waitlist', accepted: 'Accepted: deposit next',
  deposit_paid: 'Deposit paid', paid: 'Fully paid', attended: 'Attended', cancelled: 'Withdrawn', declined: 'Not this time',
};

export const DISCIPLINE: Record<string, string> = { snowboard: 'Snowboard', ski: 'Ski' };
export const TERRAIN: Record<string, string> = { piste: 'Piste', park: 'Park', freeride: 'Freeride', backcountry: 'Backcountry' };
export const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
export const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const euro = (n: number | string | null | undefined) => (n == null ? '' : `€${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`);
export const hours = (minutes: number) => (Math.round((minutes / 60) * 10) / 10).toString();
