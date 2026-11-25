# Credence Capital — Website & CMS

Website and content-management system for **Credence Capital, the Investment Club of IIM Lucknow**. The site is built for sponsors and fundraising.

- **Public site:** Home, About, Partner with us, Events, Research, Team and Contact pages. Pages are rendered on the server, so they're fast and search-engine friendly.
- **CMS at `/admin`:** edit every piece of text, list and image on the site, track sponsorship leads and pledges, manage newsletter subscribers, upload media, add team members as users, and back up the site.

No external database. Everything is stored in JSON files under `data/`.

## Quick start

```bash
npm install
ADMIN_EMAIL=you@iiml.ac.in ADMIN_PASSWORD='choose-a-strong-one' npm start
# → http://localhost:3000        website
# → http://localhost:3000/admin  CMS
```

On first boot an admin account is created. If `ADMIN_PASSWORD` isn't set, a random password is printed to the console. Locked out? Run `npm run reset-password -- you@iiml.ac.in 'new-password'`.

## What the CMS manages

| Section | What it controls |
|---|---|
| **Dashboard** | New leads, pipeline by stage, total pledged, campaign progress, recent activity |
| **Leads & inbox** | Sponsorship enquiries, campaign pledges and contact messages. Move each through *new → contacted → negotiating → won/lost*, record deal value and notes, reply by email, export to CSV |
| **Subscribers** | Newsletter sign-ups from the footer, with CSV export |
| **Sponsorship tiers / benefits / FAQs** | The packages and pitch on the Partner page |
| **Fundraising campaigns** | Goal, amount raised, deadline and use of funds; shown with live progress bars |
| **Sponsors & partners** | The logo wall. Empty spots show as "Your brand here" slots that link to the enquiry form |
| **Events** | Upcoming and past events are split by date automatically. Events marked "Open for sponsorship" get a *Sponsor this event* button |
| **Research, Team, Testimonials, Key numbers** | The matching sections of the site |
| **Press & track record** | Media coverage. Items with a highlight figure (e.g. 175%) appear in the track-record band |
| **Past speakers** | The "Speakers who have joined us" grid shown to sponsors |
| **Pages & Site settings** | Hero copy, About, Partner page text, contact details, socials, announcement bar, sponsorship deck PDF, logo |
| **Website visitors** | A built-in, privacy-friendly counter. The total of unique visitors shows in the footer (switch it off in Site settings). The dashboard shows today, the last 7 and 30 days, a daily chart and the most viewed pages. It ignores bots and the CMS, uses a first-party cookie instead of third-party trackers, and never stores IP addresses. Data is kept in `DATA_DIR/analytics.json`, or in Redis on Vercel |
| **Media library** | Upload images and PDFs (drag & drop) and pick them from any field |
| **Users** | *Admins* can do everything. *Editors* can edit content, media and leads, but can't manage users or backups |
| **Backup & restore** | Download all data as one JSON file and restore content from it |

Tip: in headlines, wrap words in `*asterisks*` to show them in gold italics.

## Adding fields

The content model is in `lib/schema.js`. Add a field there and it appears in the CMS automatically. Then use it in the matching template in `views/`.

## Deploying to Vercel

### Option A: public website only (current setup, no CMS)

`vercel.json` builds the site as plain static pages from `data/seed.json` (`npm run build:static` → `dist/`). It needs no database, add-ons or environment variables.

1. In Vercel, go to **Add New → Project**, import `WRECKER1/CredenceCapital` and click **Deploy**.

In this mode:

