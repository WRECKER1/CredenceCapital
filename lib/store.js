// Data store for content, leads, subscribers, users and the activity log.
//
// Two backends with the same async API:
//  - files: JSON files in DATA_DIR (local development, VPS, Docker)
//  - redis: Upstash Redis (Vercel and other serverless hosts)
//
//   const content = await store.get('content');          // read (always fresh)
//   await store.update('inbox', (list) => { list.unshift(x); });  // safe write
//
// update() is compare-and-set on Redis: if another request wrote the same
// document in the meantime it reloads and re-applies the change, so a sponsor
// enquiry can never be overwritten by a CMS edit happening at the same moment.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kv = require('./kv');

const ON_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = process.env.DATA_DIR || (ON_VERCEL ? '/tmp/credence-data' : path.join(__dirname, '..', 'data'));
const SEED_FILE = path.join(__dirname, '..', 'data', 'seed.json');
const DOCS = { content: {}, inbox: [], subscribers: [], users: [], activity: [] };

const backend = kv.enabled ? 'redis' : 'files';
// True when data will not survive a restart (serverless without Redis).
const ephemeral = backend === 'files' && ON_VERCEL;

const id = () => crypto.randomBytes(6).toString('hex');
const clone = (v) => JSON.parse(JSON.stringify(v));
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

// ------------------------------------------------------------------ files
const files = {
  cache: {},
  init() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  },
  file: (name) => path.join(DATA_DIR, `${name}.json`),
  async get(name) {
    if (!(name in this.cache)) {
      try { this.cache[name] = JSON.parse(fs.readFileSync(this.file(name), 'utf8')); } catch { this.cache[name] = null; }
    }
    return this.cache[name];
  },
  async set(name, value) {
    this.cache[name] = value;
    const tmp = `${this.file(name)}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, this.file(name));
  },
  async update(name, fn) {
    const doc = (await this.get(name)) ?? clone(DOCS[name]);
    const result = await fn(doc);
    await this.set(name, doc);
    return result;
  },
  async append(name, item) {
    await this.update(name, (list) => { mergePending(name, list, [item]); });
  },
  async pending() { return []; },
  async secret() {
    const f = path.join(DATA_DIR, '.session-secret');
    try { return fs.readFileSync(f, 'utf8'); } catch {
      const s = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(f, s, { mode: 0o600 });
      return s;
    }
  },
};

// ------------------------------------------------------------------ redis
// Compare-and-set: write only if the version is still what we read.
const CAS = `
if (redis.call('GET', KEYS[2]) or '0') == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  return redis.call('INCR', KEYS[2])
end
return -1`;

const redis = {
  cache: {}, // name -> { ver, doc }
  init() {},
  key: (name) => [`cc:doc:${name}`, `cc:ver:${name}`],
  async fetch(name) {
    const [dk, vk] = this.key(name);
    const cached = this.cache[name];
    const ver = (await kv.cmd('GET', vk)) || '0';
    if (cached && cached.ver === ver) return cached;
    const raw = await kv.cmd('GET', dk);
    // If a write lands between the two GETs, the doc is newer than `ver` and the
    // next CAS simply fails and retries, so this is safe.
    this.cache[name] = { ver, doc: raw ? JSON.parse(raw) : null };
    return this.cache[name];
  },
  async get(name) {
    return (await this.fetch(name)).doc;
  },
  async set(name, value) {
    const [dk, vk] = this.key(name);
    const [, ver] = await kv.pipeline([['SET', dk, JSON.stringify(value)], ['INCR', vk]]);
    this.cache[name] = { ver: String(ver), doc: value };
  },
  // Appends never conflict: they go on a Redis list and are folded into the
  // document by the next update().
  async append(name, item) {
    await kv.cmd('RPUSH', `cc:queue:${name}`, JSON.stringify(item));
  },
  async queue(name) {
    if (!APPENDABLE.includes(name)) return [];
    return (await kv.cmd('LRANGE', `cc:queue:${name}`, 0, -1)) || [];
  },
  async pending(name) {
    return (await this.queue(name)).map((x) => JSON.parse(x));
  },
  async update(name, fn) {
    const [dk, vk] = this.key(name);
    for (let attempt = 0; attempt < 12; attempt++) {
      const { ver, doc } = await this.fetch(name);
      const working = doc ? clone(doc) : clone(DOCS[name]);
      const raw = await this.queue(name);
      mergePending(name, working, raw.map((x) => JSON.parse(x)));
      let result;
      try {
        result = await fn(working);
      } catch (err) {
        // A "not found" can be an artefact of reading mid-change (another
        // instance just merged the queue). If the data moved on, retry.
        if (((await kv.cmd('GET', vk)) || '0') !== ver) { delete this.cache[name]; continue; }
        throw err;
      }
      const next = await kv.cmd('EVAL', CAS, 2, dk, vk, ver, JSON.stringify(working));
      if (Number(next) !== -1) {
        this.cache[name] = { ver: String(next), doc: working };
        // Remove exactly the items we merged (by value), so items queued since,
        // or already removed by another instance, are never lost.
        if (raw.length) await kv.pipeline(raw.map((x) => ['LREM', `cc:queue:${name}`, 1, x]));
        return result;
      }
      delete this.cache[name];
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 40 * (attempt + 1)));
    }
    throw new Error('The data changed while saving. Please try again.');
  },
  async secret() {
    await kv.cmd('SET', 'cc:secret', crypto.randomBytes(32).toString('hex'), 'NX');
    return kv.cmd('GET', 'cc:secret');
  },
};

// Lists that receive public submissions or log lines use the append queue.
const APPENDABLE = ['inbox', 'subscribers', 'activity'];

// Fold queued items (oldest first) into a list, newest at the top. Idempotent by id,
// and subscribers are de-duplicated by email.
function mergePending(name, list, items) {
  for (const item of items) {
    if (item.id && list.some((x) => x.id === item.id)) continue;
    if (name === 'subscribers' && list.some((x) => x.email === item.email)) continue;
    list.unshift(item);
  }
  if (name === 'activity' && list.length > 300) list.length = 300;
}

const impl = backend === 'redis' ? redis : files;
impl.init();

// ------------------------------------------------------------------ public API
async function get(name) {
  const doc = (await impl.get(name)) ?? clone(DOCS[name]);
  const queued = await impl.pending(name);
  if (!queued.length) return doc;
  const view = clone(doc);
  mergePending(name, view, queued);
  return view;
}

// Add an item to the top of a list document (inbox, subscribers, activity).
function append(name, item) {
  return impl.append(name, item);
}

function update(name, fn) {
  return impl.update(name, fn);
}

async function log(user, action, detail) {
  try {
    await append('activity', { id: id(), at: new Date().toISOString(), user: user ? user.email : 'system', action, detail });
  } catch (err) {
    console.error('activity log failed', err.message);
  }
}

// Seed content on first run; called once per server instance.
let readyPromise;
function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      if ((await impl.get('content')) == null) {
        if (backend === 'redis') {
          // NX so two cold-starting instances can't both seed.
          await kv.cmd('SET', 'cc:doc:content', JSON.stringify(seed()), 'NX');
          await kv.cmd('SET', 'cc:ver:content', '1', 'NX');
          delete impl.cache.content;
        } else {
          await impl.set('content', seed());
        }
      }
    })().catch((err) => { readyPromise = null; throw err; });
  }
  return readyPromise;
}

module.exports = { DATA_DIR, backend, ephemeral, id, get, update, append, set: (n, v) => impl.set(n, v), log, ready, secret: () => impl.secret() };
