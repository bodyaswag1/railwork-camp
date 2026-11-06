// POST /api/auth/join: create a rider account and email the confirm link (through Resend, not Supabase's own
// mailer, which only delivers to the project's team). With an invite token the coach's rider record is
// attached right away: the personal link was sent to that person, which is the proof.
//
// Body: { firstName, lastName, email, password, phone, consent, adult, invite?, next?, company? (honeypot) }
// Answers: 200 {ok, mailed, claim?} · 400 {errors} · 409 {error:'email_taken'} · 429 · 503 not set up
import { checkJoin, safeNext, type JoinInput } from '../../src/lib/members/rules.js';
import { adminClient, authLink, json, passwordLeaked, rateOk, sendMail, siteOrigin } from '../../src/lib/members/server.js';
import { confirmMail } from '../../src/emails/auth.js';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as (Partial<JoinInput> & { company?: string }) | null;
  if (!body || typeof body !== 'object') return json(400, { errors: {} });
  if (body.company) return json(200, { ok: true, mailed: true }); // bots fill the hidden field

  const a = {
    firstName: String(body.firstName ?? '').trim().slice(0, 60),
    lastName: String(body.lastName ?? '').trim().slice(0, 60),
    email: String(body.email ?? '').trim().toLowerCase().slice(0, 254),
    password: String(body.password ?? ''),
    phone: String(body.phone ?? '').trim().slice(0, 32),
    consent: body.consent === true,
    adult: body.adult === true,
    invite: typeof body.invite === 'string' ? body.invite.slice(0, 100) : undefined,
  };
  const errors = checkJoin(a);
  if (Object.keys(errors).length) return json(400, { errors });

  const sb = adminClient();
  if (!sb) return json(503, { error: 'not_configured' });
  if (!(await rateOk(sb, request, 'join', 8, 60))) return json(429, { error: 'rate_limited' });
  if (await passwordLeaked(a.password)) return json(400, { errors: { password: 'leaked' } });

  const next = safeNext(body.next);
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'signup',
    email: a.email,
    password: a.password,
    options: { data: { first_name: a.firstName, last_name: a.lastName, phone: a.phone, consent: true, adult: true } },
  });
  if (error || !data?.user) {
    const taken = (error as { code?: string } | null)?.code === 'email_exists' || /already/i.test(error?.message ?? '');
    if (taken) return json(409, { error: 'email_taken' });
    console.error('generateLink signup', error);
    return json(500, { error: 'generic' });
  }

  let claim: string | undefined;
  if (a.invite) {
    const r = await sb.rpc('claim_invite_for', { p_token: a.invite, p_user: data.user.id });
    claim = r.error ? 'unavailable' : String(r.data);
    if (r.error) console.error('claim_invite_for', r.error);
  }

  const p = data.properties;
  const mail = confirmMail(a.firstName, authLink(siteOrigin(request), p.hashed_token, p.verification_type, next), claim === 'ok');
  const mailed = await sendMail({ to: a.email, ...mail });
  return json(200, { ok: true, mailed, claim });
}
