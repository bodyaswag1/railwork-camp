// Database-level checks for phases 2-5 (achievements, booking, camps, community), straight through the
// Supabase API as a coach and two riders. Opt-in, because it writes to the live database (and cleans up after):
//   MEMBERS_E2E=1 npx playwright test tests/members-api.spec.ts --workers=1
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { randomBytes } from 'node:crypto';
import '../scripts/members/env.mjs';

const E = process.env;
test.skip(!E.MEMBERS_E2E, 'set MEMBERS_E2E=1 to run against the live database');
test.describe.configure({ mode: 'serial' });

const TAG = 'APITEST';
const people = {
  coach: { email: 'api.coach.test@example.com', first: 'Cole' },
  a: { email: 'api.rider.a.test@example.com', first: 'Ada' },
  b: { email: 'api.rider.b.test@example.com', first: 'Ben' },
};
const admin = createClient(E.SUPABASE_URL!, E.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const sql = postgres(E.POSTGRES_URL_NON_POOLING!, { ssl: 'require', max: 1, onnotice: () => {} });
const c: Record<keyof typeof people, SupabaseClient> = {} as never;
const rid: Record<string, string> = {};
const day = 864e5;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
/** a local (Europe/Vienna) wall-clock timestamp string, n days from now at hh:00 */
const localAt = (days: number, hh = 10) => {
  const d = new Date(Date.now() + days * day);
  return `${d.toISOString().slice(0, 10)} ${String(hh).padStart(2, '0')}:00:00`;
};

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
  const emails = Object.values(people).map((p) => p.email);
  await sql`delete from public.sessions where title like ${TAG + '%'}`;
  await sql`delete from public.camps where slug like 'apitest-%'`;
  // the camp trigger writes a feed item that outlives the camp
  await sql`delete from public.feed_items where kind = 'camp' and payload->>'title' like ${TAG + '%'}`;
  for (const u of data.users.filter((u) => emails.includes(u.email ?? ''))) await admin.auth.admin.deleteUser(u.id);
}

test.beforeAll(async () => {
  await cleanup();
  for (const [k, p] of Object.entries(people) as [keyof typeof people, (typeof people)['a']][]) {
    const password = randomBytes(18).toString('base64url');
    const { error } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true,
      user_metadata: { first_name: p.first, last_name: 'Test', phone: '+43 676 1111111', consent: true, adult: true } });
    expect(error).toBeNull();
    const client = createClient(E.SUPABASE_URL!, E.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await client.auth.signInWithPassword({ email: p.email, password })).error).toBeNull();
    c[k] = client;
  }
  await sql`update public.profiles p set role = 'coach' from auth.users u where u.id = p.id and u.email = ${people.coach.email}`;
  rid.a = (await c.a.rpc('ensure_my_rider')).data;
  rid.b = (await c.b.rpc('ensure_my_rider')).data;
});
test.afterAll(async () => { await cleanup(); await sql.end(); });

test('onboarding needs disciplines and riding-since, then finishes', async () => {
  expect((await c.a.rpc('finish_onboarding')).data).toBe('disciplines');
  const uid = (await c.a.auth.getUser()).data.user!.id;
  const up = await c.a.from('profiles').update({ disciplines: ['snowboard'], stance: 'goofy', terrain: ['park'], favorite_trick: 'Backside 180',
    favorite_brand: 'Burton', gear: '157 Pro Model', home_resort: 'Livigno', goals: 'First 360' }).eq('id', uid);
  expect(up.error).toBeNull();
  expect((await c.a.rpc('finish_onboarding')).data).toBe('riding_since');
  await c.a.from('profiles').update({ riding_since: 2019 }).eq('id', uid);
  expect((await c.a.rpc('finish_onboarding')).data).toBe('ok');
  expect((await c.a.from('profiles').update({ disciplines: ['surf'] }).eq('id', uid)).error).not.toBeNull(); // off the list
  const row = (await c.coach.from('coach_riders').select('favorite_trick, riding_since').eq('id', rid.a).single()).data;
  expect(row).toEqual({ favorite_trick: 'Backside 180', riding_since: 2019 });
});

