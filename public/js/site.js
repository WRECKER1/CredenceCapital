document.documentElement.classList.add('js');

// Mobile nav
const toggle = document.querySelector('.nav-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open);
  });
}

// Reveal on scroll + animate progress bars
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('.progress').forEach((p) => p.classList.add('in'));
    io.unobserve(e.target);
  });
}, { threshold: 0.12 }) : null;
document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
if (!io) document.querySelectorAll('.progress').forEach((p) => p.classList.add('in'));

// Pre-fill enquiry from ?tier= or ?event=
const params = new URLSearchParams(location.search);
const enquiry = document.getElementById('enquiry-form');
if (enquiry) {
  const tier = params.get('tier');
  const event = params.get('event');
  const select = enquiry.querySelector('select[name=interest]');
  if (select && tier) {
    const opt = [...select.options].find((o) => o.text === tier);
    if (opt) select.value = opt.text;
  }
  if (event) {
    if (select) select.value = 'A specific event';
    const msg = enquiry.querySelector('textarea[name=message]');
    if (msg && !msg.value) msg.value = `We're interested in sponsoring "${event}".`;
  }
}

// AJAX forms
// Static hosting (no server): forms open the visitor's email app instead.
const STATIC_EMAIL = document.body.hasAttribute('data-static') ? document.body.dataset.email : null;
const FIELD_LABELS = { name: 'Name', email: 'Email', phone: 'Phone', organisation: 'Organisation', designation: 'Designation', interest: 'Interested in', campaign: 'Campaign', amount: 'Pledge amount (₹)', message: 'Message' };
function sendByEmail(form, data) {
  const subjects = {
    sponsorship: `Sponsorship enquiry${data.organisation ? ` — ${data.organisation}` : ''}`,
    pledge: `Pledge for ${data.campaign || 'a Credence campaign'}`,
    contact: 'Message via the Credence Capital website',
  };
  const subject = data.type ? subjects[data.type] : 'Please add me to the Credence Capital newsletter';
  const body = Object.entries(FIELD_LABELS).filter(([k]) => data[k]).map(([k, l]) => `${l}: ${data[k]}`).join('\n');
  window.location.href = `mailto:${STATIC_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const msg = form.querySelector('.form-msg');
  msg.className = 'form-msg ok';
  msg.textContent = `Your email app should open with this message ready to send. If it doesn't, write to ${STATIC_EMAIL}.`;
}

document.querySelectorAll('form[data-endpoint]').forEach((form) => {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (STATIC_EMAIL) {
      const fields = Object.fromEntries(new FormData(form).entries());
      if (fields.website) return; // honeypot
      sendByEmail(form, fields);
      return;
    }
    const msg = form.querySelector('.form-msg');
    const btn = form.querySelector('button[type=submit]');
    const data = Object.fromEntries(new FormData(form).entries());
    btn.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = 'Sending…';
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      const done = {
        sponsorship: 'Thank you! Our partnerships team will be in touch within two working days.',
        pledge: 'Thank you for your pledge! We will reach out with next steps shortly.',
        contact: 'Thanks — your message has been sent.',
      };
      msg.textContent = done[data.type] || "You're subscribed. Welcome aboard!";
      msg.classList.add('ok');
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    } finally {
      btn.disabled = false;
    }
  });
});

// Pledge modal
const modal = document.getElementById('pledge-modal');
if (modal) {
  document.querySelectorAll('[data-pledge]').forEach((b) => b.addEventListener('click', () => {
    const title = b.dataset.pledge;
    modal.querySelector('[data-campaign-title]').textContent = title;
    modal.querySelector('input[name=campaign]').value = title;
    modal.querySelector('.form-msg').textContent = '';
    modal.showModal();
  }));
  modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
}

// Research filters
document.querySelectorAll('.chip-btn[data-filter]').forEach((chip) => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip-btn').forEach((c) => c.classList.toggle('active', c === chip));
  const f = chip.dataset.filter;
  document.querySelectorAll('.paper').forEach((p) => { p.style.display = f === 'all' || p.dataset.type === f ? '' : 'none'; });
}));

// Tier explorer (home): list on the left drives the card on the right
document.querySelectorAll('[data-explorer]').forEach((ex) => {
  const items = ex.querySelectorAll('.explorer-item');
  const mocks = ex.querySelectorAll('.mock');
  items.forEach((it) => it.addEventListener('click', () => {
    items.forEach((x) => { const on = x === it; x.classList.toggle('open', on); x.setAttribute('aria-expanded', on); });
    mocks.forEach((m) => m.classList.toggle('show', m.dataset.i === it.dataset.i));
  }));
});

// Fund performance chart: tooltip on hover / keyboard focus
document.querySelectorAll('.perf-chart').forEach((chart) => {
  const tip = chart.querySelector('.perf-tip');
  const show = (col) => {
    const gap = Number(col.dataset.gap);
    tip.innerHTML = '';
    const t = document.createElement('b'); t.textContent = col.dataset.period; tip.append(t);
    [['Credence Capital', col.dataset.cc, '#2a78d6'], ['Nifty 50', col.dataset.nf, '#eb6834']].forEach(([l, v, c]) => {
      const r = document.createElement('div'); r.className = 'row';
      const a = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; a.append(i, l);
      const b = document.createElement('span'); b.textContent = v; r.append(a, b); tip.append(r);
    });
    const g = document.createElement('div'); g.className = 'gap';
    g.textContent = `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} pts vs the index`; tip.append(g);
    tip.hidden = false;
    const cr = chart.getBoundingClientRect(); const r = col.getBoundingClientRect();
    let left = r.left - cr.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(0, Math.min(left, cr.width - tip.offsetWidth));
    tip.style.left = `${left}px`;
    tip.style.top = '8px';
  };
  chart.querySelectorAll('.perf-col').forEach((col) => {
    col.addEventListener('mouseenter', () => show(col));
    col.addEventListener('focus', () => show(col));
    col.addEventListener('mouseleave', () => { tip.hidden = true; });
    col.addEventListener('blur', () => { tip.hidden = true; });
  });
});
