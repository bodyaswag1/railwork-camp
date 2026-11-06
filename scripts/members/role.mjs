// Give an existing account a role. The person signs up first (bascamp.world/join), then:
//   node scripts/members/role.mjs ilia@example.com coach
//   node scripts/members/role.mjs someone@example.com rider
//   node scripts/members/role.mjs --list            everyone who is a coach or admin
import postgres from 'postgres';
import { need } from './env.mjs';

need('POSTGRES_URL_NON_POOLING');
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1 });
const [email, role] = process.argv.slice(2);

try {
  if (email === '--list' || !email) {
    const rows = await sql`select u.email, p.first_name, p.role from public.profiles p join auth.users u on u.id = p.id
                           where p.role <> 'rider' order by p.role, u.email`;
    console.table(rows);
    if (!email) console.log('usage: node scripts/members/role.mjs <email> <rider|coach|admin>');
  } else {
    if (!['rider', 'coach', 'admin'].includes(role)) throw new Error('role must be rider, coach or admin');
    const rows = await sql`update public.profiles p set role = ${role} from auth.users u
                           where u.id = p.id and lower(u.email) = lower(${email}) returning p.id`;
    if (!rows.length) throw new Error(`no account for ${email}: they need to sign up first`);
    await sql`insert into public.audit_log (action, payload) values ('role.set', ${sql.json({ email, role })})`;
    console.log(`${email} is now ${role}`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
