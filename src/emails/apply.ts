// The two emails /api/apply sends: a note from Ilia to the rider, and the application to Ilia with a one-tap
// link to the rider's chat and a ready message. Copy lives in campMail (src/content/site.ts); this file is
// the layout only: tables and inline styles, because that's what mail apps render. The poster bits (header,
// starburst numbers, signature, footer) are images baked by scripts/mail-art.mjs into public/mail/, since
// mail apps drop SVG and most web fonts. Preview both mails with `npm run mail:preview`.
import { camp, campMail as m, rider } from '../content/site.js';
import { type Application, chatName, chatUrl, firstName, levelText } from '../lib/apply.js';

export type Mail = { subject: string; html: string; text: string };

const C = { night: '#101314', red: '#BA1422', pink: '#FF94E3', ice: '#E1EFFA', grey: '#4E5A64', line: '#C9D6E0' };
const FONT = `'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif`;
// the site's condensed headline (Archivo 900 at 62% width) where the mail app loads web fonts, Impact elsewhere
const COND = `font-family:'Archivo',Impact,'Arial Narrow Bold','Arial Black',sans-serif;font-weight:900;font-stretch:62%;text-transform:uppercase;`;
const LABEL = `font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:800;`;
const img = (p: string) => `${m.site}/mail/${p}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');
const T = `role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`;

/** dark page, a poster image on top, the ice "paper" in the middle, the torn footer image at the end */
function frame(preheader: string, top: string, inner: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>BAS CAMP</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.night};}
  a{color:${C.red};}
  @media (max-width:600px){ .px{padding-left:20px!important;padding-right:20px!important;} .h1{font-size:44px!important;line-height:40px!important;} }
</style></head>
<body style="margin:0;padding:0;background:${C.night};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table ${T} style="background:${C.night};">
<tr><td align="center" style="padding:20px 8px 28px;">
<table ${T} style="max-width:560px;">
<tr><td style="line-height:0;font-size:0;">${top}</td></tr>
<tr><td style="background:${C.ice};">${inner}</td></tr>
<tr><td style="line-height:0;font-size:0;"><a href="${m.site}/camp"><img src="${img('footer.png')}" width="560" alt="BAS CAMP · Issue 01" style="display:block;border:0;width:100%;max-width:560px;height:auto;"></a></td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** [label, plain value, html to show instead] */
type Row = [string, string, string?];

function rows(list: Row[]) {
  return list.map(([k, v, html], i) => `<tr>
  <td valign="top" style="padding:10px 12px 10px 0;${i ? `border-top:1px dashed ${C.line};` : ''}${LABEL}color:${C.grey};width:36%;">${esc(k)}</td>
  <td valign="top" style="padding:9px 0;${i ? `border-top:1px dashed ${C.line};` : ''}font-family:${FONT};font-size:15px;line-height:21px;font-weight:600;color:${C.night};">${html ?? nl2br(v)}</td>
</tr>`).join('');
}

/** a cut-out ticket: dashed edge, ✂ on the label, an optional stamp on the right */
function ticket(title: string, list: Row[], stamp = '') {
  return `<table ${T} style="background:#ffffff;border:2px dashed ${C.night};margin:6px 0 30px;">
<tr><td style="padding:12px 16px 4px;">
  <table ${T}><tr>
    <td style="${LABEL}color:${C.red};">✂ ${esc(title)}</td>
    ${stamp ? `<td align="right"><span style="display:inline-block;border:2px solid ${C.red};padding:3px 8px;${LABEL}font-size:10px;color:${C.red};">${esc(stamp)}</span></td>` : ''}
  </tr></table>
</td></tr>
<tr><td style="padding:4px 16px 8px;"><table ${T}>${rows(list)}</table></td></tr>
</table>`;
}

/** a red-framed box with a red tab, for the money */
function box(title: string, list: Row[]) {
  return `<table ${T} style="border:3px solid ${C.red};margin:6px 0 12px;background:#ffffff;">
