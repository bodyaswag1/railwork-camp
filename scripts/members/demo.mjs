// Demo data for looking at the rider screens: `node scripts/members/demo.mjs seed|clear`.
// Everything it makes is titled "E2E demo" (sessions) or noted "E2E demo" (trips), on the TEST_RIDER_EMAIL account,
// so the e2e cleanup and `clear` both remove it. Never run against riders who are not test accounts.
import './env.mjs';
import { need } from './env.mjs';
import { createClient } from '@supabase/supabase-js';
need('SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'TEST_RIDER_EMAIL');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const mode = process.argv[2];

const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
const rider = users.users.find((u) => u.email === process.env.TEST_RIDER_EMAIL);
const { data: r } = await sb.from('riders').select('id').eq('profile_id', rider.id).single();
const { data: coach } = await sb.from('profiles').select('id').in('role', ['coach', 'admin']).limit(1).single();
const { data: venue } = await sb.from('venues').select('id').limit(1).single();

async function clear() {
  const { data: ss } = await sb.from('sessions').select('id').like('title', 'E2E demo%');
  if (ss?.length) await sb.from('sessions').delete().in('id', ss.map((s) => s.id));
  await sb.from('absences').delete().eq('rider_id', r.id).like('note', 'E2E demo%');
  await sb.from('loops').delete().eq('rider_id', r.id).like('title', 'E2E demo%');
  console.log('cleared', ss?.length ?? 0, 'sessions');
}
if (mode === 'clear') { await clear(); process.exit(0); }

await clear();
const day = (offset, h, m = 0) => { const d = new Date(); d.setUTCHours(h - 1, m, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
const mk = async (offset, h, kind, minutes, booked, status = 'reserved', title) => {
  const starts = day(offset, h);
  const { data: s, error } = await sb.from('sessions').insert({
    kind, title: title ?? (kind === 'trampoline' ? 'E2E demo · Trampoline: spins and grabs' : 'E2E demo · Personal on the slope'),
    coach_id: coach.id, venue_id: venue.id, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + minutes * 6e4).toISOString(),
    capacity: kind === 'trampoline' ? 8 : 1, price_eur: kind === 'trampoline' ? 35 : 100, created_by: coach.id,
  }).select('id').single();
  if (error) throw error;
  if (booked) await sb.from('bookings').insert({ session_id: s.id, rider_id: r.id, status, source: 'self' });
};
// past weeks: rode in 6 of the last 9 weeks, a trip in one
for (const [w, kind] of [[-63, 'trampoline'], [-56, 'trampoline'], [-42, 'personal'], [-35, 'trampoline'], [-14, 'trampoline'], [-7, 'personal']]) await mk(w, 18, kind, kind === 'trampoline' ? 90 : 120, true, 'attended');
await sb.from('absences').insert({ rider_id: r.id, from_date: day(-28, 12).toISOString().slice(0, 10), to_date: day(-22, 12).toISOString().slice(0, 10), note: 'E2E demo · Trip to Georgia' });
// this week and next: two booked, several open
await mk(1, 18, 'trampoline', 90, true);
await mk(3, 10, 'personal', 120, true);
await mk(2, 18, 'trampoline', 90, false);
await mk(4, 17, 'trampoline', 90, false);
await mk(5, 10, 'personal', 120, false);
await mk(8, 18, 'trampoline', 90, false);
await mk(10, 10, 'personal', 120, false);
await mk(15, 18, 'trampoline', 90, false);
console.log('seeded demo for', process.env.TEST_RIDER_EMAIL);
