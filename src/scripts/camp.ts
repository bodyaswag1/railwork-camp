// /camp: grain textures + the apply form (validation, then either a POST to PUBLIC_FORM_ENDPOINT, or —
// with no form backend configured — the application written out for the rider to send Ilia as an
// Instagram DM; it never pretends to have sent anything).
import { makeNoise } from './paper';
import { camp, campPage } from '../content/site';

const gL = makeNoise([16, 19, 20], 120, 11), gD = makeNoise([225, 239, 250], 90, 23);
document.querySelectorAll<HTMLElement>('[data-grain]').forEach((el) => { el.style.backgroundImage = `url(${el.dataset.grain === 'D' ? gD : gL})`; });

const t = campPage.apply;
const form = document.querySelector<HTMLFormElement>('[data-form]')!;
const sent = document.querySelector<HTMLElement>('[data-sent]')!;
const handoff = document.querySelector<HTMLElement>('[data-handoff]')!;
const handoffMsg = handoff.querySelector<HTMLTextAreaElement>('[data-handoff-msg]')!;
const copyBtn = handoff.querySelector<HTMLButtonElement>('[data-handoff-copy]')!;
const net = form.querySelector<HTMLElement>('[data-net]')!;
const contact = form.querySelector<HTMLInputElement>('#f-contact')!;
const submit = form.querySelector<HTMLButtonElement>('.submit')!;
let tried = false;

const method = () => (new FormData(form).get('method') as keyof typeof t.placeholders) || 'Telegram';

form.querySelectorAll<HTMLInputElement>('input[name=method]').forEach((r) => r.addEventListener('change', () => {
  const m = method();
  contact.placeholder = t.placeholders[m];
  contact.setAttribute('aria-label', `${m} contact`);
  contact.type = m === 'Email' ? 'email' : m === 'WhatsApp' ? 'tel' : 'text';
  contact.autocomplete = m === 'Email' ? 'email' : m === 'WhatsApp' ? 'tel' : 'off';
  if (tried) validate();
}));

function errors() {
  const d = new FormData(form), e: Record<string, string> = {};
  if (!String(d.get('name') ?? '').trim()) e.name = t.errors.name;
  const c = String(d.get('contact') ?? '').trim(), m = method();
  if (!c) e.contact = t.errors.contact;
  else if (m === 'Email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) e.contact = t.errors.email;
  else if (m === 'WhatsApp' && !/^\+?[\d\s()-]{7,}$/.test(c)) e.contact = t.errors.phone;
  if (!d.get('level')) e.level = t.errors.level;
  return e;
}

function validate() {
  const e = errors();
  for (const k of ['name', 'contact', 'level']) {
    const input = form.querySelector<HTMLElement>(`#f-${k}`)!;
    input.setAttribute('aria-invalid', e[k] ? 'true' : 'false');
    form.querySelector<HTMLElement>(`#e-${k}`)!.textContent = e[k] ?? '';
  }
  return e;
}

const levelText = (v: string) => t.levels.find(([k]) => k === v)?.[1] ?? v;

form.addEventListener('input', () => { if (tried) validate(); });
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  tried = true; net.textContent = '';
  const e = validate();
  const first = Object.keys(e)[0];
  if (first) { form.querySelector<HTMLElement>(`#f-${first}`)?.focus(); return; }
  const d = new FormData(form);
  const body = {
    name: String(d.get('name') ?? '').trim(), discipline: String(d.get('discipline') ?? ''), method: method(),
    contact: String(d.get('contact') ?? '').trim(), level: String(d.get('level') ?? ''), msg: String(d.get('msg') ?? '').trim(), camp: camp.full,
  };
  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    // TODO(formEndpoint): no backend yet — hand the application over as a DM the rider sends themselves
    handoffMsg.value = [
      t.handoff.intro,
      `Name: ${body.name}`,
      `I ride: ${body.discipline}`,
      `Level: ${levelText(body.level)}`,
      `Contact: ${body.method} ${body.contact}`,
      body.msg ? `Message: ${body.msg}` : '',
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
    sent.querySelector('[data-sent-reply]')!.textContent = t.sent.reply(method());
    form.hidden = true; sent.hidden = false; sent.focus();
  } catch {
    net.textContent = t.errors.network;
  } finally {
    submit.disabled = false; submit.textContent = t.submit;
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
  form.reset(); tried = false; validate();
  form.querySelectorAll('.err').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
  copyBtn.textContent = `${t.handoff.copy} ↗`;
  sent.hidden = true; handoff.hidden = true; form.hidden = false;
  form.querySelector<HTMLElement>('#f-name')!.focus();
}));