<tr><td style="background:${C.red};padding:8px 16px;${LABEL}font-size:12px;color:#ffffff;">${esc(title)}</td></tr>
<tr><td style="padding:4px 16px 8px;"><table ${T}>${rows(list)}</table></td></tr>
</table>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 10px;"><tr>
<td style="background:${C.red};border:2px solid ${C.night};box-shadow:4px 4px 0 ${C.night};"><a href="${esc(href)}" style="display:inline-block;padding:15px 22px;font-family:${FONT};font-size:15px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(label)}</a></td>
</tr></table>`;
}

const p = (html: string, extra = '') => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.night};${extra}">${html}</p>`;
const small = (html: string, extra = '') => p(html, `font-size:13px;line-height:19px;color:${C.grey};${extra}`);
/** condensed headline with the red marker line under it, like the site's */
const h2 = (s: string) => `<h2 style="margin:10px 0 18px;${COND}font-size:34px;line-height:32px;color:${C.night};"><span style="border-bottom:5px solid ${C.red};">${esc(s)}</span></h2>`;

const shown = (a: Application) => ({ first: firstName(a.name), chat: chatName(a.chat), level: levelText(a.level) });

// ---------------------------------------------------------------- to the rider, from Ilia
export function riderMail(a: Application): Mail {
  const r = m.rider, s = shown(a);
  const list: Row[] = [
    [r.rows.camp, camp.full],
    [r.rows.where, r.where],
    [r.rows.when, camp.datesLong],
    [r.rows.discipline, a.discipline],
    [r.rows.level, s.level],
    [r.rows.chat, `${s.chat} · ${a.handle}`],
    [r.rows.price, camp.price],
  ];
  if (a.msg) list.push([r.rows.msg, a.msg]);
  if (a.promo) list.push([r.rows.promo, a.promo]);

  const steps = r.next.map((f, i) => `<tr>
  <td valign="top" style="padding:0 12px 16px 0;width:48px;"><img src="${img(`n${i + 1}.png`)}" width="44" height="44" alt="${i + 1}." style="display:block;border:0;width:44px;height:44px;"></td>
  <td valign="top" style="padding:10px 0 16px;font-family:${FONT};font-size:16px;line-height:23px;color:${C.night};">${f(esc(s.chat), esc(a.handle))}</td>
</tr>`).join('');

  const channel = m.channelUrl ? `<table ${T} style="background:${C.night};margin:8px 0 30px;"><tr><td style="padding:22px 22px 16px;">
  <p style="margin:0 0 6px;${LABEL}font-size:12px;color:${C.pink};">${esc(r.channel.title)}</p>
  <p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:23px;color:${C.ice};">${esc(r.channel.body)}</p>
  ${button(m.channelUrl, r.channel.cta)}
</td></tr></table>` : '';

  const top = `<a href="${m.site}/camp"><img src="${img('hero.jpg')}" width="560" alt="BAS CAMP Italy, 23–27 December 2026. See you on the mountain. Application in." style="display:block;border:0;width:100%;max-width:560px;height:auto;"></a>`;
  const inner = `<table ${T}><tr><td style="padding:22px 30px 6px;" class="px">
  <h1 class="h1" style="margin:0 0 18px;${COND}font-size:52px;line-height:48px;color:${C.night};">${esc(r.hi)} <span style="background:${C.pink};padding:0 8px;">${esc(s.first)}!</span> 👋</h1>
  ${r.intro.map((x) => p(esc(x), 'font-size:17px;line-height:26px;')).join('')}
  ${ticket(r.cardTitle, list, r.cardStamp)}
  ${h2(r.nextTitle)}
  <table ${T} style="margin:0 0 8px;">${steps}</table>
  ${box(`${r.payTitle} · ${camp.price}`, r.pay)}
  ${small(esc(r.payNote), 'margin-bottom:26px;')}
  ${p(esc(r.levels))}
  ${channel}
  ${p(`${esc(r.programme)} <a href="${m.programme}" style="color:${C.red};font-weight:800;">${esc(r.programmeCta)} →</a>`)}
  ${p(esc(r.questions))}
  <p style="margin:26px 0 6px;${COND}font-size:34px;line-height:32px;color:${C.red};">${esc(r.bye)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr>
    <td valign="middle" style="padding-right:14px;"><img src="${img('ilia.jpg')}" width="68" height="68" alt="Ilia" style="display:block;border:3px solid ${C.night};border-radius:50%;width:68px;height:68px;"></td>
    <td valign="middle" style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.night};">
      <img src="${img('sign.png')}" width="150" height="75" alt="${esc(r.sign)}" style="display:block;border:0;width:150px;height:75px;margin:-6px 0 0 -6px;">
      <b>${esc(rider.name)}</b> · ${esc(r.signLine)}<br>
      <a href="${rider.instagramUrl}" style="color:${C.red};font-weight:800;text-decoration:none;">@${esc(rider.instagram)}</a>
    </td>
  </tr></table>
  ${small(`${esc(r.footer)} <a href="${m.site}/camp" style="color:${C.grey};">bascamp.world/camp</a>`, 'font-size:12px;line-height:18px;border-top:2px solid ' + C.night + ';padding-top:14px;margin-bottom:22px;')}
</td></tr></table>`;

  const text = [
    `${r.hi} ${s.first}! 👋`, '', ...r.intro, '',
    r.cardTitle.toUpperCase(), ...list.map(([k, v]) => `${k}: ${v}`),
    '', r.nextTitle.toUpperCase(), ...r.next.map((f, i) => `${i + 1}. ${f(s.chat, a.handle).replace(/<\/?b>/g, '')}`),
    '', `${r.payTitle.toUpperCase()} · ${camp.price}`, ...r.pay.map(([k, v]) => `${k}: ${v}`), r.payNote,
    '', r.levels,
    ...(m.channelUrl ? ['', `${r.channel.body} ${m.channelUrl}`] : []),
    '', `${r.programme} ${m.programme}`, '', r.questions, '', r.bye, r.sign,
    `${rider.name} · @${rider.instagram}`,
  ].join('\n');

  return { subject: r.subject(s.first), html: frame(r.preheader, top, inner), text };
}

