const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const store = require('./lib/store');
const auth = require('./lib/auth');
const schema = require('./lib/schema');
const helpers = require('./lib/helpers');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
app.use('/api', express.json({ limit: '100kb' }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  setHeaders: (res) => res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"),
}));
app.use('/admin', express.static(path.join(__dirname, 'admin'), { index: 'index.html' }));

// ---------------------------------------------------------------- public site
function render(page, res, extra = {}) {
  const c = store.content;
  res.render(page, { c, s: c.settings || {}, h: helpers, page, ...extra });
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
  app.get(route, (req, res) => render(view, res, { title }));
}

// Simple in-memory rate limiter for public forms and login.
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();

const clean = (v, n = 2000) => String(v ?? '').trim().slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

app.post('/api/enquiry', (req, res) => {
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
  store.inbox.unshift(entry);
  store.save('inbox');
  res.json({ ok: true });
});

app.post('/api/subscribe', (req, res) => {
  const email = clean(req.body && req.body.email, 160).toLowerCase();
  if (req.body && req.body.website) return res.json({ ok: true });
  if (limit(`sub:${req.ip}`, 5, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!store.subscribers.find((s) => s.email === email)) {
    store.subscribers.unshift({ id: store.id(), email, createdAt: new Date().toISOString() });
    store.save('subscribers');
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin API
const api = express.Router();
const editor = auth.requireUser();
const admin = auth.requireUser('admin');

api.post('/login', (req, res) => {
  if (limit(`login:${req.ip}`, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const email = clean(req.body && req.body.email, 160).toLowerCase();
  const user = store.users.find((u) => u.email === email);
  if (!user || !auth.verifyPassword(String(req.body.password || ''), user.password)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  user.lastLogin = new Date().toISOString();
  store.save('users');
  auth.issue(res, user);
  store.log(user, 'signed in');
  res.json({ user: auth.publicUser(user) });
});

api.post('/logout', (req, res) => { auth.clear(res); res.json({ ok: true }); });

api.get('/me', editor, (req, res) => res.json({ user: auth.publicUser(req.user) }));

api.get('/schema', editor, (req, res) => res.json(schema));

api.get('/dashboard', editor, (req, res) => {
  const c = store.content;
  const inbox = store.inbox;
  const pipeline = {};
  inbox.filter((e) => e.type === 'sponsorship').forEach((e) => { pipeline[e.status] = (pipeline[e.status] || 0) + 1; });
  const campaigns = (c.campaigns || []).filter((x) => x.status === 'active');
  res.json({
    counts: {
      newEnquiries: inbox.filter((e) => e.status === 'new').length,
      sponsorship: inbox.filter((e) => e.type === 'sponsorship').length,
      pledges: inbox.filter((e) => e.type === 'pledge').length,
      pledgedAmount: inbox.filter((e) => e.type === 'pledge' && e.status !== 'lost').reduce((a, e) => a + (e.amount || 0), 0),
      subscribers: store.subscribers.length,
      sponsors: (c.sponsors || []).length,
      events: (c.events || []).length,
    },
    pipeline,
    campaigns: campaigns.map((x) => ({ title: x.title, goal: x.goal, raised: x.raised })),
    recent: inbox.slice(0, 6),
    activity: store.activity.slice(0, 10),
  });
});

// Singletons
api.get('/content/:key', editor, (req, res) => {
  if (!schema.singletons[req.params.key]) return res.status(404).json({ error: 'Unknown section' });
  res.json(store.content[req.params.key] || {});
});
api.put('/content/:key', editor, (req, res) => {
  const def = schema.singletons[req.params.key];
  if (!def) return res.status(404).json({ error: 'Unknown section' });
  const { data, errors } = schema.sanitize(def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  store.content[req.params.key] = data;
  store.save('content');
  store.log(req.user, `updated ${def.label}`);
  res.json(data);
});

// Collections
function collection(req, res, next) {
  const def = schema.collections[req.params.name];
  if (!def) return res.status(404).json({ error: 'Unknown collection' });
  req.def = def;
  store.content[req.params.name] = store.content[req.params.name] || [];
  req.items = store.content[req.params.name];
  next();
}
api.get('/c/:name', editor, collection, (req, res) => res.json(req.items));
api.post('/c/:name', editor, collection, (req, res) => {
  const { data, errors } = schema.sanitize(req.def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  const item = { id: store.id(), ...data };
  req.items.unshift(item);
  store.save('content');
  store.log(req.user, `added to ${req.def.label}`, item[req.def.titleField]);
  res.json(item);
});
api.put('/c/:name/:id', editor, collection, (req, res) => {
  const i = req.items.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const { data, errors } = schema.sanitize(req.def, req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  req.items[i] = { id: req.params.id, ...data };
  store.save('content');
  store.log(req.user, `edited ${req.def.label}`, data[req.def.titleField]);
  res.json(req.items[i]);
});
api.delete('/c/:name/:id', editor, collection, (req, res) => {
  const i = req.items.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const [gone] = req.items.splice(i, 1);
  store.save('content');
  store.log(req.user, `deleted from ${req.def.label}`, gone[req.def.titleField]);
  res.json({ ok: true });
});
api.post('/c/:name/reorder', editor, collection, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const byId = new Map(req.items.map((x) => [x.id, x]));
  const next = ids.map((x) => byId.get(x)).filter(Boolean);
  req.items.forEach((x) => { if (!next.includes(x)) next.push(x); });
  store.content[req.params.name] = next;
  store.save('content');
  res.json(next);
});

// Inbox (sponsorship leads, pledges, contact messages)
const STATUSES = ['new', 'contacted', 'negotiating', 'won', 'lost', 'archived'];
api.get('/inbox', editor, (req, res) => res.json({ items: store.inbox, statuses: STATUSES }));
api.patch('/inbox/:id', editor, (req, res) => {
  const e = store.inbox.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  if (req.body.status && STATUSES.includes(req.body.status)) e.status = req.body.status;
  if (typeof req.body.notes === 'string') e.notes = clean(req.body.notes, 5000);
  if (req.body.amount !== undefined) e.amount = Math.max(0, Number(req.body.amount) || 0);
  e.updatedAt = new Date().toISOString();
  store.save('inbox');
  store.log(req.user, `updated enquiry → ${e.status}`, e.organisation || e.name);
  res.json(e);
});
api.delete('/inbox/:id', editor, (req, res) => {
  const i = store.inbox.findIndex((x) => x.id === req.params.id);
  if (i >= 0) store.inbox.splice(i, 1);
  store.save('inbox');
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
api.get('/inbox.csv', editor, (req, res) => {
  res.type('text/csv').attachment('credence-enquiries.csv')
    .send(csv(store.inbox, ['createdAt', 'type', 'status', 'name', 'email', 'phone', 'organisation', 'designation', 'interest', 'campaign', 'amount', 'message', 'notes']));
});

// Subscribers
api.get('/subscribers', editor, (req, res) => res.json(store.subscribers));
api.delete('/subscribers/:id', editor, (req, res) => {
  const i = store.subscribers.findIndex((x) => x.id === req.params.id);
  if (i >= 0) store.subscribers.splice(i, 1);
  store.save('subscribers');
  res.json({ ok: true });
});
api.get('/subscribers.csv', editor, (req, res) => {
  res.type('text/csv').attachment('credence-subscribers.csv').send(csv(store.subscribers, ['email', 'createdAt']));
});

// Media library
const ALLOWED = { '.png': 1, '.jpg': 1, '.jpeg': 1, '.webp': 1, '.gif': 1, '.avif': 1, '.pdf': 1 };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
      cb(null, `${base}-${crypto.randomBytes(3).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED[path.extname(file.originalname).toLowerCase()]),
});
api.get('/media', editor, (req, res) => {
  const list = fs.readdirSync(UPLOAD_DIR).filter((f) => ALLOWED[path.extname(f).toLowerCase()]).map((f) => {
    const st = fs.statSync(path.join(UPLOAD_DIR, f));
    return { name: f, url: `/uploads/${f}`, size: st.size, at: st.mtime };
  }).sort((a, b) => b.at - a.at);
  res.json(list);
});
api.post('/media', editor, upload.array('files', 20), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'Only images (PNG, JPG, WEBP, GIF, AVIF) and PDFs up to 15 MB are allowed.' });
  store.log(req.user, `uploaded ${req.files.length} file(s)`);
  res.json(req.files.map((f) => ({ name: f.filename, url: `/uploads/${f.filename}` })));
});
api.delete('/media/:name', editor, (req, res) => {
  const name = path.basename(req.params.name);
  const p = path.join(UPLOAD_DIR, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  store.log(req.user, 'deleted file', name);
  res.json({ ok: true });
});

// Users
api.get('/users', admin, (req, res) => res.json(store.users.map(auth.publicUser)));
api.post('/users', admin, (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email required' });
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
  if (store.users.find((u) => u.email === email)) return res.status(400).json({ error: 'User already exists' });
  const user = { id: store.id(), name: clean(req.body.name, 120) || email, email, role: req.body.role === 'admin' ? 'admin' : 'editor', password: auth.hashPassword(password), version: 1, createdAt: new Date().toISOString() };
  store.users.push(user);
  store.save('users');
  store.log(req.user, 'added user', email);
  res.json(auth.publicUser(user));
});
api.delete('/users/:id', admin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" });
  const i = store.users.findIndex((u) => u.id === req.params.id);
  if (i >= 0) { store.log(req.user, 'removed user', store.users[i].email); store.users.splice(i, 1); }
  store.save('users');
  res.json({ ok: true });
});
api.put('/password', editor, (req, res) => {
  const { current, next } = req.body || {};
  if (!auth.verifyPassword(String(current || ''), req.user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (String(next || '').length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
  req.user.password = auth.hashPassword(String(next));
  req.user.version = (req.user.version || 1) + 1;
  store.save('users');
  auth.issue(res, req.user);
  store.log(req.user, 'changed password');
  res.json({ ok: true });
});

// Backup / restore
api.get('/export', admin, (req, res) => {
  res.attachment(`credence-backup-${new Date().toISOString().slice(0, 10)}.json`)
    .json({ exportedAt: new Date().toISOString(), content: store.content, inbox: store.inbox, subscribers: store.subscribers });
});
api.post('/import', admin, (req, res) => {
  const b = req.body || {};
  if (!b.content || typeof b.content !== 'object') return res.status(400).json({ error: 'Not a valid backup file' });
  const next = {};
  for (const [k, def] of Object.entries(schema.singletons)) next[k] = schema.sanitize(def, b.content[k] || {}).data;
  for (const [k, def] of Object.entries(schema.collections)) {
    next[k] = (Array.isArray(b.content[k]) ? b.content[k] : []).map((x) => ({ id: String(x.id || store.id()), ...schema.sanitize(def, x).data }));
  }
  store.content = next;
  store.log(req.user, 'restored content from backup');
  res.json({ ok: true });
});

app.use('/admin/api', express.json({ limit: '10mb' }), api);

// ---------------------------------------------------------------- misc
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /admin\n'));
app.use((req, res) => { res.status(404); render('404', res, { title: 'Page not found' }); });
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/admin/api')) return res.status(500).json({ error: err.message || 'Server error' });
  res.status(500).send('Something went wrong.');
});

auth.bootstrapAdmin();
app.listen(PORT, () => console.log(`Credence Capital running at http://localhost:${PORT}  (CMS: /admin)`));
