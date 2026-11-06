// Rules shared by the rider-area pages (browser) and the /api/auth routes (server), so the form and the
// server never disagree about what is valid.

export const LEVELS = [
  { band: 1, name: 'First day', means: 'Never ridden, or only a few runs. Personal sessions first.' },
  { band: 2, name: 'Sliding', means: 'Side-slips and falling leaf, stopping on a green run.' },
  { band: 3, name: 'Turning', means: 'Linking turns on green and easy blue runs.' },
  { band: 4, name: 'Cruising', means: 'Confident on blue, starting red, first small jumps.' },
  { band: 5, name: 'Carving & park start', means: 'Clean carves on red. Ollies, small kickers, boxes.' },
  { band: 6, name: 'Park', means: '180s and 360s on medium kickers, 50-50s and boardslides on rails.' },
  { band: 7, name: 'Advanced', means: 'Big air, 540s and up, inverts on trampoline or airbag, technical rails.' },
] as const;

export const levelName = (band: number | null | undefined) => LEVELS.find((l) => l.band === band)?.name ?? null;

export type JoinInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  consent: boolean;
  adult: boolean;
  invite?: string;
  next?: string;
};

export type JoinField = 'firstName' | 'lastName' | 'email' | 'password' | 'phone' | 'consent' | 'adult';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** field → message for everything wrong with a sign-up, empty when it is fine */
export function checkJoin(a: Partial<JoinInput>): Partial<Record<JoinField, string>> {
  const e: Partial<Record<JoinField, string>> = {};
  if (!a.firstName?.trim()) e.firstName = 'Add your first name.';
  if (!a.lastName?.trim()) e.lastName = 'Add your last name.';
  if (!a.email?.trim() || !EMAIL_RE.test(a.email.trim())) e.email = 'Check the email address.';
  if (!a.password || a.password.length < 8) e.password = 'Use 8 characters or more.';
  else if (a.password.length > 72) e.password = 'Keep it under 72 characters.';
  const digits = (a.phone ?? '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) e.phone = 'Add a number your coach can reach you on.';
  if (!a.consent) e.consent = 'Tick this to go on.';
  if (!a.adult) e.adult = 'Accounts are for 18+. A parent books for younger riders from their own account.';
  return e;
}

/** only same-site paths survive as a post-login destination */
export function safeNext(next: unknown, fallback = '/me'): string {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&#.%]*$/.test(next) ? next : fallback;
}
