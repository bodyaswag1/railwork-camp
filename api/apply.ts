// POST /api/apply: a BAS CAMP application from the /camp form. Emails Ilia the application (with a one-tap
// link to the rider's chat), then emails the rider a note from Ilia. Both go through Resend
// (https://resend.com) from bascamp.world.
//
// Env (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   required; without it the function answers 503 and the form falls back to an Instagram DM
//   NOTIFY_TO        optional, where applications go (default: Ilia's email in site.ts)
//   MAIL_FROM        optional, the sender (default: campMail.from)
//
// Answers: 200 {ok:true, mailed} · 400 bad application · 503 not set up · 502 Ilia's email didn't go out.
// The form treats anything but 200 as "hand it over by DM", so an application is never lost.
import { campMail, rider } from '../src/content/site.js';
import { parse } from '../src/lib/apply.js';
import { iliaMail, riderMail, type Mail } from '../src/emails/apply.js';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function send(key: string, mail: Mail & { from: string; to: string; replyTo: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mail.from, to: [mail.to], reply_to: mail.replyTo, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return json(503, { ok: false, error: 'not configured' });

  const body: unknown = await request.json().catch(() => null);
  // a hidden field people never see; bots fill it in. Pretend it went through.
  if (body && typeof body === 'object' && (body as Record<string, unknown>).company) return json(200, { ok: true, mailed: true });
  const a = parse(body);
  if (!a) return json(400, { ok: false, error: 'invalid application' });

  const from = process.env.MAIL_FROM || campMail.from;
  const ilia = process.env.NOTIFY_TO || rider.email;
  try {
    // Ilia first: if this fails, the rider is told to send the application by DM instead
    await send(key, { ...iliaMail(a), from, to: ilia, replyTo: a.email });
  } catch (err) {
    console.error('apply: notifying Ilia failed', err);
    return json(502, { ok: false, error: 'could not send' });
  }
  let mailed = true;
  try {
    await send(key, { ...riderMail(a), from, to: a.email, replyTo: rider.email });
  } catch (err) {
    mailed = false; // Ilia has the application and will text them anyway
    console.error('apply: rider email failed', err);
  }
  return json(200, { ok: true, mailed });
}

export function GET() {
  return json(405, { ok: false, error: 'POST an application' });
}
