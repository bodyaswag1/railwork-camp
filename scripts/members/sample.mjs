// Sample crew for showing the rider area: `node scripts/members/sample.mjs seed|clear`.
//
// Makes a coach (Ilia) and three riders (Max, Timur, Ivan) with photos, eight weeks of past sessions
// (attendance, streaks, a trip, tricks signed off, badges), the crew feed, ride posts, and a full December up to
// BAS CAMP Italy (23-27 Dec): trampoline nights, weekly personal slots, a pre-camp air session, open slots.
//
// Everything hangs off accounts with emails sample.*@example.com, sessions coached by that sample Ilia and
// venues noted SAMPLE_NOTE, so `clear` removes exactly that and nothing else. `seed` clears first, so it can be
// re-run. The riders can sign in with SAMPLE_RIDER_PASSWORD from .env.local (made on first run) for a demo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { need } from './env.mjs';

need('SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'POSTGRES_URL_NON_POOLING');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1, onnotice: () => {} });
const mode = process.argv[2];
const SAMPLE_NOTE = 'BAS sample data';
const PHOTOS = path.resolve('scripts/members/sample');

// ------------------------------------------------------------------ time: wall-clock Vienna -> instant
const vienna = (day, hm = '12:00') => new Date(`${day}T${hm}:00${day < '2026-10-25' || day >= '2027-03-28' ? '+02:00' : '+01:00'}`);
const addMin = (d, m) => new Date(d.getTime() + m * 6e4);
const days = (from, to, isoDow) => {               // every date from..to (inclusive) on that ISO weekday
  const out = []; const d = new Date(`${from}T12:00:00Z`); const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) { if (((d.getUTCDay() + 6) % 7) + 1 === isoDow) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};

// ------------------------------------------------------------------ the people
const PEOPLE = {
  ilia: { email: 'sample.ilia@example.com', first: 'Ilia', last: 'Baskakov', role: 'coach', photo: 'ilia.jpg' },
  max: {
    email: 'sample.max@example.com', first: 'Max', last: 'Koval', photo: 'max.jpg', joined: '2026-09-14',
    profile: { disciplines: ['ski'], riding_since: 2014, terrain: ['park', 'piste'], favorite_trick: 'Frontside 360 safety',
      home_resort: 'Hintertux', favorite_brand: 'Armada', gear: 'Armada ARV 96, 172', goals: 'Clean 540s on the medium line before the camp.',
      bio: 'Skier in a snowboard crew. Rails first, then the kickers. Saturdays on the glacier with Ilia.', instagram: 'max.koval.ski', phone: '+43 660 000 0101' },
    rider: { sessions_before: 30, member_since: '2024-12-01', founding_at: '2026-09-14' },
  },
  timur: {
    email: 'sample.timur@example.com', first: 'Timur', last: 'Safin', photo: 'timur.jpg', joined: '2026-09-14',
    profile: { disciplines: ['snowboard'], riding_since: 2019, stance: 'goofy', terrain: ['park', 'freeride'], favorite_trick: 'Backside 180 off the side hit',
      home_resort: 'Hintertux', favorite_brand: 'Burton', gear: 'Burton Process 155', goals: 'Take the trampoline backflip to the airbag, then to snow.',
      bio: 'Trampoline twice a week, snow every weekend I can get. Ask me to ride park.', instagram: 'timur.rides', phone: '+43 660 000 0102' },
    rider: { sessions_before: 0, member_since: '2026-09-14' },
  },
  ivan: {
    email: 'sample.ivan@example.com', first: 'Ivan', last: 'Petrov', photo: 'ivan.jpg', joined: '2026-11-03',
    profile: { disciplines: ['snowboard'], riding_since: 2026, stance: 'regular', terrain: ['piste'], favorite_trick: null,
      home_resort: 'Hintertux', favorite_brand: null, gear: 'Rental for now', goals: 'Link turns on blue and come to Italy without falling every run.',
      bio: 'New to all of it. First day was 7 November.', instagram: null, phone: '+43 660 000 0103' },
    rider: { sessions_before: 0, member_since: '2026-11-03' },
  },
};

// ------------------------------------------------------------------ clear
async function clear() {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const users = list.users.filter((u) => /^sample\.[a-z]+@example\.com$/.test(u.email ?? ''));
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await sql`delete from feed_items where created_by in ${sql(ids)}`;
    await sql`delete from sessions where coach_id in ${sql(ids)} or created_by in ${sql(ids)}`;
    await sql`delete from riders where profile_id in ${sql(ids)}`;        // cascades bookings, badges, tricks, feed, posts, loops, camp entries
  }
  await sql`delete from venues v where v.notes = ${SAMPLE_NOTE} and not exists (select 1 from sessions s where s.venue_id = v.id)`;
  for (const u of users) {
    const { data: files } = await sb.storage.from('avatars').list(u.id);
    if (files?.length) await sb.storage.from('avatars').remove(files.map((f) => `${u.id}/${f.name}`));
    await sb.auth.admin.deleteUser(u.id);
  }
  console.log(`cleared ${users.length} sample accounts`);
}