test('trick book: rider marks working, only a coach marks landed', async () => {
  const trick = (await c.a.from('tricks').select('id').eq('slug', 'bs-180').single()).data!.id;
  expect((await c.a.rpc('set_trick_working', { p_trick: trick, p_on: true })).data).toBe('ok');
  expect((await c.a.from('trick_progress').insert({ rider_id: rid.a, trick_id: trick, status: 'landed' })).error).not.toBeNull();
  expect((await c.a.rpc('confirm_trick', { p_rider: rid.a, p_trick: trick })).error).not.toBeNull();
  expect((await c.coach.rpc('confirm_trick', { p_rider: rid.a, p_trick: trick })).error).toBeNull();
  expect((await c.a.rpc('set_trick_working', { p_trick: trick, p_on: false })).data).toBe('landed');
  const tp = (await c.a.from('trick_progress').select('status, confirmed_by').single()).data!;
  expect(tp.status).toBe('landed');
  expect((await c.b.from('trick_progress').select('*')).data).toHaveLength(0);   // B cannot see A's book
});

test('focus areas: coach writes, rider reads, nobody else', async () => {
  const id = (await c.coach.rpc('add_focus', { p_rider: rid.a, p_text: 'Keep shoulders closed on the backside 180 takeoff' })).data;
  expect(id).toBeTruthy();
  expect((await c.a.rpc('add_focus', { p_rider: rid.a, p_text: 'I am great' })).error).not.toBeNull();
  expect((await c.a.from('focus_areas').select('text')).data).toHaveLength(1);
  expect((await c.b.from('focus_areas').select('text')).data).toHaveLength(0);
  await c.coach.rpc('set_focus_status', { p_focus: id, p_status: 'nailed' });
  expect((await c.a.from('focus_areas').select('status').single()).data!.status).toBe('nailed');
});

let tramp1 = '', tramp2 = '', personalSoon = '';
test('booking: level gate, capacity, duplicates, 48 h rule', async () => {
  const v = (await c.coach.from('venues').insert({ name: `${TAG} Jump Hall`, kind: 'trampoline' }).select('id').single()).data!.id;
  expect((await c.a.from('venues').insert({ name: 'Sneaky', kind: 'resort' })).error).not.toBeNull();
  const pub = async (title: string, start: string, cap: number, extra: Record<string, unknown> = {}) =>
    (await c.coach.rpc('publish_sessions', { p_kind: 'trampoline', p_title: title, p_venue: v, p_start: start, p_minutes: 90, p_capacity: cap, p_price: 30, ...extra })).data;
  expect(await pub(`${TAG} tramp weekly`, localAt(7, 18), 1, { p_level_min: 3, p_weeks: 4 })).toBe(4);
  expect(await pub(`${TAG} tramp other`, localAt(8, 18), 5)).toBe(1);
  await c.coach.rpc('publish_sessions', { p_kind: 'personal', p_title: `${TAG} personal soon`, p_venue: null, p_start: localAt(1, 10), p_minutes: 120, p_capacity: 1, p_price: 200 });
  const list = (await c.a.rpc('open_sessions')).data as { id: string; title: string; starts_at: string; seats_left: number; my_status: string | null }[];
  const weekly = list.filter((s) => s.title === `${TAG} tramp weekly`).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  expect(weekly).toHaveLength(4);
  tramp1 = weekly[0].id;
  tramp2 = list.find((s) => s.title === `${TAG} tramp other`)!.id;
  personalSoon = list.find((s) => s.title === `${TAG} personal soon`)!.id;
  // the weekly sessions are exactly 7 days apart at the same local time
  expect(new Date(weekly[1].starts_at).getTime() - new Date(weekly[0].starts_at).getTime()).toBe(7 * day);

  expect((await c.a.rpc('book_session', { p_session: tramp1 })).data.status).toBe('need_level');
  await c.a.rpc('set_self_level', { p_band: 1 });
  expect((await c.a.rpc('book_session', { p_session: tramp1 })).data.status).toBe('level_too_low');
  await c.a.rpc('set_self_level', { p_band: 2 });                                   // one below: allowed
  const ok = (await c.a.rpc('book_session', { p_session: tramp1 })).data;
  expect(ok.status).toBe('ok');
  expect((await c.a.rpc('book_session', { p_session: tramp1 })).data.status).toBe('already');
  await c.b.rpc('set_self_level', { p_band: 4 });
  expect((await c.b.rpc('book_session', { p_session: tramp1 })).data.status).toBe('full');
  const seen = ((await c.b.rpc('open_sessions')).data as { id: string; seats_left: number; my_status: string | null }[]).find((s) => s.id === tramp1)!;
  expect(seen).toMatchObject({ seats_left: 0, my_status: null });

  const soon = (await c.a.rpc('book_session', { p_session: personalSoon })).data;
  expect(soon.status).toBe('ok');
  expect((await c.a.rpc('cancel_booking', { p_booking: soon.booking })).data).toBe('too_late');
  expect((await c.b.rpc('cancel_booking', { p_booking: ok.booking })).data).toBe('not_found');   // not B's
  expect((await c.a.rpc('cancel_booking', { p_booking: ok.booking })).data).toBe('ok');
  expect((await c.b.rpc('book_session', { p_session: tramp1 })).data.status).toBe('ok');         // seat freed
  expect((await c.a.from('bookings').insert({ session_id: tramp2, rider_id: rid.a })).error).not.toBeNull();
});

