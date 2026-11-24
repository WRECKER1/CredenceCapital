const express = require('express');
const path = require('path');
const multer = require('multer');

const store = require('./lib/store');
const auth = require('./lib/auth');
const schema = require('./lib/schema');
const helpers = require('./lib/helpers');
const analytics = require('./lib/analytics');
const media = require('./lib/media');
const assetVersion = require('./lib/asset-version');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  next();
});
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
if (media.backend === 'disk') {
  app.use('/uploads', express.static(media.UPLOAD_DIR, {
    maxAge: '30d',
    setHeaders: (res) => res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"),
  }));
}
app.use('/admin', express.static(path.join(__dirname, 'admin'), { index: 'index.html' }));

// Seed content and the first admin once per server instance (cheap after the first call).
app.use(async (req, res, next) => {
  await store.ready();
  await auth.bootstrapAdmin();
  next();
});
app.use('/api', express.json({ limit: '100kb' }));

// ---------------------------------------------------------------- public site
async function render(page, res, extra = {}) {
  const c = await store.get('content');
  const visitors = res.locals.visitors ?? await analytics.total().catch(() => 0);
  res.render(page, { c, s: c.settings || {}, h: helpers, page, visitors, assetVersion, ...extra });
}

const pages = {
  '/': ['home', null],
  '/about': ['about', 'About'],
  '/nivesh': ['nivesh', 'Nivesh'],
  '/partner': ['partner', 'Partner with us'],
  '/events': ['events', 'Events'],
  '/research': ['research', 'Research'],
  '/team': ['team', 'Team'],
  '/contact': ['contact', 'Contact'],
};
for (const [route, [view, title]] of Object.entries(pages)) {
  app.get(route, analytics.track, (req, res) => render(view, res, { title }));
}

// Simple in-memory rate limiter for public forms and login (per server instance).
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const clean = (v, n = 2000) => String(v ?? '').trim().slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

