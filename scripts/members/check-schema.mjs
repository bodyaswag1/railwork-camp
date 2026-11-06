// Lists what migration 001 should have created, so a half-applied or older version shows up.
//   node scripts/members/check-schema.mjs
import postgres from 'postgres';
import { need } from './env.mjs';

need('POSTGRES_URL_NON_POOLING');
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1 });
try {
  const want = {
    tables: ['profiles', 'riders', 'rider_levels', 'invites', 'audit_log', 'rate_hits'],
    views: ['coach_riders', 'my_rider'],
    functions: ['is_staff', 'audit', 'rate_ok', 'auth_user_state', 'token_hash', 'handle_new_user', 'ensure_my_rider', 'set_self_level',
      'invite_preview', 'claim_invite_for', 'claim_invite', 'require_staff', 'create_rider', 'update_rider', 'verify_level', 'mint_invite', 'revoke_invite'],
  };
  const tables = (await sql`select table_name, table_type from information_schema.tables where table_schema = 'public'`);
  const fns = (await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`).map((r) => r.proname);
  const has = (n, type) => tables.some((t) => t.table_name === n && t.table_type === type);
  const missing = [
    ...want.tables.filter((t) => !has(t, 'BASE TABLE')).map((t) => `table ${t}`),
    ...want.views.filter((t) => !has(t, 'VIEW')).map((t) => `view ${t}`),
    ...want.functions.filter((f) => !fns.includes(f)).map((f) => `function ${f}`),
  ];
  const rls = await sql`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`;
  const noRls = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  const trig = await sql`select tgname from pg_trigger where tgname = 'on_auth_user_created'`;
  const bucket = await sql`select id, public from storage.buckets where id = 'avatars'`;
  const pol = await sql`select policyname from pg_policies where schemaname = 'storage' and policyname like 'avatars_%'`;
  const counts = await sql`select (select count(*) from public.profiles)::int profiles, (select count(*) from public.riders)::int riders,
                                  (select count(*) from public.invites)::int invites, (select count(*) from auth.users)::int users`;
  console.log('missing:', missing.length ? missing : 'nothing');
  console.log('tables without RLS:', noRls.length ? noRls : 'none');
  console.log('signup trigger:', trig.length ? 'yes' : 'NO', '· avatars bucket:', bucket[0] ? `yes (public=${bucket[0].public})` : 'NO', '· storage policies:', pol.length);
  console.log('rows:', counts[0]);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
