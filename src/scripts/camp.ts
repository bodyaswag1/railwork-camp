// /camp: grain textures, marks that draw on as sections scroll in, the compact phone menu, the sticky ticket,
// student videos, and the application form. The form either POSTs to PUBLIC_FORM_ENDPOINT or — with no
// backend configured — writes the application out for the rider to send Ilia as an Instagram DM; it never
// pretends to have sent anything. A promo code is only ever collected: it is checked by PUBLIC_PROMO_ENDPOINT
// when there is one, otherwise by hand when the place is confirmed. No price logic lives in the page.
import { makeNoise } from './paper';
import { initCases } from './cases';
import { camp, campPage } from '../content/site';

const gL = makeNoise([16, 19, 20], 120, 11), gD = makeNoise([225, 239, 250], 90, 23);
document.querySelectorAll<HTMLElement>('[data-grain]').forEach((el) => { el.style.backgroundImage = `url(${el.dataset.grain === 'D' ? gD : gL})`; });

// ---------------------------------------------------------------- marks draw on as a section comes into view
// Each [data-pen] stroke is measured (in screen units when its stroke doesn't scale with a stretched viewBox),
// hidden behind one dash of its own length, and drawn when its section scrolls in; the dash is dropped after.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const penLength = (p: SVGGeometryElement) => {
  if (p.getAttribute('vector-effect') !== 'non-scaling-stroke') return p.getTotalLength();
  const m = p.getScreenCTM(), n = 48, total = p.getTotalLength();
  if (!m) return total;
  let len = 0, prev: DOMPoint | null = null;
  for (let i = 0; i <= n; i++) {
    const q = p.getPointAtLength((total * i) / n);
    const pt = new DOMPoint(q.x * m.a + q.y * m.c, q.x * m.b + q.y * m.d);
    if (prev) len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
};
document.querySelectorAll<SVGGeometryElement>('[data-pen]').forEach((p) => {
  if (!reduced) {
    const l = Math.ceil(penLength(p)) + 2;
    p.style.strokeDasharray = `${l} ${l + 4000}`;
    p.style.strokeDashoffset = String(l);
    p.addEventListener('transitionend', () => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }, { once: true });
  }
  p.setAttribute('data-pen-ready', '');
});
const reveal = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -18% 0px', threshold: 0.05 });
  reveal.forEach((el) => io.observe(el));
} else reveal.forEach((el) => el.classList.add('is-in'));

// ---------------------------------------------------------------- phone menu
const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
const setMenu = (open: boolean) => {
  if (!menu || !menuBtn) return;
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? campPage.close : campPage.menu;
};
menuBtn?.addEventListener('click', () => setMenu(!!menu?.hidden));
menu?.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) setMenu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); menuBtn?.focus(); } });

// ---------------------------------------------------------------- sticky ticket: after the poster, never over the form
const ticket = document.querySelector<HTMLElement>('[data-sticky]');
const hero = document.querySelector<HTMLElement>('[data-hero]');
const applySec = document.querySelector<HTMLElement>('[data-apply]');
if (ticket && hero && applySec && 'IntersectionObserver' in window) {
  let pastHero = false, atForm = false;
  const render = () => {
    const on = pastHero && !atForm;
    ticket.classList.toggle('is-on', on);
    ticket.inert = !on;
    if (on) ticket.removeAttribute('aria-hidden'); else ticket.setAttribute('aria-hidden', 'true');
  };
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; render(); }).observe(hero);
  new IntersectionObserver(([e]) => { atForm = e.isIntersecting; render(); }, { rootMargin: '0px 0px -10% 0px' }).observe(applySec);
  render();
}

// ---------------------------------------------------------------- student videos
const progress = document.querySelector<HTMLElement>('#progress');
if (progress) initCases(progress);

// ---------------------------------------------------------------- application
const t = campPage.apply;
const form = document.querySelector<HTMLFormElement>('[data-form]')!;
const sent = document.querySelector<HTMLElement>('[data-sent]')!;
const handoff = document.querySelector<HTMLElement>('[data-handoff]')!;
const handoffMsg = handoff.querySelector<HTMLTextAreaElement>('[data-handoff-msg]')!;
const copyBtn = handoff.querySelector<HTMLButtonElement>('[data-handoff-copy]')!;
const net = form.querySelector<HTMLElement>('[data-net]')!;
const submit = form.querySelector<HTMLButtonElement>('.submit')!;
const levelSet = form.querySelector<HTMLElement>('fieldset[aria-describedby="e-level"]')!;
const promoInput = form.querySelector<HTMLInputElement>('#f-promo')!;
const promoMsg = form.querySelector<HTMLElement>('[data-promo-msg]')!;
const promoBtn = form.querySelector<HTMLButtonElement>('[data-promo-apply]')!;
let tried = false;

