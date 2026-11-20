// Privacy-friendly visitor counter. No third-party scripts and no IP addresses stored.
// A random first-party cookie identifies a browser, so returning visitors are
// counted once. Bots and the CMS are ignored.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./store');

const FILE = path.join(DATA_DIR, 'analytics.json');
const COOKIE = 'cc_vid';
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|whatsapp|telegram|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

let data;
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = {}; }
data = { since: new Date().toISOString(), totalViews: 0, totalVisitors: 0, days: {}, pages: {}, today: { date: '', ids: [] }, ...data };

let timer = null;
function save() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  }, 5000);
  timer.unref();
}
function flush() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch {}
}
process.on('exit', flush);
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { flush(); process.exit(0); });

// IST calendar day, since the audience is in India.
const dayKey = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

function readCookie(req) {
  const m = /(?:^|;\s*)cc_vid=([a-f0-9]{24})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

// Express middleware: count a page view for real visitors on public pages.
function track(req, res, next) {
  const ua = req.get('user-agent') || '';
  if (req.method !== 'GET' || BOT.test(ua) || req.get('purpose') === 'prefetch') return next();

  let vid = readCookie(req);
  const isNew = !vid;
  if (isNew) {
    vid = crypto.randomBytes(12).toString('hex');
    res.cookie(COOKIE, vid, { maxAge: 365 * 864e5, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  }

  const day = dayKey();
  if (data.today.date !== day) data.today = { date: day, ids: [] };
  const d = (data.days[day] = data.days[day] || { views: 0, visitors: 0 });
  const hashed = crypto.createHash('sha256').update(vid).digest('hex').slice(0, 16);

  d.views++;
  data.totalViews++;
  if (!data.today.ids.includes(hashed)) { data.today.ids.push(hashed); d.visitors++; }
  if (isNew) data.totalVisitors++;
  data.pages[req.path] = (data.pages[req.path] || 0) + 1;

  // Keep a year of daily history.
  const keys = Object.keys(data.days).sort();
  while (keys.length > 366) delete data.days[keys.shift()];
  save();
  next();
}

function summary() {
  const series = [];
  for (let i = 29; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 864e5));
    series.push({ date: k, ...(data.days[k] || { views: 0, visitors: 0 }) });
  }
  const sum = (arr, f) => arr.reduce((a, x) => a + x[f], 0);
  return {
    since: data.since,
    totalVisitors: data.totalVisitors,
    totalViews: data.totalViews,
    today: series[29],
    last7: { visitors: sum(series.slice(-7), 'visitors'), views: sum(series.slice(-7), 'views') },
    last30: { visitors: sum(series, 'visitors'), views: sum(series, 'views') },
    series,
    topPages: Object.entries(data.pages).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, v]) => ({ path: p, views: v })),
  };
}

function reset() {
  data = { since: new Date().toISOString(), totalViews: 0, totalVisitors: 0, days: {}, pages: {}, today: { date: '', ids: [] } };
  save();
}

const totalVisitors = () => data.totalVisitors;

module.exports = { track, summary, reset, totalVisitors };
