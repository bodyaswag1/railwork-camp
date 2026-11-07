// The lower half of a rider's card on /coach: their answers, numbers, focus areas, trick book, packs.
// The "two minutes after a session" routine: nail what they got, add one focus, mark a trick landed.
import { sb } from './sb';
import { esc, fmtDate, toast } from './ui';
import { DISCIPLINE, KIND, TERRAIN, euro, hours } from './labels';

type Row = Record<string, unknown> & { id: string; profile_id: string | null };

export async function paintMore(el: HTMLElement, r: Row) {
  const [{ data: st }, { data: focus }, { data: tricks }, { data: tp }, { data: packs }, { data: awards }] = await Promise.all([
    sb.rpc('rider_stats', { p_rider: r.id }),
    sb.from('focus_areas').select('*').eq('rider_id', r.id).order('created_at', { ascending: false }),
    sb.from('tricks').select('id, name, category').eq('active', true).order('category').order('sort'),
    sb.from('trick_progress').select('*').eq('rider_id', r.id),
    sb.from('packs').select('*').eq('rider_id', r.id).order('created_at', { ascending: false }),
    sb.from('badge_awards').select('badge_key, badges(title)').eq('rider_id', r.id),
  ]);
  const ans: [string, unknown][] = [
    ['Rides', ((r.disciplines as string[]) ?? []).map((d) => DISCIPLINE[d]).join(' + ')], ['Since', r.riding_since], ['Stance', r.stance],
    ['Likes', ((r.terrain as string[]) ?? []).map((t) => TERRAIN[t]).join(', ')], ['Favourite trick', r.favorite_trick],
    ['Home resort', r.home_resort], ['Brand', r.favorite_brand], ['Setup', r.gear], ['Wants to learn', r.goals], ['About', r.bio],
  ];
  const landed = new Map((tp ?? []).map((t) => [t.trick_id, t]));
  el.innerHTML = `
    <div class="card"><h3>Their answers</h3>${ans.some(([, v]) => v) ? `<dl class="facts">${ans.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
      : `<p class="small muted">${r.profile_id ? 'Not answered yet.' : 'They answer the questionnaire after claiming their profile.'}</p>`}</div>
    <div class="card"><h3>Numbers</h3><p class="small">${st ? `${st.sessions_total} sessions · ${hours(st.minutes)} h · streak ${st.streak_weeks} wk (longest ${st.longest_streak_weeks})` : '—'}</p>
      <p class="small">Badges: ${(awards ?? []).map((a) => esc((a.badges as unknown as { title: string }).title)).join(', ') || 'none yet'} <button class="link small" data-badges>refresh</button></p></div>
    <div class="card"><h3>Focus areas</h3>
      <p class="small muted">One line: the next thing to try, not a verdict. They read it on their progress page.</p>
      <ul style="padding-left:18px">${(focus ?? []).map((f) => `<li style="margin-bottom:6px;${f.status === 'nailed' ? 'text-decoration:line-through;color:var(--lift-tower)' : ''}">${esc(f.text)}
        ${f.status === 'open' ? `<button class="link small" data-nail="${f.id}">Nailed it</button>` : `<button class="link small" data-reopen="${f.id}">Reopen</button>`}
        <button class="link small" data-rmfocus="${f.id}">Remove</button></li>`).join('')}</ul>
      <form class="linkbox" data-addfocus><input type="text" name="text" maxlength="240" placeholder="Keep shoulders closed on the takeoff" /><button class="btn btn--small">Add</button></form></div>
    <div class="card"><h3>Trick book</h3>
      <p class="small muted">Working on: ${(tp ?? []).filter((t) => t.status === 'working').map((t) => esc((tricks ?? []).find((x) => x.id === t.trick_id)?.name)).join(', ') || '—'}</p>
      <form class="linkbox" data-landed><select name="trick">${(tricks ?? []).filter((t) => landed.get(t.id)?.status !== 'landed').map((t) => `<option value="${t.id}">${esc(t.category)} · ${esc(t.name)}</option>`).join('')}</select>
        <button class="btn btn--small">Mark landed</button></form>
      <p class="small" style="margin-top:8px">${(tp ?? []).filter((t) => t.status === 'landed').map((t) => `<span class="chip chip--verified" style="margin:0 4px 4px 0">${esc((tricks ?? []).find((x) => x.id === t.trick_id)?.name)}
        <button class="link small" style="color:inherit" data-unland="${t.trick_id}" aria-label="Undo">×</button></span>`).join('')}</p></div>
    <div class="card"><h3>Packs</h3>
      ${(packs ?? []).map((p) => `<p class="small">${esc(KIND[p.kind])}: ${p.sessions_total - p.sessions_used}/${p.sessions_total} left${p.valid_until ? ` · until ${esc(p.valid_until)}` : ''} · ${p.paid_at ? 'paid' : `<button class="link small" data-packpaid="${p.id}">mark ${esc(euro(p.price_eur))} paid</button>`}</p>`).join('') || '<p class="small muted">No packs.</p>'}
      <form class="form" data-pack style="margin-top:8px"><div class="form__row form__row--2">
        <label class="field"><span>Kind</span><select name="kind"><option value="trampoline">Trampoline</option><option value="personal">Personal</option></select></label>
        <label class="field"><span>Sessions</span><input type="number" name="total" min="1" max="100" value="10" /></label></div>
        <div class="form__row form__row--2"><label class="field"><span>Price €</span><input type="number" name="price" min="0" step="1" /></label>
        <label class="field"><span>Valid until</span><input type="date" name="until" /></label></div>
        <label class="check"><input type="checkbox" name="paid" /> Already paid</label><button class="btn btn--small">Sell pack</button></form></div>`;

  const again = () => paintMore(el, r);
  el.onclick = async (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset ?? {};
    let res: { error: unknown } | null = null;
    if (d.nail) res = await sb.rpc('set_focus_status', { p_focus: d.nail, p_status: 'nailed' });
    else if (d.reopen) res = await sb.rpc('set_focus_status', { p_focus: d.reopen, p_status: 'open' });
    else if (d.rmfocus && confirm('Remove this line for good?')) res = await sb.rpc('remove_focus', { p_focus: d.rmfocus });
    else if (d.unland && confirm('Take this trick back to “working on it”?')) res = await sb.rpc('unconfirm_trick', { p_rider: r.id, p_trick: Number(d.unland) });
    else if (d.packpaid) res = await sb.rpc('mark_pack_paid', { p_pack: d.packpaid, p_paid: true });
    else if ('badges' in d) res = await sb.rpc('run_badges');
    if (res) { if (res.error) toast('That did not save.', 'bad'); again(); }
  };
  el.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const f = new FormData(form);
    let res;
    if ('addfocus' in form.dataset) {
      if (String(f.get('text')).trim().length < 3) return;
      res = await sb.rpc('add_focus', { p_rider: r.id, p_text: f.get('text') });
    } else if ('landed' in form.dataset) {
      res = await sb.rpc('confirm_trick', { p_rider: r.id, p_trick: Number(f.get('trick')) });
      if (!res.error) toast('Landed. It shows in their trick book (and the feed, if they are listed).');
    } else if ('pack' in form.dataset) {
      res = await sb.rpc('grant_pack', { p_rider: r.id, p_kind: f.get('kind'), p_total: Number(f.get('total')), p_valid_until: f.get('until') || null,
        p_price: f.get('price') ? Number(f.get('price')) : null, p_paid: f.get('paid') === 'on' });
    }
    if (res?.error) toast('That did not save.', 'bad');
    again();
  };
  void fmtDate;
}
