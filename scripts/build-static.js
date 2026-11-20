// Builds the public website as plain static files in dist/ (no server, no CMS).
// Content comes from data/seed.json. Vercel runs this automatically (see vercel.json).
//
//   npm run build:static
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const helpers = require('../lib/helpers');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
const content = JSON.parse(fs.readFileSync(path.join(root, 'data', 'seed.json'), 'utf8'));

const pages = {
  index: ['home', null],
  about: ['about', 'About'],
  nivesh: ['nivesh', 'Nivesh'],
  partner: ['partner', 'Partner with us'],
  events: ['events', 'Events'],
  research: ['research', 'Research'],
  team: ['team', 'Team'],
  contact: ['contact', 'Contact'],
  404: ['404', 'Page not found'],
};

(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const [file, [view, title]] of Object.entries(pages)) {
    const html = await ejs.renderFile(path.join(root, 'views', `${view}.ejs`), {
      c: content, s: content.settings || {}, h: helpers, page: view, title, visitors: 0, staticSite: true,
    });
    fs.writeFileSync(path.join(out, `${file}.html`), html);
  }

  fs.cpSync(path.join(root, 'public'), path.join(out, 'static'), { recursive: true });
  fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  console.log(`Built ${Object.keys(pages).length} pages into dist/`);
})().catch((err) => { console.error(err); process.exit(1); });
