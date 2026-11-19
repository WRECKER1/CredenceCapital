// Usage: npm run reset-password -- you@example.com "new-password"
// Creates the user as an admin if they don't exist.
const store = require('../lib/store');
const auth = require('../lib/auth');
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npm run reset-password -- <email> <password (min 10 chars)>');
  process.exit(1);
}
let u = store.users.find((x) => x.email === email.toLowerCase());
if (!u) {
  u = { id: store.id(), name: email, email: email.toLowerCase(), role: 'admin', createdAt: new Date().toISOString(), version: 0 };
  store.users.push(u);
}
u.password = auth.hashPassword(password);
u.version = (u.version || 0) + 1;
store.save('users');
console.log(`Password set for ${u.email} (${u.role}).`);
