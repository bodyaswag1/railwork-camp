// The camp application, shared by the form (src/scripts/camp.ts), /api/apply and the emails: one place that
// says what a valid application is and how to reach the rider in their chat.
// Relative imports carry ".js" so the Vercel function can load this as plain ESM.
import { campPage, type Chat } from '../content/site.js';

export type Application = {
  name: string;
  email: string;
  chat: Chat;
  /** "@username" or, for Telegram, a "+phone" number */
  handle: string;
  discipline: string;
  level: string;
  msg: string;
  promo: string;
  camp: string;
};

const t = campPage.apply;
export const chats = t.chats.map(([k]) => k);
export const chatName = (c: Chat) => t.chats.find(([k]) => k === c)?.[1] ?? c;
export const levelText = (v: string) => t.levels.find(([k]) => k === v)?.[1] ?? v;
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'rider';

export const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/** "@user", "user", "t.me/user", "instagram.com/user/" → "@user"; a Telegram phone → "+43…"; anything else → "" */
export function cleanHandle(chat: Chat, raw: string) {
  const s = raw.trim()
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    .replace(/^(t\.me|telegram\.me|instagram\.com|ig\.me\/m)\//i, '')
    .replace(/[/?#].*$/, '').replace(/^@+/, '');
  if (chat === 'telegram' && /^\+?[\d\s().-]{7,}$/.test(s)) return `+${s.replace(/\D/g, '')}`;
  const ok = chat === 'telegram' ? /^[A-Za-z]\w{3,31}$/ : /^[\w.]{1,30}$/;
  return ok.test(s) ? `@${s}` : '';
}

/** a link that opens a chat with the rider; Telegram also pre-fills `text` */
export function chatUrl(chat: Chat, handle: string, text = '') {
  const h = handle.replace(/^@/, '');
  if (chat === 'instagram') return `https://ig.me/m/${h}`;
  return `https://t.me/${h}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export type Errors = Partial<Record<'name' | 'email' | 'handle' | 'level', string>>;

export function check(a: Pick<Application, 'name' | 'email' | 'chat' | 'handle' | 'level'>): Errors {
  const e: Errors = {};
  if (!a.name.trim()) e.name = t.errors.name;
  if (!a.email.trim()) e.email = t.errors.email;
  else if (!emailOk(a.email.trim())) e.email = t.errors.emailBad;
  if (!cleanHandle(a.chat, a.handle)) e.handle = t.errors.handle;
  if (!t.levels.some(([k]) => k === a.level)) e.level = t.errors.level;
  return e;
}

/** an untrusted body (the API's input) → a clean application, or null */
export function parse(body: unknown): Application | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, max) : '');
  const chat = str('chat', 20) as Chat;
  if (!chats.includes(chat)) return null;
  const discipline = str('discipline', 40);
  const a: Application = {
    name: str('name', 100), email: str('email', 200), chat, handle: str('handle', 100),
    discipline: (t.disciplines as readonly string[]).includes(discipline) ? discipline : t.disciplines[0],
    level: str('level', 20), msg: str('msg', 2000), promo: str('promo', 40).toUpperCase(), camp: str('camp', 80),
  };
  if (Object.keys(check(a)).length) return null;
  return { ...a, handle: cleanHandle(chat, a.handle) };
}
