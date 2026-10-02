// /camp: grain textures + the apply form (validation, POST to PUBLIC_FORM_ENDPOINT, success state).
import { makeNoise } from './paper';
import { camp, campPage } from '../content/site';

const gL = makeNoise([16, 19, 20], 120, 11), gD = makeNoise([225, 239, 250], 90, 23);
document.querySelectorAll<HTMLElement>('[data-grain]').forEach((el) => { el.style.backgroundImage = `url(${el.dataset.grain === 'D' ? gD : gL})`; });

const t = campPage.apply;
const form = document.querySelector<HTMLFormElement>('[data-form]')!;
const sent = document.querySelector<HTMLElement>('[data-sent]')!;
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

form.addEventListener('input', () => { if (tried) validate(); });
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  tried = true; net.textContent = '';
  const e = validate();
  const first = Object.keys(e)[0];
  if (first) { form.querySelector<HTMLElement>(`#f-${first}`)?.focus(); return; }
  const d = new FormData(form);
  const body = { name: d.get('name'), method: method(), contact: d.get('contact'), level: d.get('level'), msg: d.get('msg'), camp: camp.full };
  submit.disabled = true; submit.textContent = t.sending;
  try {
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(String(res.status));
    } else {
      await new Promise((r) => setTimeout(r, 600)); // TODO: set PUBLIC_FORM_ENDPOINT
    }
    const firstName = String(body.name).trim().split(/\s+/)[0] || 'rider';
    sent.querySelector('[data-sent-line]')!.textContent = t.sent.line(firstName);
    sent.querySelector('[data-sent-reply]')!.textContent = t.sent.reply(method());
    form.hidden = true; sent.hidden = false; sent.focus();
  } catch {
    net.textContent = t.errors.network;
  } finally {
    submit.disabled = false; submit.textContent = t.submit;
  }
});

sent.querySelector('[data-again]')!.addEventListener('click', () => {
  form.reset(); tried = false; validate();
  form.querySelectorAll('.err').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
  sent.hidden = true; form.hidden = false;
  form.querySelector<HTMLElement>('#f-name')!.focus();
});