function errors() {
  const d = new FormData(form), e: Record<string, string> = {};
  if (!String(d.get('name') ?? '').trim()) e.name = t.errors.name;
  const c = String(d.get('contact') ?? '').trim();
  if (c.length < 2) e.contact = t.errors.contact;
  else if (/^[^@\s]+@[^@\s]*$/.test(c) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) e.contact = t.errors.email; // looks like an email, but isn't one
  if (!d.get('level')) e.level = t.errors.level;
  return e;
}

function validate() {
  const e = errors();
  for (const k of ['name', 'contact']) {
    form.querySelector<HTMLElement>(`#f-${k}`)!.setAttribute('aria-invalid', e[k] ? 'true' : 'false');
    form.querySelector<HTMLElement>(`#e-${k}`)!.textContent = e[k] ?? '';
  }
  levelSet.setAttribute('aria-invalid', e.level ? 'true' : 'false');
  form.querySelector<HTMLElement>('#e-level')!.textContent = e.level ?? '';
  return e;
}

const levelText = (v: string) => t.levels.find(([k]) => k === v)?.[1] ?? v;
const promoCode = () => promoInput.value.trim().toUpperCase();

// "Apply" on a code: with a promo endpoint, it answers; without one, the code just rides along with the
// application. Either way the page never shows a price other than the public one.
promoBtn.addEventListener('click', async () => {
  const code = promoCode();
  promoMsg.textContent = '';
  if (!code) return;
  const endpoint = form.dataset.promoEndpoint;
  if (!endpoint) { promoMsg.textContent = t.promo.saved; return; }
  promoMsg.textContent = t.promo.checking;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code, camp: camp.full }) });
    const out = await res.json().catch(() => ({}));
    promoMsg.textContent = out.valid ? (typeof out.message === 'string' ? out.message : t.promo.saved) : t.promo.bad;
  } catch { promoMsg.textContent = t.promo.saved; }
});
promoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); promoBtn.click(); } });

form.addEventListener('input', () => { if (tried) validate(); });
form.addEventListener('change', () => { if (tried) validate(); });
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  tried = true; net.textContent = '';
  const e = validate();
  const first = Object.keys(e)[0];
  if (first) { (form.querySelector<HTMLElement>(first === 'level' ? 'input[name=level]' : `#f-${first}`))?.focus(); return; }
  const d = new FormData(form);
  const body = {
    name: String(d.get('name') ?? '').trim(), contact: String(d.get('contact') ?? '').trim(),
    discipline: String(d.get('discipline') ?? ''), level: String(d.get('level') ?? ''),
    msg: String(d.get('msg') ?? '').trim(), promo: promoCode(), camp: camp.full,
  };
  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    // TODO(formEndpoint): no backend yet — hand the application over as a DM the rider sends themselves
    handoffMsg.value = [
      t.handoff.intro,
      `Name: ${body.name}`,
      `Contact: ${body.contact}`,
      `Discipline: ${body.discipline}`,
      `Level: ${levelText(body.level)}`,
      body.msg ? `Message: ${body.msg}` : '',
      body.promo ? `Code: ${body.promo}` : '',
    ].filter(Boolean).join('\n');
    form.hidden = true; handoff.hidden = false; handoff.focus();
    return;
  }
  submit.disabled = true; submit.textContent = t.sending;
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(String(res.status));
    const firstName = body.name.split(/\s+/)[0] || 'rider';
    sent.querySelector('[data-sent-line]')!.textContent = t.sent.line(firstName);
    form.hidden = true; sent.hidden = false; sent.focus();
  } catch {
    net.textContent = t.errors.network;
  } finally {
    submit.disabled = false; submit.innerHTML = `${t.submit} <span aria-hidden="true">→</span>`;
  }
});

// all synchronous, inside the tap: the copy needs this page focused, and Safari only opens a new window
// while the tap still counts as a user gesture (an await in between loses it)
copyBtn.addEventListener('click', () => {
  const text = handoffMsg.value;
  try { navigator.clipboard.writeText(text).catch(() => {}); } catch { /* older browsers: the fallback below */ }
  handoffMsg.focus(); handoffMsg.setSelectionRange(0, text.length);
  try { document.execCommand('copy'); } catch { /* the text is selected: the rider can still copy it */ }
  copyBtn.textContent = t.handoff.copied;
  window.open(form.dataset.dm, '_blank', 'noopener');
});

document.querySelectorAll('[data-again]').forEach((b) => b.addEventListener('click', () => {
  form.reset(); tried = false;
  form.querySelectorAll('.err, [data-promo-msg]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
  copyBtn.textContent = `${t.handoff.copy} ↗`;
  sent.hidden = true; handoff.hidden = true; form.hidden = false;
  form.querySelector<HTMLElement>('#f-name')!.focus();
}));