if (mode === 'clear') { await clear(); await sql.end(); process.exit(0); }
if (mode !== 'seed') { console.log('usage: node scripts/members/sample.mjs seed|clear'); process.exit(1); }

await clear();

// leftovers from old API test runs that show up as venues nobody uses
await sql`delete from venues v where v.name like 'APITEST%' and not exists (select 1 from sessions s where s.venue_id = v.id)`;

// ------------------------------------------------------------------ password for demo sign-in (riders only)
const envFile = path.resolve('.env.local');
let password = process.env.SAMPLE_RIDER_PASSWORD;
if (!password) {
  password = `Bas-${crypto.randomBytes(9).toString('base64url')}`;
  fs.appendFileSync(envFile, `\n# sample riders (scripts/members/sample.mjs): sign in as sample.max@example.com etc.\nSAMPLE_RIDER_PASSWORD=${password}\n`);
}

// ------------------------------------------------------------------ accounts + photos
const id = {};      // profile ids
for (const [key, p] of Object.entries(PEOPLE)) {
  const { data, error } = await sb.auth.admin.createUser({
    email: p.email, email_confirm: true,
    password: p.role === 'coach' ? crypto.randomBytes(24).toString('base64url') : password,   // the coach cannot be signed into
    user_metadata: { first_name: p.first, last_name: p.last, consent: true, adult: true },
  });
  if (error) throw error;
  id[key] = data.user.id;
  const file = `${data.user.id}/avatar-sample.jpg`;
  const up = await sb.storage.from('avatars').upload(file, fs.readFileSync(path.join(PHOTOS, p.photo)), { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  p.photo_url = sb.storage.from('avatars').getPublicUrl(file).data.publicUrl;
}
const coach = id.ilia;

await sql.begin(async (tx) => {
  // ---------------------------------------------------------------- profiles + riders
  await tx`update profiles set role = 'coach', photo_url = ${PEOPLE.ilia.photo_url}, bio = 'Head coach. Trampoline nights, glacier days, BAS CAMP.' where id = ${coach}`;
  const rid = {};
  for (const key of ['max', 'timur', 'ivan']) {
    const p = PEOPLE[key]; const joined = vienna(p.joined, '19:00');
    await tx`update profiles set ${tx({ ...p.profile, photo_url: p.photo_url, onboarded_at: joined, listed: true, ask_to_ride: true, announced_at: joined, created_at: joined })}
             where id = ${id[key]}`;
    const [r] = await tx`insert into riders ${tx({ first_name: p.first, last_name: p.last, email: p.email, profile_id: id[key], coach_id: coach,
      sessions_before: p.rider.sessions_before, member_since: p.rider.member_since, founding_at: p.rider.founding_at ? vienna(p.rider.founding_at) : null,
      claimed_at: joined, created_at: joined })} returning id`;
    rid[key] = r.id;
  }

  // ---------------------------------------------------------------- venues
  const [hall] = await tx`insert into venues (name, kind, town, country, notes) values ('Jump hall Vienna', 'trampoline', 'Vienna', 'Austria', ${SAMPLE_NOTE}) returning id`;
  const [glacier] = await tx`insert into venues (name, kind, town, country, notes) values ('Hintertux Glacier', 'resort', 'Tux', 'Austria', ${SAMPLE_NOTE}) returning id`;

  // ---------------------------------------------------------------- sessions
  const S = {};     // 'YYYY-MM-DD HH:MM kind' -> session id
  const session = async (day, hm, kind, title, o = {}) => {
    const starts = vienna(day, hm);
    const [s] = await tx`insert into sessions ${tx({ kind, title, coach_id: coach, created_by: coach,
      venue_id: kind === 'trampoline' ? hall.id : glacier.id, starts_at: starts, ends_at: addMin(starts, o.minutes ?? (kind === 'trampoline' ? 90 : 120)),
      capacity: o.capacity ?? (kind === 'trampoline' ? 8 : 1), price_eur: o.price ?? (kind === 'trampoline' ? 35 : 100),
      level_min: o.level_min ?? null, notes: o.notes ?? null, loop_id: o.loop ?? null, created_at: addMin(starts, -14 * 24 * 60) })} returning id`;
    S[`${day} ${hm} ${kind}`] = s.id;
    return s.id;
  };
  const book = async (sessionId, who, status, o = {}) => {
    const at = o.at ?? new Date();
    await tx`insert into bookings ${tx({ session_id: sessionId, rider_id: rid[who], status, source: o.source ?? 'self', created_at: at,
      paid_at: status === 'paid' || status === 'attended' ? at : null, marked_by: status === 'attended' ? coach : null })}`;
  };

  // trampoline nights: Tuesdays (spins and grabs), Fridays (flips, from Turning up)
  const tue = days('2026-09-15', '2026-12-15', 2);
  const fri = days('2026-10-02', '2026-12-18', 5);
  for (const d of tue) await session(d, '18:00', 'trampoline', 'Trampoline: spins and grabs', { notes: 'Bring indoor shoes. Warm-up starts on the minute.' });
  for (const d of fri) await session(d, '18:00', 'trampoline', 'Trampoline: flips and landings', { level_min: 3, notes: 'Flips on the big bed with a spotter.' });
  await session('2026-12-17', '18:00', 'trampoline', 'Pre-camp air session', { minutes: 120, capacity: 10, price: 45, level_min: 3,
    notes: 'Last air session before Italy: the tricks you want to take to the Livigno kickers.' });

  // Max's weekly slot: Saturdays 10:00 on the glacier
  const [loop] = await tx`insert into loops ${tx({ rider_id: rid.max, coach_id: coach, kind: 'personal', weekday: 6, start_time: '10:00', minutes: 120,
    venue_id: glacier.id, title: 'Weekly personal: park', price_eur: 90, status: 'active', decided_by: coach, decided_at: vienna('2026-09-15'), created_at: vienna('2026-09-14', '20:00') })} returning id`;
  for (const d of days('2026-09-19', '2026-12-19', 6)) {
    const s = await session(d, '10:00', 'personal', 'Weekly personal: park', { loop: loop.id, price: 90 });
    const past = vienna(d, '10:00') < new Date();
    await book(s, 'max', past ? 'attended' : 'reserved', { source: 'loop', at: past ? vienna(d, '02:15') : new Date() });
  }

  // one-off personal sessions
  await session('2026-11-07', '13:00', 'personal', 'Personal: first day on snow');
  await session('2026-11-21', '13:00', 'personal', 'Personal: turns on blue');
  await session('2026-12-19', '13:00', 'personal', 'Personal: turns and first ollies');
  await session('2026-12-21', '10:00', 'personal', 'Personal: kicker line before Italy');
  for (const [d, hm] of [['2026-11-15', '10:00'], ['2026-11-29', '10:00'], ['2026-12-13', '10:00'], ['2026-12-16', '10:00'], ['2026-12-20', '10:00'], ['2026-12-22', '10:00']])
    await session(d, hm, 'personal', 'Personal session on the glacier', { notes: 'Open slot: any level, any goal. Two hours one-to-one with Ilia.' });

  // ---------------------------------------------------------------- attendance (past) and bookings (ahead)
  const T = (d) => S[`${d} 18:00 trampoline`];
  // Timur: every Tuesday except the Georgia trip week, three Fridays
  for (const d of ['2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20', '2026-11-03']) await book(T(d), 'timur', 'attended', { at: vienna(d, '09:00') });
  for (const d of ['2026-10-09', '2026-10-23', '2026-11-06']) await book(T(d), 'timur', 'attended', { at: vienna(d, '09:00') });
  await tx`insert into absences (rider_id, from_date, to_date, note, created_at) values (${rid.timur}, '2026-10-24', '2026-11-01', 'Trip to Georgia: Gudauri', ${vienna('2026-10-12')})`;
  // Max: Fridays on the bed between glacier Saturdays
  for (const d of ['2026-10-02', '2026-10-16', '2026-10-30', '2026-11-06']) await book(T(d), 'max', 'attended', { at: vienna(d, '09:00') });
  // Ivan: first ever session yesterday
  await book(S['2026-11-07 13:00 personal'], 'ivan', 'attended', { at: vienna('2026-11-04', '20:10') });

  const now = new Date();
  await book(T('2026-11-10'), 'timur', 'paid', { at: now });
  await book(T('2026-11-10'), 'ivan', 'reserved', { at: now });
  await book(T('2026-11-13'), 'timur', 'reserved', { at: now });
  await book(T('2026-11-13'), 'max', 'reserved', { at: now });
  await book(S['2026-11-21 13:00 personal'], 'ivan', 'reserved', { at: now });
  await book(T('2026-12-15'), 'timur', 'paid', { at: now });
  await book(T('2026-12-15'), 'ivan', 'reserved', { at: now });
  await book(S['2026-12-17 18:00 trampoline'], 'timur', 'paid', { at: now });
  await book(S['2026-12-17 18:00 trampoline'], 'max', 'paid', { at: now });
  await book(T('2026-12-18'), 'timur', 'reserved', { at: now });
  await book(T('2026-12-18'), 'max', 'reserved', { at: now });
  await book(S['2026-12-19 13:00 personal'], 'ivan', 'reserved', { at: now });
  await book(S['2026-12-21 10:00 personal'], 'timur', 'paid', { at: now });

  await tx`insert into packs (rider_id, kind, sessions_total, sessions_used, valid_until, price_eur, paid_at, created_by, created_at)
           values (${rid.timur}, 'trampoline', 10, 3, '2027-03-31', 300, ${vienna('2026-11-03', '17:45')}, ${coach}, ${vienna('2026-11-03', '17:45')})`;

  // ---------------------------------------------------------------- camp: BAS CAMP Italy, 23-27 December
  const [camp] = await tx`select id from camps where slug = 'italy-2026'`;
  if (camp) {
    for (const [who, status, d, note] of [['max', 'deposit_paid', '2026-10-03', 'Sharing a room with Timur if possible.'],
                                          ['timur', 'paid', '2026-10-02', null], ['ivan', 'accepted', '2026-11-05', 'First camp, first season.']])
      await tx`insert into camp_entries (camp_id, rider_id, status, note, created_at, decided_at, decided_by)
               values (${camp.id}, ${rid[who]}, ${status}, ${note}, ${vienna(d, '21:00')}, ${vienna(d, '23:00')}, ${coach})`;
  }

  // ---------------------------------------------------------------- levels (the trigger writes the feed item at verified_at)
  const tid = Object.fromEntries((await tx`select id, slug from tricks`).map((t) => [t.slug, t.id]));
  await tx`insert into rider_levels (rider_id, self_band, self_at, band, verified_by, verified_at) values
    (${rid.max}, 5, ${vienna('2026-09-14', '19:00')}, 5, ${coach}, ${vienna('2026-09-19', '12:30')}),
    (${rid.timur}, 4, ${vienna('2026-09-14', '19:10')}, 5, ${coach}, ${vienna('2026-09-29', '19:45')}),
    (${rid.ivan}, 2, ${vienna('2026-11-03', '19:05')}, null, null, null)`;
  await tx`update rider_levels set band = 6, verified_by = ${coach}, verified_at = ${vienna('2026-11-07', '12:20')} where rider_id = ${rid.max}`;
  await tx`update rider_levels set band = 3, verified_by = ${coach}, verified_at = ${vienna('2026-11-07', '15:20')} where rider_id = ${rid.ivan}`;

  // ---------------------------------------------------------------- trick book
  const landed = async (who, slug, day, hm) => tx`insert into trick_progress (rider_id, trick_id, status, landed_at, confirmed_by, updated_at)
    values (${rid[who]}, ${tid[slug]}, 'landed', ${vienna(day, hm)}, ${coach}, ${vienna(day, hm)})`;
  const working = async (who, slug) => tx`insert into trick_progress (rider_id, trick_id, status, updated_at) values (${rid[who]}, ${tid[slug]}, 'working', ${vienna('2026-11-07')})`;
  await landed('max', 'grab-safety', '2026-09-26', '11:40');
  await landed('max', 'rail-5050', '2026-10-10', '11:15');
  await landed('max', 'grab-mute', '2026-10-17', '11:50');
  await landed('max', '270-on', '2026-10-31', '11:30');
  await landed('max', 'fs-360', '2026-11-07', '11:45');
  await working('max', '540');
  await landed('timur', 'tramp-straight', '2026-09-22', '19:10');
  await landed('timur', 'tramp-360', '2026-10-20', '19:20');
  await landed('timur', 'tramp-backflip', '2026-11-06', '19:15');
  await working('timur', 'tramp-frontflip');
  await working('timur', 'bs-360');
  await landed('ivan', 'linked-turns', '2026-11-07', '14:40');
  await working('ivan', 'ollie');

  // ---------------------------------------------------------------- coach notes
  for (const [who, text, status, d] of [
    ['max', 'Keep the shoulders closed on the 360 take-off.', 'nailed', '2026-10-17'],
    ['max', 'Pop off the lip, not before it: the 540 needs the height.', 'open', '2026-11-07'],
    ['timur', 'Spot the bed early on the backflip, then open.', 'nailed', '2026-10-20'],
    ['timur', 'Same set and arms on the frontflip as on the backflip.', 'open', '2026-11-06'],
    ['ivan', 'Weight on the front foot when the board points downhill.', 'open', '2026-11-07'],
  ]) await tx`insert into focus_areas (rider_id, coach_id, text, status, created_at, closed_at)
              values (${rid[who]}, ${coach}, ${text}, ${status}, ${vienna(d, '12:00')}, ${status === 'nailed' ? vienna('2026-11-07', '12:00') : null})`;

  // ---------------------------------------------------------------- badges (the trigger writes the feed item at awarded_at)
  for (const [who, key, d, hm] of [
    ['max', 'founding_rider', '2026-09-14', '19:00'], ['max', 'first_session', '2026-09-19', '12:10'], ['max', 'ten_sessions', '2026-09-19', '12:11'],
    ['max', 'first_trick', '2026-09-26', '12:00'], ['max', 'first_trampoline', '2026-10-02', '19:40'], ['max', 'streak_4w', '2026-10-10', '12:10'],
    ['max', 'five_tricks', '2026-11-07', '11:50'],
    ['timur', 'first_session', '2026-09-15', '19:40'], ['timur', 'first_trampoline', '2026-09-15', '19:41'], ['timur', 'first_trick', '2026-09-22', '19:15'],
    ['timur', 'streak_4w', '2026-10-06', '19:40'], ['timur', 'ten_sessions', '2026-11-06', '19:40'],
    ['ivan', 'first_session', '2026-11-07', '15:10'], ['ivan', 'first_trick', '2026-11-07', '15:11'],
  ]) await tx`insert into badge_awards (rider_id, badge_key, awarded_at) values (${rid[who]}, ${key}, ${vienna(d, hm)})`;

  // ---------------------------------------------------------------- feed: joins + BAS posts
  for (const [who, d, band, disc] of [['max', '2026-09-14', 5, ['ski']], ['timur', '2026-09-14', 4, ['snowboard']], ['ivan', '2026-11-03', 2, ['snowboard']]])
    await tx`insert into feed_items (kind, rider_id, payload, created_at) values ('joined', ${rid[who]}, ${tx.json({ band, disciplines: disc })}, ${vienna(d, '19:30')})`;
  if (camp) await tx`insert into feed_items (kind, payload, created_by, created_at) values ('camp',
    ${tx.json({ camp: camp.id, title: 'BAS CAMP Italy 2026', place: 'Livigno, Italy', starts_on: '2026-12-23' })}, ${coach}, ${vienna('2026-10-01', '10:00')})`;
  for (const [d, text] of [
    ['2026-10-12', 'Trampoline Fridays are now flips and landings, from Turning level up. Tuesdays stay spins and grabs for everyone.'],
    ['2026-11-02', 'Trampoline nights run every Tuesday and Friday until the camp. The last one before Italy is the pre-camp air session on Thursday 17 December.'],
    ['2026-11-06', 'The glacier is open: personal sessions at Hintertux every weekend from now to Christmas. Open slots are on the Book page.'],
  ]) await tx`insert into feed_items (kind, payload, created_by, created_at) values ('event', ${tx.json({ text })}, ${coach}, ${vienna(d, '10:00')})`;

  // ---------------------------------------------------------------- ride together
  const [p1] = await tx`insert into ride_posts (rider_id, place, ride_date, note, created_at) values
    (${rid.timur}, 'Hintertux Glacier', '2026-11-15', 'Park laps all day. Happy to session the small kickers with anyone.', ${vienna('2026-11-06', '21:00')}) returning id`;
  const [p2] = await tx`insert into ride_posts (rider_id, place, ride_date, note, created_at) values
    (${rid.max}, 'Kaunertal', '2026-11-22', 'Driving from Innsbruck, two seats free. Rails in the morning, kickers after lunch.', ${vienna('2026-11-07', '18:00')}) returning id`;
  await tx`insert into ride_posts (rider_id, place, ride_date, note, created_at) values
    (${rid.ivan}, 'Hintertux Glacier', '2026-11-21', 'After my lesson, around 15:00. Blue runs, slow pace, I am new.', ${vienna('2026-11-07', '20:00')})`;
  await tx`insert into ride_requests (post_id, from_rider, message, created_at) values
    (${p2.id}, ${rid.ivan}, 'Could I get a lift? I will stay on the blue runs, no stress.', ${vienna('2026-11-07', '21:30')})`;
  await tx`insert into ride_requests (post_id, from_rider, message, status, created_at, responded_at) values
    (${p1.id}, ${rid.max}, 'In. Meet at the Sommerberg lift at 9?', 'accepted', ${vienna('2026-11-07', '08:00')}, ${vienna('2026-11-07', '09:10')})`;
});

console.log('seeded: coach Ilia, riders Max, Timur, Ivan (sample.*@example.com, password SAMPLE_RIDER_PASSWORD in .env.local)');
await sql.end();