test('packs and moving a booking', async () => {
  const pack = (await c.coach.rpc('grant_pack', { p_rider: rid.a, p_kind: 'trampoline', p_total: 2, p_price: 50, p_paid: true })).data;
  const b = (await c.a.rpc('book_session', { p_session: tramp2 })).data;
  expect(b).toMatchObject({ status: 'ok', pack });
  expect((await c.a.from('packs').select('sessions_used').single()).data!.sessions_used).toBe(1);
  // move to week 2 of the weekly slot (has seats): new taken first, old released, same pack credit
  const sessions = ((await c.a.rpc('open_sessions')).data as { id: string; title: string; starts_at: string }[])
    .filter((s) => s.title === `${TAG} tramp weekly`).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const moved = (await c.a.rpc('move_booking', { p_booking: b.booking, p_session: sessions[1].id })).data;
  expect(moved).toMatchObject({ status: 'ok', pack });
  expect((await c.a.from('bookings').select('status').eq('id', b.booking).single()).data!.status).toBe('cancelled');
  expect((await c.a.from('packs').select('sessions_used').single()).data!.sessions_used).toBe(1);
  expect((await c.a.rpc('cancel_booking', { p_booking: moved.booking })).data).toBe('ok');
  expect((await c.a.from('packs').select('sessions_used').single()).data!.sessions_used).toBe(0);
});

test('weekly loop: request, coach approves, nightly books ahead, a trip frees the spot', async () => {
  const mine = (await c.b.from('bookings').select('id').eq('session_id', tramp1).single()).data!;
  expect((await c.b.rpc('request_loop', { p_booking: mine.id })).data).toBe('ok');
  expect((await c.b.rpc('request_loop', { p_booking: mine.id })).data).toBe('already');
  const loop = (await c.b.from('loops').select('id, status, weekday').single()).data!;
  expect(loop.status).toBe('requested');
  expect((await c.b.rpc('decide_loop', { p_loop: loop.id, p_approve: true })).error).not.toBeNull();
  await c.coach.rpc('decide_loop', { p_loop: loop.id, p_approve: true });
  await sql`select public.nightly_loops()`;
  const booked = (await c.b.from('bookings').select('source, status, sessions(title, starts_at)').eq('source', 'loop')).data!;
  expect(booked.length).toBeGreaterThanOrEqual(2);                                   // weeks 2-4 of the slot within 28 days
  // a trip over week 2 cancels that one
  const wk2 = (booked.map((x) => (x.sessions as unknown as { starts_at: string }).starts_at).sort())[0];
  const d = wk2.slice(0, 10);
  expect((await c.b.from('absences').insert({ rider_id: rid.b, from_date: d, to_date: d, note: 'Trip' })).error).toBeNull();
  expect((await c.a.from('absences').insert({ rider_id: rid.b, from_date: d, to_date: d })).error).not.toBeNull();
  await sql`select public.nightly_loops()`;
  const after = (await c.b.from('bookings').select('status, sessions(starts_at)').eq('source', 'loop')).data!;
  expect(after.find((x) => (x.sessions as unknown as { starts_at: string }).starts_at === wk2)!.status).toBe('cancelled');
});

