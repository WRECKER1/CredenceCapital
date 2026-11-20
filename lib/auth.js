// Password hashing (scrypt) and stateless HMAC-signed session cookies.
const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'cc_session';
const MAX_AGE = 1000 * 60 * 60 * 12; // 12 hours

let SECRET = process.env.SESSION_SECRET || null;
async function secret() {
  if (!SECRET) SECRET = await store.secret();
  return SECRET;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

async function issue(res, user) {
  // `v` lets a password change invalidate existing sessions.
  const payload = Buffer.from(JSON.stringify({ uid: user.id, v: user.version || 1, exp: Date.now() + MAX_AGE })).toString('base64url');
  res.cookie(COOKIE, `${payload}.${sign(payload, await secret())}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    maxAge: MAX_AGE,
    path: '/',
  });
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

async function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload, await secret());
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  const user = (await store.get('users')).find((u) => u.id === data.uid);
  if (!user || (user.version || 1) !== data.v) return null;
  return user;
}

function clear(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Require a logged-in user; optionally a role. Also enforces a custom header
// on state-changing requests as a CSRF guard (forms on other sites can't set it).
function requireUser(role) {
  return async (req, res, next) => {
    try {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: 'Not signed in' });
      if (req.method !== 'GET' && req.get('X-CC-Admin') !== '1') return res.status(403).json({ error: 'Bad request origin' });
      if (role === 'admin' && user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
      req.user = user;
      next();
    } catch (err) { next(err); }
  };
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, lastLogin: u.lastLogin };
}

// Ensure at least one admin exists on first boot.
let booted;
function bootstrapAdmin() {
  if (!booted) {
    booted = (async () => {
      if ((await store.get('users')).length) return;
      const email = (process.env.ADMIN_EMAIL || 'admin@credencecapital.in').toLowerCase();
      const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
      let created = false;
      await store.update('users', (users) => {
        if (users.length) return;
        users.push({ id: store.id(), name: 'Administrator', email, role: 'admin', password: hashPassword(password), version: 1, createdAt: new Date().toISOString() });
        created = true;
      });
      if (!created) return;
      console.log('\n  ┌─────────────────────────────────────────────────────────');
      console.log('  │ Created first CMS admin account');
      console.log(`  │   email:    ${email}`);
      console.log(`  │   password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : password}`);
      console.log('  │ Sign in at /admin and change it under My account.');
      console.log('  └─────────────────────────────────────────────────────────\n');
    })().catch((err) => { booted = null; throw err; });
  }
  return booted;
}

module.exports = { hashPassword, verifyPassword, issue, clear, currentUser, requireUser, publicUser, bootstrapAdmin };