app.post('/api/enquiry', async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot
  if (limit(`form:${req.ip}`, 8, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  const type = ['sponsorship', 'contact', 'pledge'].includes(b.type) ? b.type : 'contact';
  const entry = {
    id: store.id(),
    type,
    status: 'new',
    createdAt: new Date().toISOString(),
    name: clean(b.name, 120),
    email: clean(b.email, 160).toLowerCase(),
    phone: clean(b.phone, 40),
    organisation: clean(b.organisation, 160),
    designation: clean(b.designation, 120),
    interest: clean(b.interest, 120),
    amount: b.amount ? Math.max(0, Number(b.amount) || 0) : undefined,
    campaign: clean(b.campaign, 160),
    message: clean(b.message, 5000),
    notes: '',
  };
  if (!entry.name || !isEmail(entry.email)) return res.status(400).json({ error: 'Please provide your name and a valid email.' });
  await store.append('inbox', entry);
  res.json({ ok: true });
});

app.post('/api/subscribe', async (req, res) => {
  const email = clean(req.body && req.body.email, 160).toLowerCase();
  if (req.body && req.body.website) return res.json({ ok: true });
  if (limit(`sub:${req.ip}`, 5, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  await store.append('subscribers', { id: store.id(), email, createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin API
const api = express.Router();
const editor = auth.requireUser();
const admin = auth.requireUser('admin');

api.post('/login', async (req, res) => {
  if (limit(`login:${req.ip}`, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const email = clean(req.body && req.body.email, 160).toLowerCase();
  const user = (await store.get('users')).find((u) => u.email === email);
  if (!user || !auth.verifyPassword(String(req.body.password || ''), user.password)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  await store.update('users', (users) => {
    const u = users.find((x) => x.id === user.id);
    if (u) u.lastLogin = new Date().toISOString();
  });
  await auth.issue(res, user);
  await store.log(user, 'signed in');
  res.json({ user: auth.publicUser(user) });
});

api.post('/logout', (req, res) => { auth.clear(res); res.json({ ok: true }); });

api.get('/me', editor, (req, res) => res.json({ user: auth.publicUser(req.user) }));

api.get('/schema', editor, (req, res) => res.json(schema));

api.get('/status', editor, (req, res) => res.json({
  storage: store.backend,
  media: media.backend,
  ephemeral: store.ephemeral,
  mediaEphemeral: media.ephemeral,
  maxUploadMB: Math.round(media.MAX_BYTES / 1024 / 1024),
}));

api.get('/dashboard', editor, async (req, res) => {
  const [c, inbox, subscribers, activity, stats] = await Promise.all([
    store.get('content'), store.get('inbox'), store.get('subscribers'), store.get('activity'), analytics.summary().catch(() => null),
  ]);
  const pipeline = {};
  inbox.filter((e) => e.type === 'sponsorship').forEach((e) => { pipeline[e.status] = (pipeline[e.status] || 0) + 1; });
  const campaigns = (c.campaigns || []).filter((x) => x.status === 'active');
  res.json({
    counts: {
      newEnquiries: inbox.filter((e) => e.status === 'new').length,
      sponsorship: inbox.filter((e) => e.type === 'sponsorship').length,
      pledges: inbox.filter((e) => e.type === 'pledge').length,
      pledgedAmount: inbox.filter((e) => e.type === 'pledge' && e.status !== 'lost').reduce((a, e) => a + (e.amount || 0), 0),
      subscribers: subscribers.length,
      sponsors: (c.sponsors || []).length,
      events: (c.events || []).length,
    },
    pipeline,
    campaigns: campaigns.map((x) => ({ title: x.title, goal: x.goal, raised: x.raised })),
    recent: inbox.slice(0, 6),
    activity: activity.slice(0, 10),
    analytics: stats,
  });
});

api.get('/analytics', editor, async (req, res) => res.json(await analytics.summary()));
api.post('/analytics/reset', admin, async (req, res) => {
  await analytics.reset();
  await store.log(req.user, 'reset visitor counter');
  res.json({ ok: true });
});

// Singletons
api.get('/content/:key', editor, async (req, res) => {
  if (!schema.singletons[req.params.key]) return res.status(404).json({ error: 'Unknown section' });
  res.json((await store.get('content'))[req.params.key] || {});
});
api.put('/content/:key', editor, async (req, res) => {
  const def = schema.singletons[req.params.key];
  if (!def) return res.status(404).json({ error: 'Unknown section' });
  const { data, errors } = schema.sanitize(def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  await store.update('content', (c) => { c[req.params.key] = data; });
  await store.log(req.user, `updated ${def.label}`);
  res.json(data);
});

// Collections
function collection(req, res, next) {
  const def = schema.collections[req.params.name];
  if (!def) return res.status(404).json({ error: 'Unknown collection' });
  req.def = def;
  next();
}
// Run fn(items) against the collection inside a safe content update.
const withItems = (name, fn) => store.update('content', (c) => {
  c[name] = Array.isArray(c[name]) ? c[name] : [];
  return fn(c[name], c);
});
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

api.get('/c/:name', editor, collection, async (req, res) => res.json((await store.get('content'))[req.params.name] || []));
api.post('/c/:name', editor, collection, async (req, res) => {
  const { data, errors } = schema.sanitize(req.def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  const item = { id: store.id(), ...data };
  await withItems(req.params.name, (items) => { items.unshift(item); });
  await store.log(req.user, `added to ${req.def.label}`, item[req.def.titleField]);
  res.json(item);
});
api.put('/c/:name/:id', editor, collection, async (req, res) => {
  const { data, errors } = schema.sanitize(req.def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  const item = { id: req.params.id, ...data };
  await withItems(req.params.name, (items) => {
    const i = items.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw new HttpError(404, 'Not found');
    items[i] = item;
  });
  await store.log(req.user, `edited ${req.def.label}`, data[req.def.titleField]);
  res.json(item);
});
api.delete('/c/:name/:id', editor, collection, async (req, res) => {
  const gone = await withItems(req.params.name, (items) => {
    const i = items.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw new HttpError(404, 'Not found');
    return items.splice(i, 1)[0];
  });
  await store.log(req.user, `deleted from ${req.def.label}`, gone[req.def.titleField]);
  res.json({ ok: true });
});
api.post('/c/:name/reorder', editor, collection, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const next = await withItems(req.params.name, (items, c) => {
    const byId = new Map(items.map((x) => [x.id, x]));
    const ordered = ids.map((x) => byId.get(x)).filter(Boolean);
    items.forEach((x) => { if (!ordered.includes(x)) ordered.push(x); });
    c[req.params.name] = ordered;
    return ordered;
  });
  res.json(next);
});

// Inbox (sponsorship leads, pledges, contact messages)
const STATUSES = ['new', 'contacted', 'negotiating', 'won', 'lost', 'archived'];
api.get('/inbox', editor, async (req, res) => res.json({ items: await store.get('inbox'), statuses: STATUSES }));
api.patch('/inbox/:id', editor, async (req, res) => {
  const e = await store.update('inbox', (inbox) => {
    const x = inbox.find((y) => y.id === req.params.id);
    if (!x) throw new HttpError(404, 'Not found');
    if (req.body.status && STATUSES.includes(req.body.status)) x.status = req.body.status;
    if (typeof req.body.notes === 'string') x.notes = clean(req.body.notes, 5000);
    if (req.body.amount !== undefined) x.amount = Math.max(0, Number(req.body.amount) || 0);
    x.updatedAt = new Date().toISOString();
    return x;
  });
  await store.log(req.user, `updated enquiry → ${e.status}`, e.organisation || e.name);
  res.json(e);
});
api.delete('/inbox/:id', editor, async (req, res) => {
  await store.update('inbox', (inbox) => {
    const i = inbox.findIndex((x) => x.id === req.params.id);
    if (i >= 0) inbox.splice(i, 1);
  });
  res.json({ ok: true });
});

function csv(rows, cols) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // avoid spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
api.get('/inbox.csv', editor, async (req, res) => {
  res.type('text/csv').attachment('credence-enquiries.csv')
    .send(csv(await store.get('inbox'), ['createdAt', 'type', 'status', 'name', 'email', 'phone', 'organisation', 'designation', 'interest', 'campaign', 'amount', 'message', 'notes']));
});

// Subscribers
api.get('/subscribers', editor, async (req, res) => res.json(await store.get('subscribers')));
api.delete('/subscribers/:id', editor, async (req, res) => {
  await store.update('subscribers', (subs) => {
    const i = subs.findIndex((x) => x.id === req.params.id);
    if (i >= 0) subs.splice(i, 1);
  });
  res.json({ ok: true });
});
api.get('/subscribers.csv', editor, async (req, res) => {
  res.type('text/csv').attachment('credence-subscribers.csv').send(csv(await store.get('subscribers'), ['email', 'createdAt']));
});

// Media library
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: media.MAX_BYTES },
  fileFilter: (req, file, cb) => cb(null, media.allowed(file.originalname)),
});
api.get('/media', editor, async (req, res) => res.json(await media.list()));
api.post('/media', editor, upload.array('files', 20), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: `Only images (PNG, JPG, WEBP, GIF, AVIF) and PDFs up to ${Math.round(media.MAX_BYTES / 1024 / 1024)} MB are allowed.` });
  }
  const saved = [];
  for (const f of req.files) saved.push(await media.save(f));
  await store.log(req.user, `uploaded ${saved.length} file(s)`);
  res.json(saved);
});
api.delete('/media/:name', editor, async (req, res) => {
  await media.remove(req.params.name);
  await store.log(req.user, 'deleted file', path.basename(req.params.name));
  res.json({ ok: true });
});

// Users
api.get('/users', admin, async (req, res) => res.json((await store.get('users')).map(auth.publicUser)));
api.post('/users', admin, async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
  const user = { id: store.id(), name: clean(req.body.name, 120) || email, email, role: req.body.role === 'admin' ? 'admin' : 'editor', password: auth.hashPassword(password), version: 1, createdAt: new Date().toISOString() };
  await store.update('users', (users) => {
    if (users.find((u) => u.email === email)) throw new HttpError(400, 'User already exists');
    users.push(user);
  });
  await store.log(req.user, 'added user', email);
  res.json(auth.publicUser(user));
});
api.delete('/users/:id', admin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" });
  const gone = await store.update('users', (users) => {
    const i = users.findIndex((u) => u.id === req.params.id);
    return i >= 0 ? users.splice(i, 1)[0] : null;
  });
  if (gone) await store.log(req.user, 'removed user', gone.email);
  res.json({ ok: true });
});
api.put('/password', editor, async (req, res) => {
  const { current, next } = req.body || {};
  if (!auth.verifyPassword(String(current || ''), req.user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(next || '').length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
  const updated = await store.update('users', (users) => {
    const u = users.find((x) => x.id === req.user.id);
    u.password = auth.hashPassword(String(next));
    u.version = (u.version || 1) + 1;
    return u;
  });
  await auth.issue(res, updated);
  await store.log(req.user, 'changed password');
  res.json({ ok: true });
});

// Backup / restore
api.get('/export', admin, async (req, res) => {
  const [content, inbox, subscribers] = await Promise.all([store.get('content'), store.get('inbox'), store.get('subscribers')]);
  res.attachment(`credence-backup-${new Date().toISOString().slice(0, 10)}.json`)
    .json({ exportedAt: new Date().toISOString(), content, inbox, subscribers });
});
api.post('/import', admin, async (req, res) => {
  const b = req.body || {};
  if (!b.content || typeof b.content !== 'object') return res.status(400).json({ error: 'Not a valid backup file' });
  const next = {};
  for (const [k, def] of Object.entries(schema.singletons)) next[k] = schema.sanitize(def, b.content[k] || {}).data;
  for (const [k, def] of Object.entries(schema.collections)) {
    next[k] = (Array.isArray(b.content[k]) ? b.content[k] : []).map((x) => ({ id: String(x.id || store.id()), ...schema.sanitize(def, x).data }));
  }
  await store.update('content', (c) => { Object.keys(c).forEach((k) => delete c[k]); Object.assign(c, next); });
  await store.log(req.user, 'restored content from backup');
  res.json({ ok: true });
});

app.use('/admin/api', express.json({ limit: '4mb' }), api);

// ---------------------------------------------------------------- misc
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /admin\n'));
app.get('/healthz', async (req, res) => res.json({ ok: true, storage: store.backend, media: media.backend }));
app.use(async (req, res) => { res.status(404); await render('404', res, { title: 'Page not found' }); });
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  const message = err.code === 'LIMIT_FILE_SIZE' ? `Files must be smaller than ${Math.round(media.MAX_BYTES / 1024 / 1024)} MB.` : err.message;
  if (req.path.startsWith('/admin/api') || req.path.startsWith('/api/')) return res.status(status).json({ error: message || 'Server error' });
  res.status(status).send('Something went wrong.');
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Credence Capital running at http://localhost:${PORT}  (CMS: /admin)  storage: ${store.backend}, media: ${media.backend}`);
    try { await store.ready(); await auth.bootstrapAdmin(); } catch (err) { console.error(err); }
  });
}
