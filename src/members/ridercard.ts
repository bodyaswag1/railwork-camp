// A rider's crew card in a sheet: the same card other riders see in the crew, used both for them and for
// "see your card" on your own profile. Data comes from rider_card(), which only answers for listed riders,
// yourself, or staff.
import { esc, paintAvatar, sheet } from './ui';
import { DISCIPLINE, TERRAIN } from './labels';
import { levelName } from '../lib/members/rules';
import { sb } from './sb';

export const levelPill = (band: number | null, verified?: boolean) => band
  ? (verified === false ? `<span class="chip">${esc(levelName(band))} <small>· self-rated</small></span>` : `<span class="chip chip--verified">${esc(levelName(band))}</span>`) : '';

export const avatarHtml = (photo: string | null, name: string, cls = 'avatar--sm') => {
  const s = document.createElement('span');
  s.className = `avatar ${cls}`;
  paintAvatar(s, photo, name);
  return s.outerHTML;
};

export async function openRiderCard(riderId: string, opts: { own?: { listed: boolean } } = {}) {
  const { data: c } = await sb.rpc('rider_card', { p_rider: riderId });
  if (!c) return;
  const sh = sheet('rider', opts.own ? 'Your crew card' : c.name);
  const facts = [['Riding since', c.riding_since], ['Home resort', c.home_resort], ['Likes', (c.terrain ?? []).map((t: string) => TERRAIN[t]).join(', ')],
    ['Favourite trick', c.favorite_trick], ['Favourite brand', c.favorite_brand]].filter(([, v]) => v);
  sh.body.innerHTML = `${opts.own ? `<p class="small ${opts.own.listed ? '' : 'faint'}" style="margin-bottom:16px">${opts.own.listed
      ? 'This is what riders in the crew see when they tap you.'
      : 'Nobody but your coach sees this yet. <a href="/community">Join the crew</a> to show it.'}</p>` : ''}
    <div class="who" style="margin-bottom:16px">${avatarHtml(c.photo_url, c.name, '')}<div><b>${esc(c.name)}</b><div class="actions" style="margin-top:6px">${levelPill(c.band, c.verified)}</div>
      <p class="small faint" style="margin-top:6px">${esc((c.disciplines ?? []).map((x: string) => DISCIPLINE[x]).join(' + '))}</p></div></div>
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
    ${c.bio ? `<p style="margin-top:12px">${esc(c.bio)}</p>` : ''}
    ${c.badges.length ? `<h3 style="margin:16px 0 8px">Badges</h3><div class="actions">${c.badges.map((b: { title: string }) => `<span class="pill pill--accent">${esc(b.title)}</span>`).join('')}</div>` : ''}
    ${c.tricks.length ? `<h3 style="margin:16px 0 8px">Tricks landed</h3><p class="small">${c.tricks.map(esc).join(', ')}</p>` : ''}
    ${opts.own && !location.pathname.startsWith('/me/profile') ? '<div class="actions" style="margin-top:20px"><a class="btn btn--small btn--ghost" href="/me/profile">Edit on your profile</a></div>' : ''}`;
  sh.open();
}
