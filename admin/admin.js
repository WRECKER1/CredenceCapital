/* Credence CMS — single-page admin. No build step, no framework. */
(() => {
  const app = document.getElementById('app');
  const state = { user: null, schema: null, newCount: 0 };

  // ------------------------------------------------------------ utilities
  // DOM builder: el('div', {class: 'x', onclick}, child, 'text', ...). Text is never parsed as HTML.
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k in n && k !== 'list') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const svg = (paths) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 48 48'); s.innerHTML = paths; return s; };
  const logo = () => svg('<rect width="48" height="48" rx="12" fill="#fff"/><path d="M30.5 15.2A11 11 0 1 0 30.5 32.8" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="round"/><path d="M22 28.5l4.5-5 3 3 6-7.5" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>');

  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', headers: { 'X-CC-Admin': '1' }, credentials: 'same-origin' };
    if (opts.body instanceof FormData) init.body = opts.body;
    else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
    const res = await fetch(`/admin/api${path}`, init);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') { state.user = null; renderLogin(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  let toastTimer;
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `show${bad ? ' bad' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 2600);
  }
  const fail = (e) => toast(e.message, true);
  const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
  const ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isImg = (u) => /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u || '');
  const confirmDo = (msg) => window.confirm(msg);

  // ------------------------------------------------------------ login
  function renderLogin() {
    const err = el('p', { class: 'err' });
    const form = el('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const fd = new FormData(form);
      try {
        const { user } = await api('/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
        state.user = user;
        await boot();
      } catch (ex) { err.textContent = ex.message; }
    } },
      el('div', {}, el('h1', {}, 'Sign in'), el('p', { class: 'muted' }, 'Credence Capital content manager')),
      el('div', { class: 'field' }, el('label', { for: 'em' }, 'Email'), el('input', { id: 'em', name: 'email', type: 'email', required: true, autocomplete: 'username' })),
      el('div', { class: 'field' }, el('label', { for: 'pw' }, 'Password'), el('input', { id: 'pw', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
      el('button', { class: 'btn btn-primary', type: 'submit', style: 'justify-content:center;padding:12px' }, 'Sign in'),
      err,
      el('a', { href: '/', class: 'muted small' }, '← Back to website'));
    app.replaceChildren(el('div', { class: 'login' },
      el('div', { class: 'login-art' },
        el('div', { class: 'side-brand', style: 'position:relative;z-index:1' }, logo(), el('div', {}, el('b', {}, 'Credence Capital'), el('small', {}, 'Content manager'))),
        (() => { const h = el('h2'); h.append('Manage your site, sponsors and ', el('em', {}, 'fundraising'), ' in one place.'); return h; })(),
        el('p', {}, 'IIM Lucknow')),
      el('div', { class: 'login-form' }, form)));
    form.querySelector('input').focus();
  }

  // ------------------------------------------------------------ shell
  function nav() {
    const s = state.schema;
    const groups = {};
    const add = (g, item) => (groups[g] = groups[g] || []).push(item);
    Object.entries(s.singletons).forEach(([k, d]) => add(d.group, { href: `#/s/${k}`, label: d.label }));
    Object.entries(s.collections).forEach(([k, d]) => add(d.group, { href: `#/c/${k}`, label: d.label }));
    const order = ['Sponsorship', 'Club', 'Pages', 'General'];
    const here = location.hash || '#/';
    const link = (href, label, badge) => el('a', { class: `item${here === href || (href !== '#/' && here.startsWith(`${href}/`)) ? ' active' : ''}`, href }, label, badge ? el('span', { class: 'badge' }, badge) : null);
    return el('aside', { class: 'side' },
      el('a', { class: 'side-brand', href: '#/' }, logo(), el('div', {}, el('b', {}, 'Credence Capital'), el('small', {}, 'CMS'))),
      link('#/', 'Dashboard'),
      link('#/inbox', 'Leads & inbox', state.newCount || null),
      link('#/subscribers', 'Subscribers'),
      order.filter((g) => groups[g]).map((g) => [el('div', { class: 'side-group' }, g), groups[g].map((i) => link(i.href, i.label))]),
      el('div', { class: 'side-group' }, 'System'),
      link('#/media', 'Media library'),
      state.user.role === 'admin' ? link('#/users', 'Users') : null,
      state.user.role === 'admin' ? link('#/backup', 'Backup & restore') : null,
      link('#/account', 'My account'),
      el('div', { class: 'side-foot' },
        el('div', { class: 'muted', style: 'color:rgba(255,255,255,.5);margin-bottom:8px' }, state.user.email),
        el('a', { href: '/', target: '_blank' }, 'View site ↗'),
        el('a', { onclick: async () => { await api('/logout', { method: 'POST' }); state.user = null; renderLogin(); } }, 'Sign out')));
  }

  function shell(content) {
    const main = el('main', { class: 'main' },
      el('button', { class: 'btn menu-btn', onclick: () => document.body.classList.toggle('menu-open') }, '☰ Menu'),
      content);
    app.replaceChildren(el('div', { class: 'shell' }, nav(), main));
    document.body.classList.remove('menu-open');
    window.scrollTo(0, 0);
  }

  const topbar = (title, sub, ...actions) => el('div', { class: 'topbar' },
    el('div', {}, el('h1', {}, title), sub ? el('p', {}, sub) : null),
    el('div', { class: 'actions' }, actions));

  // ------------------------------------------------------------ dashboard
  async function viewDashboard() {
    const d = await api('/dashboard');
    state.newCount = d.counts.newEnquiries;
    const k = (v, l, cls) => el('div', { class: `panel kpi ${cls || ''}` }, el('b', {}, v), el('span', {}, l));
    const stages = ['new', 'contacted', 'negotiating', 'won', 'lost'];
    shell([
      topbar(`Welcome back${state.user.name && state.user.name !== 'Administrator' ? `, ${state.user.name.split(' ')[0]}` : ''}`, 'Your sponsorship pipeline and site at a glance.',
        el('a', { class: 'btn', href: '/', target: '_blank' }, 'View site ↗'),
        el('a', { class: 'btn btn-primary', href: '#/inbox' }, 'Open inbox')),
      el('div', { class: 'grid kpis' },
        k(d.counts.newEnquiries, 'New enquiries', 'gold'),
        k(d.counts.sponsorship, 'Sponsorship leads'),
        k(inr(d.counts.pledgedAmount), `Pledged across ${d.counts.pledges} pledge(s)`),
        k(d.counts.subscribers, 'Newsletter subscribers'),
        k(d.counts.sponsors, 'Partners listed')),
      el('div', { class: 'grid dash' },
        el('div', { class: 'grid' },
          el('section', { class: 'panel' },
            el('div', { class: 'panel-head' }, el('h2', {}, 'Sponsorship pipeline'), el('a', { href: '#/inbox', class: 'small' }, 'Manage →')),
            el('div', { class: 'panel-pad' }, el('div', { class: 'pipe' }, stages.map((s) => el('div', {}, el('b', {}, d.pipeline[s] || 0), el('span', {}, s)))))),
          el('section', { class: 'panel' },
            el('div', { class: 'panel-head' }, el('h2', {}, 'Latest enquiries')),
            d.recent.length ? el('ul', { class: 'list' }, d.recent.map((e) => el('li', { class: 'clickable', onclick: () => { location.hash = `#/inbox/${e.id}`; } },
              el('div', { class: 'grow' }, el('div', { class: 'title' }, e.organisation || e.name), el('div', { class: 'sub' }, `${e.name} · ${e.email}`)),
              el('span', { class: `pill ${e.type}` }, e.type), el('span', { class: `pill ${e.status}` }, e.status), el('span', { class: 'muted small' }, ago(e.createdAt)))))
              : el('div', { class: 'empty' }, 'No enquiries yet. They will appear here when someone submits a form on the site.'))),
        el('div', { class: 'grid', style: 'align-content:start' },
          el('section', { class: 'panel' },
            el('div', { class: 'panel-head' }, el('h2', {}, 'Active campaigns'), el('a', { href: '#/c/campaigns', class: 'small' }, 'Edit →')),
            el('div', { class: 'panel-pad grid' }, d.campaigns.length ? d.campaigns.map((c) => {
              const p = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
              return el('div', {}, el('div', { style: 'display:flex;justify-content:space-between' }, el('b', {}, c.title), el('span', { class: 'muted' }, `${p}%`)),
                el('div', { class: 'bar' }, el('span', { style: `width:${p}%` })), el('div', { class: 'small muted' }, `${inr(c.raised)} of ${inr(c.goal)}`));
            }) : el('p', { class: 'muted' }, 'No active campaigns.'))),
          el('section', { class: 'panel' },
            el('div', { class: 'panel-head' }, el('h2', {}, 'Recent activity')),
            d.activity.length ? el('ul', { class: 'list' }, d.activity.map((a) => el('li', {},
              el('div', { class: 'grow' }, el('div', { class: 'small' }, el('b', {}, a.user.split('@')[0]), ` ${a.action}${a.detail ? ` — ${a.detail}` : ''}`)),
              el('span', { class: 'muted small' }, ago(a.at))))) : el('div', { class: 'empty' }, 'Nothing yet.')))),
    ]);
  }

  // ------------------------------------------------------------ field rendering
  function fieldInput(f, value) {
    const id = `f_${f.name}`;
    let input;
    switch (f.type) {
      case 'textarea':
        input = el('textarea', { id, name: f.name, rows: 5 });
        input.value = value || '';
        break;
      case 'lines':
        input = el('textarea', { id, name: f.name, rows: 6 });
        input.value = (value || []).join('\n');
        break;
      case 'boolean':
        return el('div', { class: 'field' }, el('label', { class: 'check' }, el('input', { type: 'checkbox', name: f.name, checked: !!value }), f.label), f.help ? el('div', { class: 'help' }, f.help) : null);
      case 'select':
        input = el('select', { id, name: f.name }, f.options.map((o) => el('option', { value: o, selected: o === value }, o)));
        break;
      case 'image':
      case 'file': {
        input = el('input', { id, name: f.name, type: 'text', value: value || '', placeholder: f.type === 'image' ? '/uploads/… or https://…' : 'Upload a PDF or paste a link' });
        const thumb = (u) => (isImg(u) ? el('img', { class: 'preview', src: u, alt: '' }) : el('div', { class: 'preview' }, u ? 'PDF' : ''));
        const preview = thumb(value);
        input.addEventListener('change', () => input.parentNode.querySelector('.preview').replaceWith(thumb(input.value)));
        const wrap = el('div', { class: 'media-field' }, preview, input,
          el('button', { type: 'button', class: 'btn', onclick: () => pickMedia((url) => { input.value = url; input.dispatchEvent(new Event('change')); }) }, 'Choose…'),
          el('button', { type: 'button', class: 'btn btn-icon', title: 'Clear', onclick: () => { input.value = ''; input.dispatchEvent(new Event('change')); } }, '×'));
        return el('div', { class: 'field' }, el('label', { for: id }, f.label), wrap, f.help ? el('div', { class: 'help' }, f.help) : null);
      }
      default:
        input = el('input', { id, name: f.name, type: { number: 'number', url: 'url', email: 'email', date: 'date' }[f.type] || 'text', value: value ?? '' });
        if (f.type === 'url') input.type = 'text';
    }
    if (f.required) input.required = true;
    return el('div', { class: 'field' }, el('label', { for: id }, f.label, f.required ? ' *' : ''), input,
      f.help ? el('div', { class: 'help' }, f.help) : null,
      f.type === 'lines' ? el('div', { class: 'help' }, 'One item per line.') : null);
  }

  function readForm(form, fields) {
    const out = {};
    fields.forEach((f) => {
      const n = form.elements[f.name];
      if (!n) return;
      out[f.name] = f.type === 'boolean' ? n.checked : n.value;
    });
    return out;
  }

  // Lay out short fields two-per-row for a tidier form.
  function layoutFields(fields, data) {
    const out = [];
    let pair = [];
    const flush = () => { if (pair.length) out.push(pair.length === 2 ? el('div', { class: 'two' }, pair) : pair[0]); pair = []; };
    fields.forEach((f) => {
      const node = fieldInput(f, data[f.name]);
      const short = ['text', 'email', 'url', 'number', 'date', 'select'].includes(f.type) && !f.help;
      if (short) { pair.push(node); if (pair.length === 2) flush(); } else { flush(); out.push(node); }
    });
    flush();
    return out;
  }

  // ------------------------------------------------------------ singletons
  async function viewSingleton(key) {
    const def = state.schema.singletons[key];
    if (!def) return viewNotFound();
    const data = await api(`/content/${key}`);
    const err = el('p', { class: 'err' });
    const form = el('form', { class: 'form panel panel-pad', onsubmit: async (e) => {
      e.preventDefault();
      try { await api(`/content/${key}`, { method: 'PUT', body: readForm(form, def.fields) }); toast('Saved — live on the site'); } catch (ex) { err.textContent = ex.message; }
    } }, layoutFields(def.fields, data), el('div', { class: 'form-foot' }, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes'), err));
    const preview = { home: '/', about: '/about', partner: '/partner' }[key] || '/';
    shell([topbar(def.label, def.description, el('a', { class: 'btn', href: preview, target: '_blank' }, 'Preview ↗')), el('div', { style: 'max-width:920px' }, form)]);
  }

  // ------------------------------------------------------------ collections
  async function viewCollection(name) {
    const def = state.schema.collections[name];
    if (!def) return viewNotFound();
    let items = await api(`/c/${name}`);
    const q = el('input', { type: 'search', placeholder: `Search ${def.label.toLowerCase()}…`, style: 'max-width:280px' });
    const listWrap = el('section', { class: 'panel' });
    const sorted = !!def.sortBy;

    const move = async (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      items = await api(`/c/${name}/reorder`, { method: 'POST', body: { ids: items.map((x) => x.id) } }).catch(fail) || items;
      draw();
    };
    const imgField = def.fields.find((f) => f.type === 'image');
    const draw = () => {
      const term = q.value.trim().toLowerCase();
      const shown = items.map((x, i) => [x, i]).filter(([x]) => !term || JSON.stringify(x).toLowerCase().includes(term));
      listWrap.replaceChildren(shown.length ? el('ul', { class: 'list' }, shown.map(([x, i]) => {
        const img = imgField && x[imgField.name];
        const title = x[def.titleField] || '(untitled)';
        return el('li', { class: 'clickable', onclick: (e) => { if (!e.target.closest('button')) location.hash = `#/c/${name}/${x.id}`; } },
          img && isImg(img) ? el('img', { class: 'thumb', src: img, alt: '' }) : el('span', { class: 'thumb' }, String(title).slice(0, 2).toUpperCase()),
          el('div', { class: 'grow' }, el('div', { class: 'title' }, title), def.subtitleField ? el('div', { class: 'sub' }, String(x[def.subtitleField] ?? '')) : null),
          x.status ? el('span', { class: `pill ${x.status}` }, x.status) : null,
          x.featured ? el('span', { class: 'pill won' }, 'featured') : null,
          x.visible === false ? el('span', { class: 'pill' }, 'hidden') : null,
          sorted || term ? null : [
            el('button', { class: 'btn btn-icon', title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
            el('button', { class: 'btn btn-icon', title: 'Move down', disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓')],
          el('button', { class: 'btn btn-icon btn-danger', title: 'Delete', onclick: async () => {
            if (!confirmDo(`Delete "${title}"? This cannot be undone.`)) return;
            await api(`/c/${name}/${x.id}`, { method: 'DELETE' }).catch(fail);
            items = items.filter((y) => y.id !== x.id); draw(); toast('Deleted');
          } }, '🗑'));
      })) : el('div', { class: 'empty' }, term ? 'No matches.' : `Nothing here yet. Click “Add new” to create the first entry.`));
    };
    q.addEventListener('input', draw);
    draw();
    shell([
      topbar(def.label, def.description || (sorted ? 'Sorted by date on the website.' : 'Use the arrows to set the order shown on the website.'),
        q, el('a', { class: 'btn btn-primary', href: `#/c/${name}/new` }, '+ Add new')),
      listWrap,
    ]);
  }

  async function viewItem(name, id) {
    const def = state.schema.collections[name];
    if (!def) return viewNotFound();
    const items = await api(`/c/${name}`);
    const isNew = id === 'new';
    const data = isNew ? Object.fromEntries(def.fields.map((f) => [f.name, f.type === 'boolean' ? (f.name === 'visible') : f.type === 'select' ? f.options[0] : ''])) : items.find((x) => x.id === id);
    if (!data) return viewNotFound();
    const err = el('p', { class: 'err' });
    const form = el('form', { class: 'form panel panel-pad', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const body = readForm(form, def.fields);
        if (isNew) await api(`/c/${name}`, { method: 'POST', body });
        else await api(`/c/${name}/${id}`, { method: 'PUT', body });
        toast(isNew ? 'Created — live on the site' : 'Saved — live on the site');
        location.hash = `#/c/${name}`;
      } catch (ex) { err.textContent = ex.message; }
    } }, layoutFields(def.fields, data),
      el('div', { class: 'form-foot' }, el('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Create' : 'Save changes'), el('a', { class: 'btn', href: `#/c/${name}` }, 'Cancel'), err));
    shell([topbar(isNew ? `New — ${def.label}` : (data[def.titleField] || def.label), null, el('a', { class: 'btn', href: `#/c/${name}` }, '← Back to list')), el('div', { style: 'max-width:920px' }, form)]);
    form.querySelector('input,textarea,select')?.focus();
  }

  // ------------------------------------------------------------ inbox
  async function viewInbox(selectedId) {
    const { items, statuses } = await api('/inbox');
    state.newCount = items.filter((x) => x.status === 'new').length;
    let type = sessionStorage.getItem('cc_inbox_type') || 'all';
    let status = sessionStorage.getItem('cc_inbox_status') || 'open';
    let selected = items.find((x) => x.id === selectedId) || null;
    const listPanel = el('section', { class: 'panel' });
    const detailPanel = el('section', { class: 'panel panel-pad detail' });
    const typeTabs = el('div', { class: 'tabs' });
    const statusSel = el('select', { style: 'width:auto', onchange: () => { status = statusSel.value; sessionStorage.setItem('cc_inbox_status', status); draw(); } },
      [['open', 'Open (not archived)'], ['all', 'All statuses'], ...statuses.map((s) => [s, s[0].toUpperCase() + s.slice(1)])].map(([v, l]) => el('option', { value: v, selected: v === status }, l)));

    const drawTabs = () => typeTabs.replaceChildren(...[['all', 'All'], ['sponsorship', 'Sponsorship'], ['pledge', 'Pledges'], ['contact', 'Messages']].map(([v, l]) =>
      el('button', { class: `tab${type === v ? ' active' : ''}`, onclick: () => { type = v; sessionStorage.setItem('cc_inbox_type', v); draw(); } }, l, ` (${items.filter((x) => v === 'all' || x.type === v).length})`)));

    const drawDetail = () => {
      if (!selected) { detailPanel.replaceChildren(el('div', { class: 'empty' }, 'Select an enquiry to see details.')); return; }
      const e = selected;
      const notes = el('textarea', { rows: 4, placeholder: 'Internal notes — call summary, proposal sent, next steps…' });
      notes.value = e.notes || '';
      const amount = el('input', { type: 'number', value: e.amount ?? '', min: 0, step: 1000 });
      const sel = el('select', {}, statuses.map((s) => el('option', { value: s, selected: s === e.status }, s[0].toUpperCase() + s.slice(1))));
      const rows = [['Type', e.type], ['Received', new Date(e.createdAt).toLocaleString('en-IN')], ['Email', e.email], ['Phone', e.phone], ['Organisation', e.organisation], ['Designation', e.designation], ['Interested in', e.interest], ['Campaign', e.campaign]].filter(([, v]) => v);
      detailPanel.replaceChildren(
        el('div', { style: 'display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px' },
          el('div', {}, el('h1', { style: 'font-size:1.4rem' }, e.organisation || e.name), el('p', { class: 'muted', style: 'margin:4px 0 0' }, e.organisation ? e.name : e.email)),
          el('a', { class: 'btn btn-gold', href: `mailto:${e.email}?subject=${encodeURIComponent(`Credence Capital × ${e.organisation || e.name}`)}` }, 'Reply by email')),
        el('dl', {}, rows.map(([k, v]) => [el('dt', {}, k), el('dd', {}, k === 'Email' ? el('a', { href: `mailto:${v}` }, v) : v)])),
        e.message ? el('div', { class: 'msg' }, e.message) : null,
        el('div', { class: 'form' },
          el('div', { class: 'two' },
            el('div', { class: 'field' }, el('label', {}, 'Stage'), sel),
            el('div', { class: 'field' }, el('label', {}, e.type === 'pledge' ? 'Pledged amount (₹)' : 'Deal value (₹)'), amount)),
          el('div', { class: 'field' }, el('label', {}, 'Notes'), notes),
          el('div', { class: 'actions' },
            el('button', { class: 'btn btn-primary', onclick: async () => {
              try {
                const upd = await api(`/inbox/${e.id}`, { method: 'PATCH', body: { status: sel.value, notes: notes.value, amount: amount.value === '' ? undefined : amount.value } });
                Object.assign(e, upd); toast('Updated'); draw();
              } catch (ex) { fail(ex); }
            } }, 'Save'),
            el('button', { class: 'btn btn-danger', onclick: async () => {
              if (!confirmDo('Delete this enquiry permanently?')) return;
              await api(`/inbox/${e.id}`, { method: 'DELETE' }).catch(fail);
              items.splice(items.indexOf(e), 1); selected = null; draw(); toast('Deleted');
            } }, 'Delete'))));
    };

    const draw = () => {
      drawTabs();
      const shown = items.filter((x) => (type === 'all' || x.type === type) && (status === 'all' || (status === 'open' ? x.status !== 'archived' : x.status === status)));
      listPanel.replaceChildren(shown.length ? el('ul', { class: 'list' }, shown.map((x) => el('li', { class: `clickable${selected === x ? ' selected' : ''}`, onclick: () => { selected = x; history.replaceState(null, '', `#/inbox/${x.id}`); draw(); } },
        el('div', { class: 'grow' }, el('div', { class: 'title' }, x.organisation || x.name), el('div', { class: 'sub' }, x.type === 'pledge' && x.amount ? `${inr(x.amount)} · ${x.campaign}` : (x.message || x.email))),
        el('div', { style: 'text-align:right' }, el('span', { class: `pill ${x.status}` }, x.status), el('div', { class: 'muted small' }, ago(x.createdAt))))))
        : el('div', { class: 'empty' }, 'No enquiries match this filter.'));
      drawDetail();
    };
    draw();
    shell([
      topbar('Leads & inbox', 'Sponsorship enquiries, fundraising pledges and contact messages from the website.',
        statusSel, el('a', { class: 'btn', href: '/admin/api/inbox.csv' }, 'Export CSV')),
      typeTabs,
      el('div', { class: 'inbox' }, listPanel, detailPanel),
    ]);
  }

  // ------------------------------------------------------------ subscribers
  async function viewSubscribers() {
    let subs = await api('/subscribers');
    const panel = el('section', { class: 'panel' });
    const draw = () => panel.replaceChildren(subs.length ? el('ul', { class: 'list' }, subs.map((s) => el('li', {},
      el('div', { class: 'grow' }, el('div', { class: 'title' }, s.email), el('div', { class: 'sub' }, `Subscribed ${ago(s.createdAt)}`)),
      el('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
        if (!confirmDo(`Remove ${s.email}?`)) return;
        await api(`/subscribers/${s.id}`, { method: 'DELETE' }).catch(fail); subs = subs.filter((x) => x !== s); draw();
      } }, 'Remove'))))
      : el('div', { class: 'empty' }, 'No subscribers yet. The sign-up form is in the website footer.'));
    draw();
    shell([topbar('Newsletter subscribers', `${subs.length} subscriber(s). Export to your email tool to send the market outlook.`,
      el('button', { class: 'btn', onclick: () => navigator.clipboard.writeText(subs.map((s) => s.email).join(', ')).then(() => toast('Emails copied')) }, 'Copy all emails'),
      el('a', { class: 'btn btn-primary', href: '/admin/api/subscribers.csv' }, 'Export CSV')), panel]);
  }

  // ------------------------------------------------------------ media
  function mediaGrid(files, { onPick, onDelete }) {
    if (!files.length) return el('div', { class: 'empty' }, 'No files uploaded yet.');
    return el('div', { class: 'media-grid' }, files.map((f) => {
      const img = isImg(f.url);
      return el('div', { class: `media-item${onPick ? ' pick' : ''}`, onclick: onPick ? () => onPick(f.url) : null },
        el('div', { class: 'img', style: img ? `background-image:url("${encodeURI(f.url)}")` : '' }, img ? null : 'PDF'),
        el('div', { class: 'meta' }, el('span', { title: f.name }, f.name),
          onDelete ? el('span', {},
            el('button', { class: 'btn btn-icon btn-sm', title: 'Copy URL', onclick: (e) => { e.stopPropagation(); navigator.clipboard.writeText(f.url).then(() => toast('URL copied')); } }, '⧉'),
            el('button', { class: 'btn btn-icon btn-sm btn-danger', title: 'Delete', onclick: (e) => { e.stopPropagation(); onDelete(f); } }, '×')) : null));
    }));
  }

  function dropzone(onDone) {
    const input = el('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif,application/pdf', class: 'hide' });
    const zone = el('div', { class: 'drop', onclick: () => input.click() }, el('b', {}, 'Drop files here or click to upload'), el('div', { class: 'small' }, 'PNG, JPG, WEBP, GIF, AVIF or PDF · up to 15 MB each'), input);
    const send = async (files) => {
      if (!files.length) return;
      const fd = new FormData();
      [...files].forEach((f) => fd.append('files', f));
      zone.firstChild.textContent = 'Uploading…';
      try { const out = await api('/media', { method: 'POST', body: fd }); toast(`Uploaded ${out.length} file(s)`); onDone(out); } catch (e) { fail(e); }
      zone.firstChild.textContent = 'Drop files here or click to upload';
    };
    input.addEventListener('change', () => send(input.files));
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); send(e.dataTransfer.files); });
    return zone;
  }

  async function viewMedia() {
    let files = await api('/media');
    const grid = el('div');
    const draw = () => grid.replaceChildren(mediaGrid(files, { onDelete: async (f) => {
      if (!confirmDo(`Delete ${f.name}? Any page using it will show a broken image.`)) return;
      await api(`/media/${encodeURIComponent(f.name)}`, { method: 'DELETE' }).catch(fail);
      files = files.filter((x) => x !== f); draw();
    } }));
    draw();
    shell([topbar('Media library', 'Logos, photos, sponsorship decks and research PDFs.'),
      dropzone(async () => { files = await api('/media'); draw(); }), grid]);
  }

  async function pickMedia(cb) {
    let files = await api('/media').catch((e) => { fail(e); return null; });
    if (!files) return;
    const close = () => overlay.remove();
    const grid = el('div');
    const pick = (url) => { cb(url); close(); };
    const draw = () => grid.replaceChildren(mediaGrid(files, { onPick: pick }));
    const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(); } },
      el('div', { class: 'modal' },
        el('div', { class: 'panel-head' }, el('h2', {}, 'Choose a file'), el('button', { class: 'btn btn-icon', onclick: close }, '×')),
        el('div', { class: 'panel-pad' }, dropzone((up) => { if (up.length === 1) pick(up[0].url); else api('/media').then((f) => { files = f; draw(); }); }), grid)));
    draw();
    document.body.append(overlay);
  }

  // ------------------------------------------------------------ users & account
  async function viewUsers() {
    let users = await api('/users');
    const panel = el('section', { class: 'panel' });
    const draw = () => panel.replaceChildren(el('ul', { class: 'list' }, users.map((u) => el('li', {},
      el('span', { class: 'thumb' }, (u.name || u.email).slice(0, 2).toUpperCase()),
      el('div', { class: 'grow' }, el('div', { class: 'title' }, u.name), el('div', { class: 'sub' }, `${u.email} · last sign-in ${u.lastLogin ? ago(u.lastLogin) : 'never'}`)),
      el('span', { class: `pill ${u.role === 'admin' ? 'won' : ''}` }, u.role),
      u.id === state.user.id ? el('span', { class: 'muted small' }, 'you') : el('button', { class: 'btn btn-sm btn-danger', onclick: async () => {
        if (!confirmDo(`Remove ${u.email}'s access?`)) return;
        await api(`/users/${u.id}`, { method: 'DELETE' }).catch(fail); users = users.filter((x) => x !== u); draw();
      } }, 'Remove')))));
    draw();
    const err = el('p', { class: 'err' });
    const form = el('form', { class: 'form panel panel-pad', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      const fd = Object.fromEntries(new FormData(form));
      try { const u = await api('/users', { method: 'POST', body: fd }); users.push(u); draw(); form.reset(); toast('User added — share the password with them securely'); } catch (ex) { err.textContent = ex.message; }
    } },
      el('h2', {}, 'Add a team member'),
      el('div', { class: 'two' },
        el('div', { class: 'field' }, el('label', {}, 'Name'), el('input', { name: 'name', type: 'text' })),
        el('div', { class: 'field' }, el('label', {}, 'Email'), el('input', { name: 'email', type: 'email', required: true }))),
      el('div', { class: 'two' },
        el('div', { class: 'field' }, el('label', {}, 'Temporary password'), el('input', { name: 'password', type: 'text', required: true, minLength: 10 }), el('div', { class: 'help' }, 'At least 10 characters. They can change it under My account.')),
        el('div', { class: 'field' }, el('label', {}, 'Role'), el('select', { name: 'role' }, el('option', { value: 'editor' }, 'Editor — content, media & leads'), el('option', { value: 'admin' }, 'Admin — everything incl. users & backups')))),
      el('div', { class: 'actions' }, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Add user'), err));
    shell([topbar('Users', 'Who can sign in to the CMS.'), el('div', { class: 'grid', style: 'max-width:880px' }, panel, form)]);
  }

  function viewAccount() {
    const err = el('p', { class: 'err' });
    const form = el('form', { class: 'form panel panel-pad', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      const fd = Object.fromEntries(new FormData(form));
      if (fd.next !== fd.confirm) { err.textContent = 'New passwords do not match'; return; }
      try { await api('/password', { method: 'PUT', body: fd }); form.reset(); toast('Password changed'); } catch (ex) { err.textContent = ex.message; }
    } },
      el('h2', {}, 'Change password'),
      el('div', { class: 'field' }, el('label', {}, 'Current password'), el('input', { name: 'current', type: 'password', required: true, autocomplete: 'current-password' })),
      el('div', { class: 'two' },
        el('div', { class: 'field' }, el('label', {}, 'New password'), el('input', { name: 'next', type: 'password', required: true, minLength: 10, autocomplete: 'new-password' })),
        el('div', { class: 'field' }, el('label', {}, 'Confirm new password'), el('input', { name: 'confirm', type: 'password', required: true, autocomplete: 'new-password' }))),
      el('div', { class: 'actions' }, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Update password'), err));
    shell([topbar('My account', `${state.user.name} · ${state.user.email} · ${state.user.role}`), el('div', { style: 'max-width:640px' }, form)]);
  }

  function viewBackup() {
    const file = el('input', { type: 'file', accept: 'application/json' });
    shell([topbar('Backup & restore', 'Download everything (content, leads, subscribers) or restore site content from a backup.'),
      el('div', { class: 'grid', style: 'max-width:720px' },
        el('section', { class: 'panel panel-pad' }, el('h2', {}, 'Download a backup'), el('p', { class: 'muted' }, 'A single JSON file with all site content, enquiries and subscribers. Uploaded files in the media library are not included.'),
          el('a', { class: 'btn btn-primary', href: '/admin/api/export' }, 'Download backup')),
        el('section', { class: 'panel panel-pad' }, el('h2', {}, 'Restore content'), el('p', { class: 'muted' }, 'Replaces all website content with the content in the backup file. Leads, subscribers and users are not changed.'),
          el('div', { class: 'actions' }, file, el('button', { class: 'btn btn-danger', onclick: async () => {
            const f = file.files[0];
            if (!f) return toast('Choose a backup file first', true);
            if (!confirmDo('Replace ALL current website content with this backup?')) return;
            try { await api('/import', { method: 'POST', body: JSON.parse(await f.text()) }); toast('Content restored'); } catch (e) { fail(e); }
          } }, 'Restore')))),
    ]);
  }

  function viewNotFound() { shell([topbar('Not found', 'That section does not exist.'), el('a', { class: 'btn', href: '#/' }, 'Go to dashboard')]); }

  // ------------------------------------------------------------ router
  async function route() {
    if (!state.user) return;
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    try {
      switch (parts[0]) {
        case undefined: return await viewDashboard();
        case 's': return await viewSingleton(parts[1]);
        case 'c': return parts[2] ? await viewItem(parts[1], parts[2]) : await viewCollection(parts[1]);
        case 'inbox': return await viewInbox(parts[1]);
        case 'subscribers': return await viewSubscribers();
        case 'media': return await viewMedia();
        case 'users': return state.user.role === 'admin' ? await viewUsers() : viewNotFound();
        case 'backup': return state.user.role === 'admin' ? viewBackup() : viewNotFound();
        case 'account': return viewAccount();
        default: return viewNotFound();
      }
    } catch (e) { if (state.user) fail(e); }
  }

  async function boot() {
    state.schema = await api('/schema');
    const d = await api('/dashboard').catch(() => null);
    if (d) state.newCount = d.counts.newEnquiries;
    if (!state.routed) { window.addEventListener('hashchange', route); state.routed = true; }
    route();
  }

  api('/me').then(({ user }) => { state.user = user; boot(); }).catch(() => { if (!state.user) renderLogin(); });
})();
