// Privacy-friendly visitor counter. No third-party scripts and no IP addresses stored.
// A random first-party cookie identifies a browser, so returning visitors are
// counted once. Bots and the CMS are ignored. Stored in a JSON file locally, or
// in Upstash Redis on serverless hosts (atomic counters, safe across instances).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kv = require('./kv');
const { DATA_DIR, backend } = require('./store');

const COOKIE = 'cc_vid';
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|whatsapp|telegram|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|vercel-screenshot|vercel-favicon/i;

// IST calendar day, since the audience is in India.
const dayKey = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const last30 = () => Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - (29 - i) * 864e5)));
const hashId = (vid) => crypto.createHash('sha256').update(vid).digest('hex').slice(0, 16);

// ------------------------------------------------------------------ file backend
const fileBackend = (() => {
  const FILE = path.join(DATA_DIR, 'analytics.json');
  const fresh = () => ({ since: new Date().toISOString(), totalViews: 0, totalVisitors: 0, days: {}, pages: {}, today: { date: '', ids: [] } });
  let data;
  try { data = { ...fresh(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { data = fresh(); }

  let timer = null;
  const write = () => { try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch {} };
  const save = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; write(); }, 5000);
    timer.unref();
  };
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; write(); } };
  process.on('exit', flush);
  for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { flush(); process.exit(0); });

  return {
    async record(vid, isNew, page) {
      const day = dayKey();
      if (data.today.date !== day) data.today = { date: day, ids: [] };
      const d = (data.days[day] = data.days[day] || { views: 0, visitors: 0 });
      const h = hashId(vid);
      d.views++;
      data.totalViews++;
      if (!data.today.ids.includes(h)) { data.today.ids.push(h); d.visitors++; }
      if (isNew) data.totalVisitors++;
      data.pages[page] = (data.pages[page] || 0) + 1;
      const keys = Object.keys(data.days).sort();
      while (keys.length > 366) delete data.days[keys.shift()];
      save();
      return data.totalVisitors;
    },
    async total() { return data.totalVisitors; },
    async summary() {
      return {
        since: data.since, totalVisitors: data.totalVisitors, totalViews: data.totalViews,
        series: last30().map((k) => ({ date: k, ...(data.days[k] || { views: 0, visitors: 0 }) })),
        pages: Object.entries(data.pages),
      };
    },
    async reset() { data = fresh(); save(); },
  };
})();

// ------------------------------------------------------------------ redis backend
const redisBackend = {
  async record(vid, isNew, page) {
    const day = dayKey();
    const cmds = [
      ['SET', 'cc:a:since', new Date().toISOString(), 'NX'],
      ['INCR', 'cc:a:views'],
      ['HINCRBY', `cc:a:day:${day}`, 'views', 1],
      ['EXPIRE', `cc:a:day:${day}`, 400 * 86400],
      ['SADD', `cc:a:uniq:${day}`, hashId(vid)],
      ['EXPIRE', `cc:a:uniq:${day}`, 400 * 86400],
      ['HINCRBY', 'cc:a:pages', page, 1],
      isNew ? ['INCR', 'cc:a:visitors'] : ['GET', 'cc:a:visitors'],
    ];
    const out = await kv.pipeline(cmds);
    return Number(out[7]) || 0;
  },
  async total() {
    return Number(await kv.cmd('GET', 'cc:a:visitors')) || 0;
  },
  async summary() {
    const days = last30();
    const out = await kv.pipeline([
      ['GET', 'cc:a:since'], ['GET', 'cc:a:visitors'], ['GET', 'cc:a:views'], ['HGETALL', 'cc:a:pages'],
      ...days.flatMap((d) => [['HGET', `cc:a:day:${d}`, 'views'], ['SCARD', `cc:a:uniq:${d}`]]),
    ]);
    const pagesFlat = out[3] || [];
    const pages = [];
    for (let i = 0; i < pagesFlat.length; i += 2) pages.push([pagesFlat[i], Number(pagesFlat[i + 1])]);
    return {
      since: out[0] || new Date().toISOString(),
      totalVisitors: Number(out[1]) || 0,
      totalViews: Number(out[2]) || 0,
      series: days.map((d, i) => ({ date: d, views: Number(out[4 + i * 2]) || 0, visitors: Number(out[5 + i * 2]) || 0 })),
      pages,
    };
  },
  async reset() {
    const days = last30();
    await kv.pipeline([
      ['DEL', 'cc:a:views', 'cc:a:visitors', 'cc:a:pages', ...days.flatMap((d) => [`cc:a:day:${d}`, `cc:a:uniq:${d}`])],
      ['SET', 'cc:a:since', new Date().toISOString()],
    ]);
  },
};

const impl = backend === 'redis' ? redisBackend : fileBackend;

function readCookie(req) {
  const m = /(?:^|;\s*)cc_vid=([a-f0-9]{24})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}

// Express middleware: count a page view for real visitors on public pages.
// Puts the all-time visitor total on res.locals.visitors for the footer.
async function track(req, res, next) {
  try {
    const ua = req.get('user-agent') || '';
    if (req.method !== 'GET' || BOT.test(ua) || req.get('purpose') === 'prefetch') {
      res.locals.visitors = await impl.total();
      return next();
    }
    let vid = readCookie(req);
    const isNew = !vid;
    if (isNew) {
      vid = crypto.randomBytes(12).toString('hex');
      res.cookie(COOKIE, vid, { maxAge: 365 * 864e5, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL), path: '/' });
    }
    res.locals.visitors = await impl.record(vid, isNew, req.path);
  } catch (err) {
    console.error('visitor counter failed', err.message); // never block the page
  }
  next();
}

async function summary() {
  const s = await impl.summary();
  const sum = (arr, f) => arr.reduce((a, x) => a + x[f], 0);
  return {
    since: s.since,
    totalVisitors: s.totalVisitors,
    totalViews: s.totalViews,
    today: s.series[29],
    last7: { visitors: sum(s.series.slice(-7), 'visitors'), views: sum(s.series.slice(-7), 'views') },
    last30: { visitors: sum(s.series, 'visitors'), views: sum(s.series, 'views') },
    series: s.series,
    topPages: s.pages.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, v]) => ({ path: p, views: v })),
  };
}

module.exports = { track, summary, reset: () => impl.reset(), total: () => impl.total() };
