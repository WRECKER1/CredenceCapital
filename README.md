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
| **Pages & Site settings** | Hero copy, About, Partner page text, contact details, socials, announcement bar, sponsorship deck PDF, logo |
| **Media library** | Upload images and PDFs (drag & drop) and pick them from any field |
| **Users** | *Admins* can do everything. *Editors* can edit content, media and leads, but can't manage users or backups |
| **Backup & restore** | Download all data as one JSON file and restore content from it |

Tip: in headlines, wrap words in `*asterisks*` to show them in gold italics.

## Adding fields

The content model is in `lib/schema.js`. Add a field there and it appears in the CMS automatically. Then use it in the matching template in `views/`.

## Deploying

The app needs a host with a **persistent disk**, because content and uploads are files. It does not suit serverless hosts like Vercel.

- **Docker:** `docker build -t credence . && docker run -p 3000:3000 -v credence-data:/data -e ADMIN_PASSWORD=... credence`
- **Render / Railway / Fly.io / a VPS:** run `npm start` and mount a disk. Point `DATA_DIR` and `UPLOAD_DIR` at it.

| Env var | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `DATA_DIR` | Where content, leads, users live (default `./data`) |
| `UPLOAD_DIR` | Where uploaded media lives (default `./uploads`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (used only when no users exist) |
| `SESSION_SECRET` | Optional; otherwise generated and stored in `DATA_DIR` |
| `NODE_ENV=production` | Marks cookies `Secure` (serve over HTTPS) |

Back up `DATA_DIR` and `UPLOAD_DIR` regularly. You can also use *Backup & restore* in the CMS.

## Before going live

The seed content in `data/seed.json` is a **starting point**. Replace it from the CMS:

- Team names and photos (currently role placeholders)
- Key numbers and campaign figures. These are illustrative, so use your real numbers
- Testimonials, research PDFs and past sponsors
- Contact email, socials and the sponsorship deck PDF

## Security notes

- Passwords are hashed with scrypt. Sessions are HMAC-signed, HTTP-only, `SameSite=Strict` cookies.
- Admin write requests need a custom header, which protects against CSRF.
- Login and public forms are rate-limited. Forms include a honeypot field against spam bots.
- Uploads are limited to images and PDFs (no SVG/HTML) and served with a restrictive CSP.
- No payments are taken on the site. Pledges are recorded as leads, and the club follows up through IIM Lucknow's official channels.
