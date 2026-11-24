// Short content hash of the site's CSS, JS and favicon. Added to their URLs as
// ?v=... so browsers always fetch the new files after a deploy, while still
// caching them long-term between deploys.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const files = ['public/css/site.css', 'public/js/site.js', 'public/img/favicon.svg'];
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(fs.readFileSync(path.join(__dirname, '..', f)));
module.exports = hash.digest('hex').slice(0, 10);
