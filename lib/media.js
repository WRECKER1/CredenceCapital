// Media library storage: local disk, or Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ON_VERCEL = Boolean(process.env.VERCEL);
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const UPLOAD_DIR = process.env.UPLOAD_DIR || (ON_VERCEL ? '/tmp/credence-uploads' : path.join(__dirname, '..', 'uploads'));

const ALLOWED = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf' };
const backend = BLOB_TOKEN ? 'blob' : 'disk';
// Vercel functions accept request bodies up to 4.5 MB.
const MAX_BYTES = ON_VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
const ephemeral = backend === 'disk' && ON_VERCEL;

if (backend === 'disk') fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const allowed = (name) => Boolean(ALLOWED[path.extname(name).toLowerCase()]);

function safeName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
  return `${base}-${crypto.randomBytes(3).toString('hex')}${ext}`;
}

let blob;
const blobLib = () => (blob = blob || require('@vercel/blob'));

async function list() {
  if (backend === 'blob') {
    const out = [];
    let cursor;
    do {
      const page = await blobLib().list({ token: BLOB_TOKEN, prefix: 'media/', cursor, limit: 1000 });
      page.blobs.forEach((b) => out.push({ name: path.basename(b.pathname), url: b.url, size: b.size, at: b.uploadedAt }));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  return fs.readdirSync(UPLOAD_DIR).filter(allowed).map((f) => {
    const st = fs.statSync(path.join(UPLOAD_DIR, f));
    return { name: f, url: `/uploads/${f}`, size: st.size, at: st.mtime };
  }).sort((a, b) => b.at - a.at);
}

// file: { originalname, buffer }
async function save(file) {
  const name = safeName(file.originalname);
  if (backend === 'blob') {
    const out = await blobLib().put(`media/${name}`, file.buffer, {
      access: 'public', token: BLOB_TOKEN, addRandomSuffix: false, contentType: ALLOWED[path.extname(name).toLowerCase()],
    });
    return { name, url: out.url };
  }
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return { name, url: `/uploads/${name}` };
}

async function remove(name) {
  const clean = path.basename(name);
  if (backend === 'blob') {
    const match = (await list()).find((f) => f.name === clean);
    if (match) await blobLib().del(match.url, { token: BLOB_TOKEN });
    return;
  }
  const p = path.join(UPLOAD_DIR, clean);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { backend, ephemeral, UPLOAD_DIR, MAX_BYTES, allowed, list, save, remove };
