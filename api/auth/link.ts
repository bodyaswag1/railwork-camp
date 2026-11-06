// POST /api/auth/link: send an email link.
//   { kind: 'verify', email, next? }  the confirm link again, for an account that is not confirmed yet
//   { kind: 'reset',  email }         a set-a-new-password link
// It answers the same whether or not the address has an account, so nobody can use it to find out who rides
// with BAS. Answers: 200 {ok} · 400 · 429 · 503
import { EMAIL_RE, safeNext } from '../../src/lib/members/rules.js';
import { adminClient, authLink, json, rateOk, sendMail, siteOrigin } from '../../src/lib/members/server.js';
import { confirmMail, resetMail } from '../../src/emails/auth.js';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { kind?: string; email?: string; next?: string } | null;
  const email = String(body?.email ?? '').trim().toLowerCase();
  const kind = body?.kind;
  if ((kind !== 'verify' && kind !== 'reset') || !EMAIL_RE.test(email)) return json(400, { error: 'bad_request' });

  const sb = adminClient();
  if (!sb) return json(503, { error: 'not_configured' });
  if (!(await rateOk(sb, request, `link-${kind}`, 5, 60, email))) return json(429, { error: 'rate_limited' });

  const { data: rows } = await sb.rpc('auth_user_state', { p_email: email });
  const who = (rows as { state: string; first_name: string | null }[] | null)?.[0];
  const origin = siteOrigin(request);

  if (kind === 'verify' && who?.state === 'unconfirmed') {
    const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data) console.error('generateLink magiclink', error);
    else {
      const p = data.properties;
      await sendMail({ to: email, ...confirmMail(who.first_name ?? '', authLink(origin, p.hashed_token, p.verification_type, safeNext(body?.next)), false) });
    }
  }
  if (kind === 'reset' && who && who.state !== 'none') {
    const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email });
    if (error || !data) console.error('generateLink recovery', error);
    else await sendMail({ to: email, ...resetMail(authLink(origin, data.properties.hashed_token, 'recovery', '/me/settings#password')) });
  }
  return json(200, { ok: true });
}
