// The account emails the rider area sends: confirm your email, sign-in link, reset your password.
// Same frame as the camp mails (dark page, ice paper, red button), kept short: one job per mail.
export type Mail = { subject: string; html: string; text: string };

const C = { night: '#101314', red: '#BA1422', ice: '#E1EFFA', grey: '#4E5A64' };
const FONT = `'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif`;
const COND = `font-family:'Archivo',Impact,'Arial Narrow Bold','Arial Black',sans-serif;font-weight:900;font-stretch:62%;text-transform:uppercase;`;
const T = `role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function frame(o: { preheader: string; title: string; body: string; cta: string; href: string; foot: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>BAS CAMP</title></head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table ${T} style="background:${C.night};"><tr><td align="center" style="padding:24px 8px 32px;">
<table ${T} style="max-width:520px;">
<tr><td style="padding:0 4px 14px;${COND}font-size:28px;line-height:28px;color:${C.ice};letter-spacing:1px;">BAS CAMP</td></tr>
<tr><td style="background:${C.ice};padding:32px 28px 28px;">
  <div style="${COND}font-size:40px;line-height:38px;color:${C.night};">${esc(o.title)}</div>
  <div style="font-family:${FONT};font-size:16px;line-height:24px;color:${C.night};padding:16px 0 24px;">${o.body}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${C.red};border:2px solid ${C.night};box-shadow:4px 4px 0 ${C.night};">
      <a href="${esc(o.href)}" style="display:inline-block;padding:14px 22px;font-family:${FONT};font-weight:800;font-size:16px;color:#fff;text-decoration:none;">${esc(o.cta)}</a>
    </td></tr></table>
  <div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.grey};padding-top:24px;">${o.foot}<br>
    If the button does not work, paste this into your browser:<br><span style="word-break:break-all;">${esc(o.href)}</span></div>
</td></tr>
<tr><td style="padding:14px 4px 0;font-family:${FONT};font-size:12px;color:#8A949C;">bascamp.world · Ilia Baskakov</td></tr>
</table></td></tr></table></body></html>`;
}

export function confirmMail(firstName: string, href: string, invited: boolean): Mail {
  const hi = firstName ? `Hi ${esc(firstName)},` : 'Hi,';
  const line = invited
    ? 'your coach set up your BAS profile. Confirm this email and you are in: your level and history are already there.'
    : 'one tap to confirm this is your email, and your BAS profile is ready.';
  return {
    subject: 'Confirm your email · BAS CAMP',
    html: frame({ preheader: 'One tap and you are in.', title: 'Confirm your email', body: `${hi}<br>${line}`, cta: 'Confirm and open my profile', href, foot: 'The link works for 24 hours. Did not sign up? Ignore this email and nothing happens.' }),
    text: `${firstName ? `Hi ${firstName},` : 'Hi,'}\n${invited ? 'Your coach set up your BAS profile.' : ''} Confirm your email and open your profile:\n${href}\n\nThe link works for 24 hours. Did not sign up? Ignore this email.`,
  };
}

export function resetMail(href: string): Mail {
  return {
    subject: 'Set a new password · BAS CAMP',
    html: frame({ preheader: 'Choose a new password.', title: 'New password', body: 'Someone (hopefully you) asked to reset the password on this BAS account. Tap below and choose a new one.', cta: 'Set a new password', href, foot: 'The link works for one hour. Did not ask? Ignore this email: your password stays as it is.' }),
    text: `Set a new password for your BAS account:\n${href}\n\nThe link works for one hour. Did not ask? Ignore this email.`,
  };
}