test('attendance → stats, streak, badges', async () => {
  // four past weekly sessions, attended (inserted directly: you cannot book the past)
  const ids: string[] = [];
  for (const w of [21, 14, 7, 1]) {
    const [s] = await sql`insert into public.sessions (kind, title, starts_at, ends_at, capacity)
      values ('trampoline', ${TAG + ' past'}, now() - make_interval(days => ${w}), now() - make_interval(days => ${w}) + interval '90 minutes', 5) returning id`;
    const [b] = await sql`insert into public.bookings (session_id, rider_id, source) values (${s.id}, ${rid.a}, 'coach') returning id`;
    ids.push(b.id);
  }
  for (const id of ids) expect((await c.coach.rpc('mark_attendance', { p_booking: id, p_status: 'attended' })).error).toBeNull();
  expect((await c.a.rpc('mark_attendance', { p_booking: ids[0], p_status: 'no_show' })).error).not.toBeNull();
  await c.coach.rpc('mark_paid', { p_booking: ids[0], p_paid: true });

  const st = (await c.a.rpc('rider_stats')).data;
  expect(st.sessions).toBe(4);
  expect(st.minutes).toBe(360);
  expect(st.longest_streak_weeks).toBeGreaterThanOrEqual(3);                          // 21/14/7/1 days back spans 3-4 ISO weeks
  expect(st.milestones.map((m: { label: string }) => m.label)).toContain('1 sessions');
  expect((await c.b.rpc('rider_stats', { p_rider: rid.a })).error).not.toBeNull();     // not B's to read
  expect((await c.coach.rpc('rider_stats', { p_rider: rid.a })).data.sessions).toBe(4);

  expect((await c.a.rpc('run_badges')).error).not.toBeNull();
  await c.coach.rpc('run_badges');
  const badges = ((await c.a.from('badge_awards').select('badge_key')).data ?? []).map((x) => x.badge_key).sort();
  expect(badges).toEqual(expect.arrayContaining(['first_session', 'first_trampoline', 'first_trick']));
});

test('camps: apply, accept, crew is private to the camp, no over-filling', async () => {
  const list = (await c.a.rpc('camp_list')).data as { slug: string; spots_left: number }[];
  expect(list.find((x) => x.slug === 'italy-2026')).toBeTruthy();
  const camp = (await c.coach.from('camps').insert({ slug: 'apitest-camp', title: `${TAG} camp`, place: 'Testland', starts_on: iso(30 * day).slice(0, 10),
    ends_on: iso(33 * day).slice(0, 10), spots: 1, price_eur: 999, deposit_eur: 250 }).select('id').single()).data!.id;
  expect((await c.a.rpc('apply_camp', { p_camp: camp, p_note: 'Goofy, park', p_promo: 'BAS10' })).data).toBe('ok');
  expect((await c.a.rpc('apply_camp', { p_camp: camp })).data).toBe('already');
  expect((await c.b.rpc('apply_camp', { p_camp: camp })).data).toBe('ok');
  const entries = (await c.coach.from('camp_entries').select('id, rider_id').eq('camp_id', camp)).data!;
  const ea = entries.find((e) => e.rider_id === rid.a)!.id;
  const eb = entries.find((e) => e.rider_id === rid.b)!.id;
  expect((await c.a.rpc('set_camp_entry', { p_entry: ea, p_status: 'accepted' })).error).not.toBeNull();
  expect((await c.coach.rpc('set_camp_entry', { p_entry: ea, p_status: 'accepted' })).data).toBe('ok');
  expect((await c.coach.rpc('set_camp_entry', { p_entry: eb, p_status: 'accepted' })).data).toBe('full_waitlisted');
  expect((await c.a.rpc('camp_crew', { p_camp: camp })).data.some((x: { rider_id: string }) => x.rider_id === rid.a)).toBe(true);
  expect((await c.b.rpc('camp_crew', { p_camp: camp })).data).toHaveLength(0);       // waitlisted: not in the crew space
  await c.coach.rpc('set_camp_entry', { p_entry: ea, p_status: 'deposit_paid' });
  expect((await c.a.rpc('withdraw_camp', { p_entry: ea })).data).toBe('paid');
  expect((await c.b.rpc('withdraw_camp', { p_entry: eb })).data).toBe('ok');
});

