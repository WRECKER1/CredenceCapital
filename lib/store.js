// Tiny JSON-file data store with atomic writes.
// Content, inbox, subscribers and users live in DATA_DIR as separate files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(__dirname, '..', 'data', 'seed.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const files = {
  content: path.join(DATA_DIR, 'content.json'),
  inbox: path.join(DATA_DIR, 'inbox.json'),
  subscribers: path.join(DATA_DIR, 'subscribers.json'),
  users: path.join(DATA_DIR, 'users.json'),
  activity: path.join(DATA_DIR, 'activity.json'),
};

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function writeJSON(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const cache = {
  content: readJSON(files.content, () => {
    const seed = readJSON(SEED_FILE, {});
    writeJSON(files.content, seed);
    return seed;
  }),
  inbox: readJSON(files.inbox, []),
  subscribers: readJSON(files.subscribers, []),
  users: readJSON(files.users, []),
  activity: readJSON(files.activity, []),
};

const id = () => crypto.randomBytes(6).toString('hex');

function save(name) {
  writeJSON(files[name], cache[name]);
}

function log(user, action, detail) {
  cache.activity.unshift({ at: new Date().toISOString(), user: user ? user.email : 'system', action, detail });
  cache.activity = cache.activity.slice(0, 300);
  save('activity');
}

module.exports = {
  DATA_DIR,
  id,
  get content() { return cache.content; },
  set content(v) { cache.content = v; save('content'); },
  get inbox() { return cache.inbox; },
  get subscribers() { return cache.subscribers; },
  get users() { return cache.users; },
  get activity() { return cache.activity; },
  save,
  log,
};
