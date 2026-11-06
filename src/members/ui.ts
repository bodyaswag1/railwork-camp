// Small DOM helpers for the rider-area pages. No framework: each page is a static shell plus one script.
import { configured, isStaff, loadMe, sb, type Me } from './sb';

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function show(el: Element | null, on = true) {
  if (el) (el as HTMLElement).hidden = !on;
}

/** shows exactly one of the [data-state] blocks inside root */
export function state(name: string, root: ParentNode = document) {
  for (const el of $$('[data-state]', root)) el.hidden = el.dataset.state !== name;
}

/** puts messages under the matching inputs (by name) and focuses the first; returns true when there were any */
export function fieldErrors(form: HTMLFormElement, errors: Record<string, string | undefined>) {
  let first: HTMLElement | null = null;
  for (const el of $$('[data-error-for]', form)) {
    const msg = errors[el.dataset.errorFor!];
    el.textContent = msg ?? '';
    el.hidden = !msg;
    const input = form.elements.namedItem(el.dataset.errorFor!) as HTMLInputElement | null;
    input?.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && !first) first = input;
  }
  first?.focus();
  return Boolean(first);
}

export function busy(btn: HTMLButtonElement | null, on: boolean, label?: string) {
  if (!btn) return;
  if (on) {
    btn.dataset.label ??= btn.textContent ?? '';
    btn.textContent = label ?? 'One moment…';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.label ?? btn.textContent;
    btn.disabled = false;
  }
}

let toastTimer = 0;
export function toast(msg: string, tone: 'ok' | 'bad' = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.dataset.tone = tone;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-on'), 3200);
}

export const nextParam = () => new URLSearchParams(location.search).get('next');

/**
 * Page guard: resolves with the signed-in person, or sends them to sign in and comes back afterwards.
 * `staff` pages send riders to their own home instead.
 */
export async function requireMe(opts: { staff?: boolean } = {}): Promise<Me> {
  if (!configured) {
    document.body.dataset.unconfigured = '';
    throw new Error('Supabase is not configured');
  }
  const me = await loadMe();
  if (!me) {
    location.replace(`/signin?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
    throw new Error('signed out');
  }
  if (opts.staff && !isStaff(me)) {
    location.replace('/me');
    throw new Error('not staff');
  }
  paintHeader(me);
  return me;
}

/** fills the shared app header: coach link for staff, sign-out */
export function paintHeader(me: Me | null) {
  for (const el of $$('[data-staff-only]')) el.hidden = !isStaff(me);
  for (const el of $$('[data-signed-in]')) el.hidden = !me;
  for (const el of $$('[data-signed-out]')) el.hidden = !!me;
  const here = location.pathname.replace(/\/$/, '');
  for (const a of $$<HTMLAnchorElement>('.appnav a')) {
    const href = a.getAttribute('href') ?? '';
    if (href === here || (href !== '/me' && here.startsWith(href))) a.setAttribute('aria-current', 'page');
  }
  $('[data-signout]')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.href = '/signin';
  });
}

export const fmtDate = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-GB', opts) : '';

/** POST JSON to one of our /api routes; never throws */
export async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
  } catch {
    return { status: 0, data: {} as T };
  }
}
