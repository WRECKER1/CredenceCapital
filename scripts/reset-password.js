// Usage: npm run reset-password -- you@example.com "new-password"
// Creates the user as an admin if they don't exist. Works with local files or,
// when the Upstash env vars are set, with the production Redis database.
const store = require('../lib/store');
const auth = require('../lib/auth');

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 10) {
    console.error('Usage: npm run reset-password -- <email> <password (min 10 chars)>');
    process.exit(1);
  }
  const u = await store.update('users', (users) => {
    let x = users.find((y) => y.email === email.toLowerCase());
    if (!x) {
      x = { id: store.id(), name: email, email: email.toLowerCase(), role: 'admin', createdAt: new Date().toISOString(), version: 0 };
      users.push(x);
    }
    x.password = auth.hashPassword(password);
    x.version = (x.version || 0) + 1;
    return x;
  });
  console.log(`Password set for ${u.email} (${u.role}) in ${store.backend} storage.`);
})().catch((err) => { console.error(err.message); process.exit(1); });