- The site's forms (sponsorship, pledge, contact, newsletter) open the visitor's email app with a pre-filled message to the club's email.
- The visitor counter and the CMS link are hidden.
- To change content, edit `data/seed.json` and push; Vercel redeploys automatically.
- Press logos live in `public/img/press/` (set each press item's `logo`).
- Partner logos live in `public/img/partners/`. Add the file there and set the sponsor's `logo` in `data/seed.json` to `/static/img/partners/<file>`. SVG works best; the logo shows in full colour.
- The CC monogram is a vector (`public/img/logo-cc.svg`, also inlined in `views/partials/logo.ejs`), redrawn from the club's logo in a Times-style serif.

### Option B: full site with the CMS

1. Replace `vercel.json` with `vercel.cms.json`. This runs the whole app as one serverless function.
2. Under the project's **Storage** tab, create **Upstash for Redis** and **Blob**, and connect both to the project.
3. Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` under **Settings → Environment Variables**.
4. Redeploy and open `/admin`.

In this mode:

| What | Stored in | Env vars (set automatically when you connect the add-on) |
|---|---|---|
| Content, leads, subscribers, users, activity, visitor counts | Upstash Redis | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| Media uploads | Vercel Blob | `BLOB_READ_WRITE_TOKEN` |

- If storage isn't connected, the CMS shows a red warning that changes won't be kept.
- Uploads through the CMS are capped at 4 MB on Vercel. Link to bigger files instead.
- `SESSION_SECRET` is optional; one is generated and stored in Redis if it's not set.

## Deploying elsewhere (Docker, VPS, Render, Railway)

Any host with a **persistent disk** works with no add-ons: data is stored as files.

- **Docker:** `docker build -t credence . && docker run -p 3000:3000 -v credence-data:/data -e ADMIN_PASSWORD=... credence`
- **Render / Railway / Fly.io / a VPS:** run `npm start` and mount a disk. Point `DATA_DIR` and `UPLOAD_DIR` at it.

| Env var | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DATA_DIR` | Where content, leads, users and visitor counts live (default `./data`) |
| `UPLOAD_DIR` | Where uploaded media lives (default `./uploads`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (used only when no users exist) |
| `SESSION_SECRET` | Optional; otherwise generated and stored with the data |
| `NODE_ENV=production` | Marks cookies `Secure` (serve over HTTPS) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Optional: use Upstash Redis instead of files |
| `BLOB_READ_WRITE_TOKEN` | Optional: use Vercel Blob instead of the uploads folder |

Back up your data regularly. You can use *Backup & restore* in the CMS.

## How storage works

`lib/store.js` exposes the same async API for both backends.

- **Redis writes are compare-and-set.** If two requests change the same record at once, one retries on the fresh data instead of overwriting the other.
- **Public submissions go through an append-only queue.** Sponsor enquiries, pledges and newsletter sign-ups never conflict with CMS edits and can't be lost.
- **Testing:** this was checked with 180 simultaneous enquiries across two server instances while an admin edited the inbox. All were saved.

## Content imported from the old site

`data/seed.json` is filled with content from the current Wix site (credencecapital.in):

- Club description, founding year (2005) and the fund disclaimer
- Contact details and Facebook/X links
- The 2023–25 fund managers, with 2022–24 listed as alumni
- Faculty testimonials and media coverage, with the documented returns
- Nivesh 2018/2019/2021 and the Screener.in workshop
- Past speakers
- All sector reports, *The Bottom Line* issues and blog posts

**Copy the PDFs off Wix before you shut it down.** The research links still point at files hosted on credencecapital.in (134 MB in total). Once the new site is running, run this command. It downloads each file into the media library and rewrites the links:

```bash
npm run import-files -- --dry-run   # preview
npm run import-files
```

## Content from the Nivesh 2026 sponsorship deck

The site also uses the club's Nivesh 2026 deck:

- **Nivesh page (`/nivesh`):** the summit format, Investowise year-on-year numbers and participating campuses.
- **Sponsorship brackets:** Title (₹2L+) and Power (₹1L+), with a benefits table generated from each tier's benefits list.
- **About page:** the IIM Lucknow section and the institute's notable speakers.
- **Club pillars:** the four "what we do" points.
- **Past speakers:** the full list.
- **Team:** Credence Team 2026–27 and 2027–28, with photos.
- **Partners:** Motilal Oswal and Screener as past Investowise partners.
- **Mint:** the 2023 article.
- **Gallery:** campus and event photos.

The deck's photos ship in `public/img/seed/` as starting content. Uploads made through the CMS go to the media library.

## Still to update in the CMS

- **Dates and goals:** Nivesh 2026 and Investowise 2026–27 have *placeholder dates and fundraising goals*. "Raised" starts at ₹0.
- **Links:** add the Mint article's URL under *Press & track record*.
- **Images:** speaker photos, sponsor logos, the sponsorship deck PDF and your logo.
- **Details:** LinkedIn and Instagram URLs, and team members' LinkedIn profiles.

## Security notes

- Passwords are hashed with scrypt. Sessions are HMAC-signed, HTTP-only, `SameSite=Strict` cookies.
- Admin write requests need a custom header, which protects against CSRF.
- Login and public forms are rate-limited. Forms include a honeypot field against spam bots.
- Uploads are limited to images and PDFs (no SVG/HTML) and served with a restrictive CSP.
- No payments are taken on the site. Pledges are recorded as leads, and the club follows up through IIM Lucknow's official channels.
