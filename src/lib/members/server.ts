// Server-only helpers for the /api/auth routes: the Supabase admin client, rate limits, the leaked-password
// check and sending mail through Resend. Never import this from a page: it reads the secret key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** where links in emails point: SITE_URL if set, else the origin the request came in on (preview, localhost) */
export function siteOrigin(request: Request): string {
  return (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** false once this connection (or this email) has used up its tries; the window is in minutes */
export async function rateOk(sb: SupabaseClient, request: Request, bucket: string, max: number, minutes: number, extra?: string) {
  const ip = createHash('sha256').update(clientIp(request)).digest('hex').slice(0, 24);
  const keys = [`${bucket}:ip:${ip}`, ...(extra ? [`${bucket}:x:${createHash('sha256').update(extra.toLowerCase()).digest('hex').slice(0, 24)}`] : [])];
  for (const key of keys) {
    const { data, error } = await sb.rpc('rate_ok', { p_key: key, p_max: max, p_window: `${minutes} minutes` });
    if (error) return true; // never lock people out because the limiter itself broke
    if (data === false) return false;
  }
  return true;
}

/** true if the password is on the Have I Been Pwned list. Only the first 5 characters of its SHA-1 leave here. */
export async function passwordLeaked(password: string): Promise<boolean> {
  const sha = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const tail = sha.slice(5);
    return (await res.text()).split('\n').some((l) => l.startsWith(tail) && !l.trim().endsWith(':0'));
  } catch {
    return false; // the check is a courtesy; if the service is down, sign-up still works
  }
}

export type Outgoing = { to: string; subject: string; html: string; text: string };

/** Sends through Resend. Without RESEND_API_KEY (local dev) the mail is printed instead and counts as sent. */
export async function sendMail(mail: Outgoing): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'BAS CAMP <ilia@bascamp.world>';
  if (!key) {
    console.log(`\n[mail → ${mail.to}] ${mail.subject}\n${mail.text}\n`);
    // local dev (scripts/members/dev.mjs) keeps the last mail per address so the e2e test can open its link
    if (process.env.MAIL_DROP_DIR) {
      const { mkdirSync, writeFileSync } = await import('node:fs');
      mkdirSync(process.env.MAIL_DROP_DIR, { recursive: true });
      writeFileSync(`${process.env.MAIL_DROP_DIR}/${mail.to.replace(/[^\w.@-]/g, '_')}.json`, JSON.stringify(mail));
    }
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
  }).catch(() => null);
  if (!res?.ok) console.error('resend failed', res?.status, res ? (await res.text()).slice(0, 300) : 'network');
  return !!res?.ok;
}

/** an email link that lands on /auth, which verifies the token in the browser and moves on to `next` */
export function authLink(origin: string, tokenHash: string, type: string, next: string) {
  const q = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${origin}/auth?${q}`;
}
