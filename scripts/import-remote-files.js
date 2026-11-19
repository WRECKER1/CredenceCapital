// Copies PDFs/images that content still links to on the old Wix site into the
// local media library (UPLOAD_DIR) and rewrites the links, so nothing breaks
// once the old site is switched off.
//
//   npm run import-files              # default: files on credencecapital.in
//   npm run import-files -- --dry-run # just list what would be copied
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const HOSTS = ['www.credencecapital.in', 'credencecapital.in', 'static.wixstatic.com'];
const DRY = process.argv.includes('--dry-run');
const isRemoteFile = (v) => {
  try {
    const u = new URL(v);
    return HOSTS.includes(u.hostname) && /\.(pdf|png|jpe?g|webp|gif)$/i.test(u.pathname);
  } catch { return false; }
};

(async () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const content = store.content;
  const done = new Map();
  let count = 0;
  for (const value of Object.values(content)) {
    const records = Array.isArray(value) ? value : [value];
    for (const rec of records) {
      for (const [key, v] of Object.entries(rec)) {
        if (typeof v !== 'string' || !isRemoteFile(v)) continue;
        if (!done.has(v)) {
          const name = path.basename(new URL(v).pathname).toLowerCase().replace(/[^a-z0-9.]+/g, '-');
          const label = (rec.title || rec.name || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
          const file = `${label}-${name.slice(-12)}`;
          if (DRY) { console.log(`would copy ${v} -> /uploads/${file}`); done.set(v, v); continue; }
          process.stdout.write(`copying ${label} … `);
          try {
            const res = await fetch(v);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(await res.arrayBuffer()));
          } catch (err) {
            console.log(`failed (${err.cause?.code || err.message}) — left as is`);
            continue;
          }
          console.log('ok');
          done.set(v, `/uploads/${file}`);
        }
        if (!DRY) { rec[key] = done.get(v); count++; }
      }
    }
  }
  if (!DRY) store.save('content');
  console.log(DRY ? `${done.size} file(s) would be copied.` : `Copied ${done.size} file(s); updated ${count} link(s).`);
})();
