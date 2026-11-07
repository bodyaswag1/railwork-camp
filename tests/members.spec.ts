// End-to-end check of the rider area against the real Supabase project, through the local server.
// It creates two test accounts (coach.test@ / rider.test@example.com, values in .env.local) and removes the
// previous run's first. Opt-in, because it writes to the live database:
//   npm run build && node scripts/members/dev.mjs 4330      (in another terminal)
//   MEMBERS_E2E=1 BASE_URL=http://localhost:4330 npx playwright test tests/members.spec.ts --workers=1
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../scripts/members/env.mjs';

const E = process.env;
test.skip(!E.MEMBERS_E2E, 'set MEMBERS_E2E=1 to run against the live database');
test.describe.configure({ mode: 'serial' });

const COACH = { first: 'Cora', last: 'Test', email: E.TEST_COACH_EMAIL!, password: E.TEST_COACH_PASSWORD! };
const RIDER = { first: 'Rita', last: 'Test', email: E.TEST_RIDER_EMAIL!, password: E.TEST_RIDER_PASSWORD! };
const NEW_PASSWORD = `${E.TEST_RIDER_PASSWORD}x2`;
const MAIL_DIR = E.MAIL_DROP_DIR ?? path.join(os.tmpdir(), 'bas-mail');

const admin = () => createClient(E.SUPABASE_URL!, E.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const db = () => postgres(E.POSTGRES_URL_NON_POOLING!, { ssl: 'require', max: 1 });

/** the link from the last mail sent to `to`, waiting for it to land */
async function mailLink(to: string, since: number): Promise<string> {
  const file = path.join(MAIL_DIR, `${to}.json`);
  await expect.poll(() => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0), { timeout: 15_000 }).toBeGreaterThan(since);
  const mail = JSON.parse(fs.readFileSync(file, 'utf8')) as { text: string };
  const url = mail.text.match(/https?:\/\/\S+\/auth\?\S+/)?.[0];
  if (!url) throw new Error(`no /auth link in mail to ${to}`);
  return url.replace(/^https?:\/\/[^/]+/, ''); // same server whatever origin it was built with
}

async function join(page: Page, who: typeof COACH, opts: { prefilled?: boolean } = {}) {
  if (opts.prefilled) await expect(page.getByLabel('First name')).toHaveValue(who.first);
  else await page.getByLabel('First name').fill(who.first);
  await page.getByLabel('Last name').fill(who.last);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByLabel('Phone').fill('+43 676 0000000');
  await page.getByLabel(/I agree/).check();
  await page.getByLabel(/18 or over/).check();
  const t = Date.now();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  return t;
}

test.beforeAll(async () => {
  const sb = admin();
  const { data } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of data.users.filter((u) => [COACH.email, RIDER.email].includes(u.email ?? ''))) await sb.auth.admin.deleteUser(u.id);
  const sql = db();
  await sql`delete from public.riders where first_name = ${RIDER.first} and last_name = ${RIDER.last} and profile_id is null`;
  await sql`delete from public.rate_hits`;
  await sql.end();
});

let inviteLink = '';

/** the questionnaire every new rider gets: required answers first, then a few optional ones */
async function welcome(page: Page, who: typeof COACH) {
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: /Done: open my profile/ }).click();
  await expect(page.getByText('Pick at least one.')).toBeVisible();              // required
  await page.getByRole('checkbox', { name: 'Snowboard' }).check();
  await page.getByLabel(/Riding since/).fill('2019');
  await page.getByLabel(/Stance/).selectOption('goofy');
  await page.getByRole('checkbox', { name: 'Park' }).check();
  await page.getByLabel('Favourite trick').fill('Backside 180');
  await page.getByLabel('Favourite brand').fill('Burton');
  await page.getByRole('button', { name: /Done: open my profile/ }).click();
  await expect(page.getByRole('heading', { name: `Hi ${who.first}` })).toBeVisible();
}

test('a coach signs up, confirms by email and gets the coach role', async ({ page }) => {
  await page.goto('/join');
  const t = await join(page, COACH);
  await page.goto(await mailLink(COACH.email, t));
  await welcome(page, COACH);
  await expect(page.getByRole('link', { name: 'Coach', exact: true })).toBeHidden();

  const sql = db();
  await sql`update public.profiles p set role = 'coach' from auth.users u where u.id = p.id and u.email = ${COACH.email}`;
  await sql.end();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Coach', exact: true })).toBeVisible();
});

