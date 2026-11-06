// Applies supabase/migrations/*.sql in name order, each once, each in its own transaction.
//   node scripts/members/migrate.mjs           apply what is new
//   node scripts/members/migrate.mjs --status  list applied / pending
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { need } from './env.mjs';

need('POSTGRES_URL_NON_POOLING');
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: 'require', max: 1, onnotice: () => {} });
const dir = path.resolve('supabase/migrations');

try {
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table public._migrations enable row level security`;
  const done = new Set((await sql`select name from public._migrations`).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  if (process.argv.includes('--status')) {
    for (const f of files) console.log(done.has(f) ? '  applied' : '  PENDING', f);
  } else {
    let n = 0;
    for (const f of files) {
      if (done.has(f)) continue;
      process.stdout.write(`applying ${f} … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(fs.readFileSync(path.join(dir, f), 'utf8'));
        await tx`insert into public._migrations (name) values (${f})`;
      });
      console.log('ok');
      n++;
    }
    console.log(n ? `${n} applied` : 'nothing to apply');
  }
} catch (e) {
  console.error('\nfailed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