test('community: invisible until listed, feed hides retroactively, contacts after a mutual yes', async () => {
  const uidA = (await c.a.auth.getUser()).data.user!.id;
  const uidB = (await c.b.auth.getUser()).data.user!.id;
  const dir0 = (await c.b.rpc('community_directory')).data as { rider_id: string }[];
  expect(dir0.some((x) => x.rider_id === rid.a)).toBe(false);
  expect((await c.b.from('profiles').select('id').eq('id', uidA)).data).toHaveLength(0);   // no peeking at the table

  await c.a.from('profiles').update({ listed: true, ask_to_ride: true }).eq('id', uidA);
  const dir1 = (await c.b.rpc('community_directory', { p_discipline: 'snowboard' })).data as { rider_id: string; name: string }[];
  expect(dir1.find((x) => x.rider_id === rid.a)?.name).toBe('Ada T.');
  await c.coach.rpc('verify_level', { p_rider: rid.a, p_band: 3 });
  const feed = (await c.b.rpc('community_feed')).data as { kind: string; rider_id: string }[];
  expect(feed.filter((f) => f.rider_id === rid.a).map((f) => f.kind)).toEqual(expect.arrayContaining(['joined', 'level', 'trick']));
  const card = (await c.b.rpc('rider_card', { p_rider: rid.a })).data;
  expect(card.tricks).toContain('Backside 180');

  // ride together
  expect((await c.a.rpc('post_ride', { p_place: 'Livigno Mottolino', p_date: iso(3 * day).slice(0, 10), p_note: 'Park laps' })).data).toBe('ok');
  const post = ((await c.b.rpc('ride_board')).data as { id: string; rider_id: string; can_ask: boolean }[]).find((p) => p.rider_id === rid.a)!;
  expect(post.can_ask).toBe(true);
  expect((await c.b.rpc('ask_to_ride', { p_post: post.id })).data).toBe('not_listed');      // must be visible to ask
  await c.b.from('profiles').update({ listed: true }).eq('id', uidB);
  expect((await c.b.rpc('ask_to_ride', { p_post: post.id, p_message: 'Same level, keen!' })).data).toBe('ok');
  expect((await c.b.rpc('my_ride_contacts')).data).toHaveLength(0);                          // nothing until A says yes
  const req = ((await c.a.rpc('my_ride_requests')).data as { id: string }[])[0];
  expect((await c.b.rpc('respond_ride_request', { p_request: req.id, p_accept: true })).data).toBe('not_found');
  expect((await c.a.rpc('respond_ride_request', { p_request: req.id, p_accept: true })).data).toBe('ok');
  expect(((await c.b.rpc('my_ride_contacts')).data as { email: string }[])[0].email).toBe(people.a.email);
  expect(((await c.a.rpc('my_ride_contacts')).data as { email: string }[])[0].email).toBe(people.b.email);

  // unlisting hides A everywhere, history included
  await c.a.from('profiles').update({ listed: false }).eq('id', uidA);
  expect(((await c.b.rpc('community_feed')).data as { rider_id: string }[]).some((f) => f.rider_id === rid.a)).toBe(false);
  expect(((await c.b.rpc('community_directory')).data as { rider_id: string }[]).some((x) => x.rider_id === rid.a)).toBe(false);
  expect((await c.b.rpc('rider_card', { p_rider: rid.a })).data).toBeNull();
  expect(((await c.b.rpc('ride_board')).data as { rider_id: string }[]).some((p) => p.rider_id === rid.a)).toBe(false);
  // highlights answer without error
  expect((await c.b.rpc('community_highlights')).error).toBeNull();
});

test('the nightly job runs end to end', async () => {
  const [r] = await sql`select public.nightly() as out`;
  expect(r.out).toHaveProperty('badges');
  const [job] = await sql`select schedule from cron.job where jobname = 'bas-nightly'`;
  expect(job.schedule).toBe('15 2 * * *');
});