test('the same email cannot sign up twice', async ({ page }) => {
  await page.goto('/join');
  await page.getByLabel('First name').fill('Dup');
  await page.getByLabel('Last name').fill('Licate');
  await page.getByLabel('Email').fill(COACH.email);
  await page.getByLabel('Password').fill(COACH.password);
  await page.getByLabel('Phone').fill('+43 676 0000000');
  await page.getByLabel(/I agree/).check();
  await page.getByLabel(/18 or over/).check();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByText('That email already has an account')).toBeVisible();
});

test('the coach adds a rider with a level and gets an invite link', async ({ page }) => {
  await page.goto('/signin?next=/coach');
  await page.locator('#signin-form').getByLabel('Email').fill(COACH.email);
  await page.locator('#signin-form').getByLabel('Password').fill(COACH.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Riders' })).toBeVisible();

  await page.getByRole('button', { name: '+ Add a rider' }).click();
  const form = page.locator('#add-form');
  await form.getByLabel('First name').fill(RIDER.first);
  await form.getByLabel('Last name').fill(RIDER.last);
  await form.getByLabel('Instagram').fill('@rita.rides');
  await form.getByLabel(/Level you have seen/).selectOption('4');
  await form.getByLabel(/Sessions together/).fill('12');
  await form.getByRole('button', { name: 'Add and make a link' }).click();

  await expect(page.locator('#r-name')).toHaveText(`${RIDER.first} ${RIDER.last}`);
  await expect(page.locator('#r-level')).toContainText('Cruising');
  inviteLink = await page.locator('#r-link').inputValue();
  expect(inviteLink).toMatch(/\/claim#t=[\w-]{30,}$/);
  await expect(page.locator('#roster')).toContainText('Link sent');
  await expect(page.locator('#roster')).not.toContainText(COACH.first); // coaches are not in their own roster

  // a second link replaces the first: the old one must stop working
  const old = inviteLink;
  await page.getByRole('button', { name: 'Make a new link' }).click();
  await expect(page.locator('#r-link')).not.toHaveValue(old);
  inviteLink = await page.locator('#r-link').inputValue();
  await page.goto(old.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByRole('heading', { name: 'This invite is no longer valid' })).toBeVisible();
});

test('the rider opens the invite, signs up, and their coach record comes with them', async ({ page }) => {
  await page.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByRole('heading', { name: `${RIDER.first}, your profile is ready` })).toBeVisible();
  await expect(page.locator('#ok-facts')).toContainText('Cruising');
  await expect(page.locator('#ok-facts')).toContainText('12');
  await expect(page.locator('#ok-facts')).toContainText(COACH.first);
  expect(page.url()).not.toContain('#t='); // token taken out of the address bar

  await page.getByRole('button', { name: 'Claim my profile' }).click();
  await expect(page).toHaveURL(/\/join$/);
  const t = await join(page, RIDER, { prefilled: true });
  await expect(page.locator('#sent-claim')).toContainText('attached');

  await page.goto(await mailLink(RIDER.email, t));
  await welcome(page, RIDER);

  // the profile: the coach's verified level, the founding stamp, the coach; no level picker
  await page.goto('/me/profile');
  await expect(page.locator('#chips .chip--verified')).toContainText('Cruising');
  await expect(page.locator('#chips .stamp')).toHaveText('Founding rider');
  await expect(page.locator('#idline')).toContainText(COACH.first);
  await expect(page.locator('#level-note')).toContainText('Your coach confirmed this');
  await expect(page.locator('#level-edit')).toBeHidden();
  await page.locator('#photo-input').setInputFiles('public/apple-touch-icon.png');
  await expect(page.locator('#toast')).toHaveText('Photo saved.');
  await expect(page.locator('#avatar')).toHaveCSS('background-image', /avatars\/.+\.webp/);
  await page.getByRole('button', { name: 'Edit details' }).click();
  await page.locator('#details-form').getByLabel('A line about you').fill('Chasing my first backside 360.');
  await page.locator('#details-form').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#toast')).toHaveText('Saved.');

  // riders never see the coach panel
  await page.goto('/coach');
  await expect(page).toHaveURL(/\/me$/);
});

test('a used invite cannot be claimed again', async ({ page }) => {
  await page.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByRole('heading', { name: /already (used|connected)/ })).toBeVisible();
});

