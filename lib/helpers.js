// View helpers available in templates as `h`.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plain text -> escaped <p> paragraphs (blank line = new paragraph).
const paras = (s) => String(s || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

// "Where *investors* are made" -> gold-highlighted emphasis.
const accent = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="accent">$1</em>');

const date = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? esc(d) : x.toLocaleDateString('en-IN', opts);
};

const inr = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 ? 2 : 0)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)} L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const pct = (raised, goal) => (goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0);

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const today = () => new Date(new Date().toDateString());
const upcoming = (events) => (events || []).filter((e) => e.date && new Date(e.date) >= today()).sort((a, b) => new Date(a.date) - new Date(b.date));
const past = (events) => (events || []).filter((e) => !e.date || new Date(e.date) < today()).sort((a, b) => new Date(b.date) - new Date(a.date));
const byDateDesc = (list) => [...(list || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - today()) / 864e5) : null);

const icons = {
  audience: '<path d="M16 11a4 4 0 1 0-8 0"/><circle cx="12" cy="7" r="3"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  brand: '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/><path d="m8 11 3-3 2 2 3-3"/>',
  talent: '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/>',
  insight: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
  network: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="m7 11 10-5M7 13l10 5"/>',
  impact: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.impact}</svg>`;

module.exports = { esc, paras, accent, date, inr, pct, initials, upcoming, past, byDateDesc, daysLeft, icon };
