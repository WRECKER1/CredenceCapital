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

## Still to update in the CMS

- **Team:** add the current batch of fund managers. The newest batch on the old site was 2023–25. Also add photos and the faculty advisor.
- **Upcoming events and campaigns:** Nivesh 2027 and Investowise 2027 have *placeholder dates and fundraising goals*. "Raised" starts at ₹0.
- **Sponsors:** add past and current partners. Empty spots on the logo wall show as "Your brand here".
- **Missing details:** LinkedIn and Instagram URLs, the sponsorship deck PDF and your logo.
- **Not migrated:** fund performance charts and Nivesh 2022–23 and 2023–24 were image-only on the old site, so add them by hand.

## Security notes

- Passwords are hashed with scrypt. Sessions are HMAC-signed, HTTP-only, `SameSite=Strict` cookies.
- Admin write requests need a custom header, which protects against CSRF.
- Login and public forms are rate-limited. Forms include a honeypot field against spam bots.
- Uploads are limited to images and PDFs (no SVG/HTML) and served with a restrictive CSP.
- No payments are taken on the site. Pledges are recorded as leads, and the club follows up through IIM Lucknow's official channels.