// ---------------------------------------------------------------- to Ilia
export function iliaMail(a: Application, at = new Date()): Mail {
  const r = m.ilia, s = shown(a);
  const dm = m.dm.text(s.first, a.discipline, s.level);
  const open = chatUrl(a.chat, a.handle, dm);
  const when = at.toLocaleString('ru-RU', { timeZone: 'Europe/Vienna', dateStyle: 'medium', timeStyle: 'short' });
  const list: Row[] = [
    [r.rows.name, a.name],
    [r.rows.email, a.email, `<a href="mailto:${esc(a.email)}" style="color:${C.red};">${esc(a.email)}</a>`],
    [r.rows.chat, `${s.chat} ${a.handle}`, `${esc(s.chat)} · <a href="${esc(chatUrl(a.chat, a.handle))}" style="color:${C.red};font-weight:800;">${esc(a.handle)}</a>`],
    [r.rows.discipline, a.discipline],
    [r.rows.level, s.level],
  ];
  if (a.msg) list.push([r.rows.msg, a.msg]);
  if (a.promo) list.push([r.rows.promo, a.promo]);
  list.push([r.rows.at, when]);

  const top = `<img src="${img('strip.png')}" width="560" alt="BAS CAMP Italy · new rider" style="display:block;border:0;width:100%;max-width:560px;height:auto;">`;
  // Archivo has no Cyrillic: the Russian headings use the bold sans
  const inner = `<table ${T}><tr><td style="padding:22px 28px 8px;" class="px">
  <h1 style="margin:0 0 18px;font-family:${FONT};font-weight:900;font-size:28px;line-height:32px;text-transform:uppercase;color:${C.night};">${esc(r.title)}<br><span style="background:${C.pink};padding:0 6px;">${esc(a.name)}</span></h1>
  ${ticket(camp.full, list)}
  ${button(open, r.open[a.chat])}
  ${small(esc(r.openNote[a.chat]), 'margin-bottom:24px;')}
  <h2 style="margin:0 0 6px;font-family:${FONT};font-weight:900;font-size:20px;line-height:24px;text-transform:uppercase;color:${C.night};"><span style="border-bottom:4px solid ${C.red};">${esc(r.readyTitle)}</span></h2>
  ${small(esc(r.readyNote), 'margin:12px 0 10px;')}
  <table ${T} style="margin:0 0 22px;"><tr>
    <td style="background:#ffffff;border:2px dashed ${C.night};border-left:6px solid ${C.red};padding:16px 18px;font-family:${FONT};font-size:15px;line-height:22px;color:${C.night};">${nl2br(dm)}</td>
  </tr></table>
  ${small(esc(r.reply(s.first)), 'margin-bottom:22px;')}
</td></tr></table>`;

  const text = [
    r.title, '', ...list.map(([k, v]) => `${k}: ${v}`),
    '', `${r.open[a.chat]} ${open}`, '', `${r.readyTitle}:`, dm, '', r.reply(s.first),
  ].join('\n');

  return { subject: r.subject(a.name, a.discipline, s.level), html: frame(r.preheader(s.chat, a.handle), top, inner), text };
}