async function signIn(page: Page, email: string, password: string, next = '/me') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.locator('#signin-form').getByLabel('Email').fill(email);
  await page.locator('#signin-form').getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('booking, weekly slot, progress, community and camps through the pages', async ({ browser }) => {
  const errors: string[] = [];
  const coach = await browser.newPage();
  const rider = await browser.newPage();
  for (const p of [coach, rider]) p.on('pageerror', (e) => errors.push(e.message));

  // coach publishes a trampoline session 5 days out
  await signIn(coach, COACH.email, COACH.password, '/coach/schedule');
  await expect(coach.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  await expect(coach.locator('#sessions')).not.toBeEmpty(); // the page script is ready
  const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const pub = coach.locator('#pub');
  await pub.getByLabel('Title').fill('E2E trampoline');
  await pub.getByLabel(/Start/).fill(`${d}T18:00`);
  await pub.getByLabel('Places').fill('4');
  await pub.getByLabel(/Price/).fill('30');
  await pub.getByRole('button', { name: 'Publish' }).click();
  await expect(coach.locator('#toast')).toContainText('Published 1 session');
  await expect(coach.locator('#sessions')).toContainText('E2E trampoline');

  // rider books it, asks for it weekly
  await signIn(rider, RIDER.email, RIDER.password, `/book?kind=trampoline&day=${d}`);
  const row = rider.locator('#slots li', { hasText: 'E2E trampoline' });
  await row.getByRole('button', { name: 'Reserve' }).click();
  await rider.locator('#do-book').click();
  await expect(rider.getByRole('heading', { name: 'You are booked' })).toBeVisible();
  await rider.keyboard.press('Escape');
  await expect(row).toContainText('You are booked');
  await rider.goto('/me/sessions');
  const mine = rider.locator('#upcoming li', { hasText: 'E2E trampoline' });
  await mine.getByRole('button', { name: 'Every week' }).click();
  await expect(rider.locator('#loops')).toContainText('Waiting for your coach');

  // coach approves, marks attended
  await coach.reload();
  await coach.locator('#inbox').getByRole('button', { name: 'Approve' }).click();
  await expect(coach.locator('#inbox-wrap')).toBeHidden();
  const s = coach.locator('#sessions .card', { hasText: 'E2E trampoline' });
  await expect(s).toContainText(RIDER.first);
  await s.getByRole('button', { name: 'Attended' }).click();
  await expect(s).toContainText('Attended');

  // rider: progress counts it (12 before the app + 1), ticks a trick
  await rider.goto('/me/progress');
  await expect(rider.locator('[data-fig=sessions] b')).toHaveText('13');
  await rider.getByRole('checkbox', { name: 'Ollie', exact: true }).check();
  await expect(rider.locator('#tricks')).toContainText('Working on it');

  // coach marks it landed from the rider card
  await coach.goto('/coach');
  await coach.locator('#roster button', { hasText: RIDER.first }).click();
  const landed = coach.locator('form[data-landed]');
  await landed.locator('select').selectOption({ label: 'basics · Ollie' });
  await landed.getByRole('button', { name: 'Mark landed' }).click();
  await expect(coach.locator('#r-more')).toContainText('Ollie');

  // rider: community opt-in, directory, feed, ride post
  await rider.goto('/community');
  await rider.getByRole('button', { name: 'Show me in the crew' }).click();
  await expect(rider.locator('#riders')).toContainText(`${RIDER.first} T.`);
  await rider.getByRole('tab', { name: 'Around the crew' }).click();
  await expect(rider.locator('#feed')).toContainText('landed a Ollie');
  await rider.getByRole('tab', { name: 'Ride together' }).click();
  await rider.getByRole('button', { name: 'Post a ride' }).click();
  await rider.locator('#post-form').getByLabel('Where').fill('Livigno, Mottolino park');
  await rider.locator('#post-form').getByLabel('When').fill(d);
  await rider.locator('#post-form').getByRole('button', { name: 'Post' }).click();
  await expect(rider.locator('#board')).toContainText('Mottolino');

  // rider applies for the camp; coach sees the application
  await rider.goto('/camps');
  const camp = rider.locator('section', { hasText: 'BAS CAMP Italy 2026' });
  await camp.getByRole('button', { name: 'Apply for this camp' }).click();
  await rider.locator('#apply-form').getByLabel(/Anything Ilia should know/).fill('E2E test application, please ignore');
  await rider.locator('#apply-form').getByRole('button', { name: 'Send application' }).click();
  await expect(camp).toContainText('Applied');
  await coach.goto('/coach/camps');
  await expect(coach.locator('#camps')).toContainText('E2E test application');

  expect(errors).toEqual([]);
  await coach.close();
  await rider.close();
});

test.afterAll(async () => {
  // keep the live data clean: the camp application, the session and the ride post made above
  const sql = db();
  await sql`delete from public.camp_entries e using public.riders r join auth.users u on u.id = r.profile_id
            where e.rider_id = r.id and u.email in (${COACH.email}, ${RIDER.email})`;
  await sql`delete from public.sessions where title like 'E2E%'`;
  await sql`delete from public.ride_posts p using public.riders r join auth.users u on u.id = r.profile_id
            where p.rider_id = r.id and u.email = ${RIDER.email}`;
  await sql`update public.profiles p set listed = false, ask_to_ride = false from auth.users u where u.id = p.id and u.email = ${RIDER.email}`;
  await sql.end();
});

test('row-level security holds for a signed-in rider', async () => {
  const sb = createClient(E.SUPABASE_URL!, E.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error: signInError } = await sb.auth.signInWithPassword({ email: RIDER.email, password: RIDER.password });
  expect(signInError).toBeNull();

  const riders = await sb.from('riders').select('first_name');
  expect(riders.data?.map((r) => r.first_name)).toEqual([RIDER.first]);       // only their own row
  const roster = await sb.from('coach_riders').select('id');
  expect(roster.data).toHaveLength(1);
  const invites = await sb.from('invites').select('id');
  expect(invites.data).toHaveLength(0);
  const audit = await sb.from('audit_log').select('id');
  expect(audit.data).toHaveLength(0);

  const promote = await sb.from('profiles').update({ role: 'admin' }).eq('id', (await sb.auth.getUser()).data.user!.id);
  expect(promote.error).not.toBeNull();                                         // role is not theirs to change
  expect((await sb.rpc('mint_invite', { p_rider: riders.data ? '00000000-0000-0000-0000-000000000000' : '' })).error).not.toBeNull();
  const mine = (await sb.from('my_rider').select('id').single()).data!;
  expect((await sb.rpc('verify_level', { p_rider: mine.id, p_band: 7 })).error).not.toBeNull();
  expect((await sb.rpc('create_rider', { p_first_name: 'Sneaky' })).error).not.toBeNull();
  expect(await sb.rpc('set_self_level', { p_band: 7 })).toMatchObject({ data: 'coach_verified' });

  const anon = createClient(E.SUPABASE_URL!, E.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  expect((await anon.from('profiles').select('id')).data ?? []).toHaveLength(0);
  expect((await anon.rpc('claim_invite_for', { p_token: 'x'.repeat(32), p_user: mine.id })).error).not.toBeNull();
});

test('forgot password: the reset link sets a new one', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.locator('#forgot-form').getByLabel('Email').fill(RIDER.email);
  const t = Date.now();
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page.locator('#forgot-sent')).toBeVisible();
  await page.goto(await mailLink(RIDER.email, t));
  await expect(page.getByRole('heading', { name: 'New password' })).toBeVisible();
  await page.getByLabel('New password').fill(NEW_PASSWORD);
  await page.getByLabel('Repeat it').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/me$/);

  // and the new password signs in
  await page.goto('/me/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/signin/);
  await page.locator("#signin-form").getByLabel("Email").fill(RIDER.email);
  await page.locator("#signin-form").getByLabel("Password").fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: `Hi ${RIDER.first}` })).toBeVisible();
});

test('wrong password and unknown email read the same', async ({ page }) => {
  for (const [email, password] of [[RIDER.email, 'definitely-wrong-1'], ['nobody.test@example.com', 'definitely-wrong-1']]) {
    await page.goto('/signin');
    await page.locator("#signin-form").getByLabel("Email").fill(email);
    await page.locator("#signin-form").getByLabel("Password").fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#signin-error')).toHaveText('That email and password do not match an account.');
  }
});
