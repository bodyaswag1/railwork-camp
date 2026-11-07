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
    // a group of checkboxes sharing a name comes back as a RadioNodeList: mark and focus its first box
    const named = form.elements.namedItem(el.dataset.errorFor!);
    const input = (named instanceof RadioNodeList ? named[0] : named) as HTMLInputElement | null;
    if (input instanceof Element) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
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
  toastTimer = window.setTimeout(() => el.classList.remove('is-on'), 3600);
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

/** paints an avatar element: the photo, or the first letter on the ice tint */
export function paintAvatar(el: HTMLElement, url: string | null | undefined, name: string | null | undefined) {
  el.style.backgroundImage = url ? `url("${url}")` : '';
  el.textContent = url ? '' : (name ?? '?').trim().slice(0, 1);
}

/** fills the shared shell: tabs and menu marked for this page, coach links for staff, the avatar, sign-out */
export function paintHeader(me: Me | null) {
  for (const el of $$('[data-staff-only]')) el.hidden = !isStaff(me);
  for (const el of $$('[data-signed-in]')) el.hidden = !me;
  for (const el of $$('[data-signed-out]')) el.hidden = !!me;
  const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  for (const a of $$<HTMLAnchorElement>('.toptabs a, .tabbar a, .menu a')) {
    const href = a.getAttribute('href') ?? '';
    const exact = a.hasAttribute('data-exact');
    // the coach tab covers every /coach page; the menu's Riders link only /coach itself
    const on = href === here || (!exact && href !== '/' && here.startsWith(href + '/'));
    if (on) a.setAttribute('aria-current', 'page');
  }
  if (me) {
    const name = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.email;
    for (const el of $$('[data-me-avatar]')) paintAvatar(el, me.photoUrl, me.firstName ?? me.email);
    for (const el of $$('[data-me-name]')) el.textContent = name;
    for (const el of $$('[data-me-email]')) el.textContent = me.email;
  }
  // the avatar menu closes on an outside click or Escape
  const menu = $<HTMLDetailsElement>('.menu');
  if (menu) {
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target as Node)) menu.open = false; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); } });
  }
  for (const b of $$('[data-signout]')) b.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.href = '/signin';
  });
}

/** a bottom sheet / dialog with a title bar and a close button; returns its body element */
export function sheet(id: string, title: string): { el: HTMLDialogElement; body: HTMLElement; open: () => void; close: () => void } {
  let el = document.getElementById(id) as HTMLDialogElement | null;
  if (!el) {
    el = document.createElement('dialog');
    el.id = id;
    el.className = 'sheet';
    el.innerHTML = `<div class="sheet__head"><h2></h2><button class="closebtn" type="button" aria-label="Close" data-close>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="sheet__body"></div>`;
    document.body.append(el);
    el.addEventListener('click', (e) => {
      if (e.target === el || (e.target as Element).closest('[data-close]')) el!.close();
    });
  }
  el.querySelector('h2')!.textContent = title;
  const d = el;
  return { el: d, body: d.querySelector('.sheet__body') as HTMLElement, open: () => d.showModal(), close: () => d.close() };
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
