// Minimal Upstash Redis REST client (no dependency). Used when the site runs on
// Vercel, where there is no persistent disk. Works with the env vars set by the
// Upstash integration on Vercel (KV_REST_API_* or UPSTASH_REDIS_REST_*).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const enabled = Boolean(URL_ && TOKEN);

async function call(path, body) {
  const res = await fetch(`${URL_.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Redis error: ${out.error || res.status}`);
  return out;
}

// cmd('GET', 'key') -> result
async function cmd(...args) {
  const out = await call('', args.map(String));
  if (out.error) throw new Error(`Redis error: ${out.error}`);
  return out.result;
}

// pipeline([['GET','a'], ['INCR','b']]) -> [resultA, resultB]
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const out = await call('/pipeline', cmds.map((c) => c.map(String)));
  return out.map((r) => {
    if (r.error) throw new Error(`Redis error: ${r.error}`);
    return r.result;
  });
}

module.exports = { enabled, cmd, pipeline };
