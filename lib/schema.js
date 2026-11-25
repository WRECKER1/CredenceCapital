// Content model. The admin UI renders its editors from this file, and the
// server validates/sanitises saves against it. Add a field here and it shows
// up in the CMS automatically.
//
// Field types: text, textarea, number, url, email, date, image, file,
//              select (options), boolean, lines (one item per line -> array)

const singletons = {
  settings: {
    label: 'Site settings',
    group: 'General',
    description: 'Club identity, contact details, social links and global calls-to-action.',
    fields: [
      { name: 'siteName', label: 'Club name', type: 'text', required: true },
      { name: 'tagline', label: 'Tagline', type: 'text' },
      { name: 'institute', label: 'Institute line', type: 'text' },
      { name: 'logo', label: 'Logo (optional, replaces the built-in monogram)', type: 'image' },
      { name: 'email', label: 'Primary email', type: 'email' },
      { name: 'sponsorEmail', label: 'Sponsorship email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'linkedin', label: 'LinkedIn URL', type: 'url' },
      { name: 'instagram', label: 'Instagram URL', type: 'url' },
      { name: 'facebook', label: 'Facebook URL', type: 'url' },
      { name: 'twitter', label: 'X / Twitter URL', type: 'url' },
      { name: 'youtube', label: 'YouTube URL', type: 'url' },
      { name: 'sponsorDeck', label: 'Sponsorship deck (PDF)', type: 'file', help: 'Shown as "Download deck" across the site.' },
      { name: 'showVisitorCounter', label: 'Show visitor counter in the footer', type: 'boolean' },
      { name: 'announcementOn', label: 'Show announcement bar', type: 'boolean' },
      { name: 'announcement', label: 'Announcement text', type: 'text' },
      { name: 'announcementLink', label: 'Announcement link', type: 'url' },
      { name: 'seoDescription', label: 'SEO description', type: 'textarea' },
      { name: 'disclaimer', label: 'Footer disclaimer', type: 'textarea' },
    ],
  },
  home: {
    label: 'Home page',
    group: 'Pages',
    fields: [
      { name: 'heroEyebrow', label: 'Hero eyebrow', type: 'text' },
      { name: 'heroTitle', label: 'Hero headline', type: 'text', help: 'Wrap words in *asterisks* to highlight them in gold.' },
      { name: 'heroSubtitle', label: 'Hero sub-headline', type: 'textarea' },
      { name: 'heroPrimaryCta', label: 'Primary button label', type: 'text' },
      { name: 'heroSecondaryCta', label: 'Secondary button label', type: 'text' },
      { name: 'introTitle', label: '"Who we are" title', type: 'text' },
      { name: 'introBody', label: '"Who we are" text', type: 'textarea' },
      { name: 'whyTitle', label: '"Why partner" title', type: 'text' },
      { name: 'whyBody', label: '"Why partner" intro', type: 'textarea' },
      { name: 'ctaTitle', label: 'Closing CTA title', type: 'text' },
      { name: 'ctaBody', label: 'Closing CTA text', type: 'textarea' },
    ],
  },
  about: {
    label: 'About page',
    group: 'Pages',
    fields: [
      { name: 'title', label: 'Page title', type: 'text' },
      { name: 'lead', label: 'Lead paragraph', type: 'textarea' },
      { name: 'story', label: 'Our story', type: 'textarea' },
      { name: 'mission', label: 'Mission', type: 'textarea' },
      { name: 'vision', label: 'Vision', type: 'textarea' },
      { name: 'image', label: 'Feature image', type: 'image' },
      { name: 'iimTitle', label: 'IIM Lucknow section title', type: 'text' },
      { name: 'iimQuote', label: 'IIM Lucknow quote', type: 'textarea' },
      { name: 'iimBody', label: 'IIM Lucknow text', type: 'textarea' },
      { name: 'iimImage', label: 'IIM Lucknow image', type: 'image' },
    ],
  },
  nivesh: {
    label: 'Nivesh page',
    group: 'Pages',
    description: 'The Annual Investment Summit landing page. Format, Investowise editions and tiers are managed in their own sections.',
    fields: [
      { name: 'edition', label: 'Current edition', type: 'text', help: 'e.g. Nivesh 2026' },
      { name: 'tagline', label: 'Tagline', type: 'text' },
      { name: 'lead', label: 'Description', type: 'textarea' },
      { name: 'image', label: 'Hero photo', type: 'image' },
      { name: 'investowiseTitle', label: 'Investowise title', type: 'text' },
      { name: 'investowiseBody', label: 'Investowise description', type: 'textarea' },
      { name: 'campuses', label: 'Participating campuses (one per line)', type: 'lines' },
    ],
  },
  partner: {
    label: 'Partner page',
    group: 'Pages',
    description: 'The sponsorship landing page. Tiers, benefits and campaigns are managed in their own sections.',
    fields: [
      { name: 'title', label: 'Page title', type: 'text' },
      { name: 'lead', label: 'Lead paragraph', type: 'textarea' },
      { name: 'audienceTitle', label: 'Audience section title', type: 'text' },
      { name: 'audienceBody', label: 'Audience section text', type: 'textarea' },
      { name: 'customTitle', label: 'Custom-package title', type: 'text' },
      { name: 'customBody', label: 'Custom-package text', type: 'textarea' },
      { name: 'formTitle', label: 'Enquiry form title', type: 'text' },
      { name: 'formBody', label: 'Enquiry form text', type: 'textarea' },
    ],
  },
};

const collections = {
  performance: {
    label: 'Fund performance', group: 'Club', titleField: 'period', subtitleField: 'credence',
    description: 'Fund return vs the Nifty 50 for each period, oldest first. Shown as a chart and table.',
    fields: [
      { name: 'period', label: 'Period', type: 'text', required: true, help: 'e.g. 2023-24' },
      { name: 'credence', label: 'Credence Capital return (%)', type: 'number' },
      { name: 'nifty', label: 'Nifty 50 return (%)', type: 'number' },
      { name: 'partial', label: 'Part-year (e.g. to Q2)', type: 'boolean', help: 'Excluded from the median figures.' },
    ],
  },
  pillars: {
    label: 'What we do', group: 'Club', titleField: 'title',
    description: 'The four pillars of the club, shown on Home and About.',
    fields: [
      { name: 'icon', label: 'Icon', type: 'select', options: ['fund', 'knowledge', 'community', 'platform'] },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Text', type: 'textarea' },
    ],
  },
  formats: {
    label: 'Nivesh format', group: 'Club', titleField: 'title',
    description: 'The components of the summit, numbered in this order.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Description', type: 'textarea' },
    ],
  },
  investowise: {
    label: 'Investowise editions', group: 'Club', titleField: 'edition', subtitleField: 'registrations',
    description: 'Year-on-year numbers for the stock-pitch competition. Newest first.',
    fields: [
      { name: 'edition', label: 'Edition', type: 'text', required: true, help: 'e.g. 2025' },
      { name: 'registrations', label: 'Registrations', type: 'text' },
      { name: 'teamSize', label: 'Team size', type: 'text' },
      { name: 'impressions', label: 'Impressions', type: 'text' },
      { name: 'prizePool', label: 'Prize pool', type: 'text' },
      { name: 'poweredBy', label: 'Powered by', type: 'text' },
    ],
  },
  gallery: {
    label: 'Photo gallery', group: 'Club', titleField: 'caption',
    fields: [
      { name: 'image', label: 'Photo', type: 'image', required: true },
      { name: 'caption', label: 'Caption', type: 'text' },
    ],
  },
  stats: {
    label: 'Key numbers', group: 'General', titleField: 'label', subtitleField: 'value',
    description: 'Headline numbers shown in the hero ticker and on the partner page.',
    fields: [
      { name: 'value', label: 'Value', type: 'text', required: true, help: 'e.g. 250+ or ₹12L' },
      { name: 'label', label: 'Label', type: 'text', required: true },
    ],
  },
  benefits: {
    label: 'Partner benefits', group: 'Sponsorship', titleField: 'title',
    description: '"Why partner with us" value propositions.',
    fields: [
      { name: 'icon', label: 'Icon', type: 'select', options: ['audience', 'brand', 'talent', 'insight', 'network', 'impact'] },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Description', type: 'textarea' },
    ],
  },
  tiers: {
    label: 'Sponsorship tiers', group: 'Sponsorship', titleField: 'name', subtitleField: 'price',
    fields: [
      { name: 'name', label: 'Tier name', type: 'text', required: true },
      { name: 'price', label: 'Contribution (display)', type: 'text', help: 'e.g. ₹5,00,000 or "On request"' },
      { name: 'blurb', label: 'Short description', type: 'textarea' },
      { name: 'perks', label: 'Benefits (one per line)', type: 'lines' },
      { name: 'featured', label: 'Highlight as recommended', type: 'boolean' },
      { name: 'available', label: 'Slots available (optional)', type: 'text', help: 'e.g. "1 of 1 available"' },
    ],
  },
  campaigns: {
    label: 'Fundraising campaigns', group: 'Sponsorship', titleField: 'title', subtitleField: 'status',
    description: 'Live fundraisers with progress bars. Pledges arrive in the Inbox.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'completed', 'draft'] },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'goal', label: 'Goal (₹)', type: 'number' },
      { name: 'raised', label: 'Raised so far (₹)', type: 'number' },
      { name: 'deadline', label: 'Deadline', type: 'date' },
      { name: 'uses', label: 'Where the money goes (one per line)', type: 'lines' },
      { name: 'image', label: 'Image', type: 'image' },
    ],
  },
  sponsors: {
    label: 'Sponsors & partners', group: 'Sponsorship', titleField: 'name', subtitleField: 'category',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'logo', label: 'Logo', type: 'image' },
      { name: 'url', label: 'Website', type: 'url' },
      { name: 'category', label: 'Category', type: 'select', options: ['Title Partner', 'Associate Partner', 'Knowledge Partner', 'Event Partner', 'Banking Partner', 'Media Partner', 'Past Partner'] },
      { name: 'since', label: 'Event / year', type: 'text', help: 'Shown under the logo, e.g. "Nivesh 2023 · Title sponsor"' },
      { name: 'visible', label: 'Show on website', type: 'boolean' },
    ],
  },
  testimonials: {
    label: 'Testimonials', group: 'Sponsorship', titleField: 'name', subtitleField: 'org',
    fields: [
      { name: 'quote', label: 'Quote', type: 'textarea', required: true },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'org', label: 'Organisation', type: 'text' },
    ],
  },
  events: {
    label: 'Events', group: 'Club', titleField: 'title', subtitleField: 'date', sortBy: 'date',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Flagship', 'Competition', 'Speaker Session', 'Workshop', 'Conclave'] },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'image', label: 'Image', type: 'image' },
      { name: 'link', label: 'Registration / details link', type: 'url' },
      { name: 'reach', label: 'Reach / participation (display)', type: 'text', help: 'e.g. "1,200+ registrations"' },
      { name: 'sponsorSlot', label: 'Open for sponsorship', type: 'boolean' },
    ],
  },
  research: {
    label: 'Research & publications', group: 'Club', titleField: 'title', subtitleField: 'type', sortBy: 'date',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Sector Report', 'The Bottom Line', 'Blog', 'Equity Research', 'Market Outlook', 'Stock Pitch', 'Newsletter'] },
      { name: 'author', label: 'Author(s)', type: 'text' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'file', label: 'PDF', type: 'file' },
      { name: 'link', label: 'External link', type: 'url' },
    ],
  },
  team: {
    label: 'Team', group: 'Club', titleField: 'name', subtitleField: 'role',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'group', label: 'Group', type: 'select', options: ['Credence Team', 'Faculty Advisor', 'Alumni'] },
      { name: 'batch', label: 'Batch', type: 'text', help: 'e.g. PGP 2025–27' },
      { name: 'bio', label: 'Short bio', type: 'textarea' },
      { name: 'internship', label: 'Firm', type: 'text', help: 'Summer internship or prior employer, shown under the name' },
      { name: 'photo', label: 'Photo', type: 'image' },
      { name: 'linkedin', label: 'LinkedIn URL', type: 'url' },
      { name: 'email', label: 'Email', type: 'email' },
    ],
  },
  press: {
    label: 'Press & track record', group: 'Club', titleField: 'title', subtitleField: 'outlet', sortBy: 'date',
    description: 'Media coverage. Items with a highlight appear in the "track record" band.',
    fields: [
      { name: 'outlet', label: 'Publication', type: 'text', required: true },
      { name: 'logo', label: 'Publication logo', type: 'image' },
      { name: 'title', label: 'Headline', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'summary', label: 'Summary', type: 'textarea' },
      { name: 'highlight', label: 'Highlight figure (optional)', type: 'text', help: 'e.g. 175% — shown large in the track-record band' },
      { name: 'highlightLabel', label: 'Highlight caption', type: 'text', help: 'e.g. Return in 16 months vs Nifty\'s 50%' },
      { name: 'url', label: 'Article link', type: 'url' },
    ],
  },
  speakers: {
    label: 'Past speakers', group: 'Club', titleField: 'name', subtitleField: 'org',
    description: 'Industry leaders who have spoken at our events. Shown to prospective sponsors.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'title', label: 'Designation', type: 'text' },
      { name: 'org', label: 'Organisation', type: 'text' },
      { name: 'event', label: 'Event', type: 'text', help: 'e.g. Nivesh 2019' },
      { name: 'scope', label: 'Hosted by', type: 'select', options: ['Credence Capital', 'IIM Lucknow'] },
      { name: 'photo', label: 'Photo', type: 'image' },
    ],
  },
  faqs: {
    label: 'Sponsor FAQs', group: 'Sponsorship', titleField: 'question',
    fields: [
      { name: 'question', label: 'Question', type: 'text', required: true },
      { name: 'answer', label: 'Answer', type: 'textarea' },
    ],
  },
};

function sanitizeValue(field, value) {
  switch (field.type) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return value === true || value === 'true' || value === 'on';
    case 'lines':
      if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
      return String(value || '').split('\n').map((s) => s.trim()).filter(Boolean);
    case 'url':
    case 'image':
    case 'file': {
      const v = String(value || '').trim();
      // Allow site-relative paths, mailto and http(s) only (blocks javascript: URLs).
      if (!v) return '';
      if (/^(https?:\/\/|mailto:|\/(?!\/))/i.test(v)) return v;
      return field.type === 'url' && /^[\w.-]+\.[a-z]{2,}/i.test(v) ? `https://${v}` : '';
    }
    case 'select':
      return field.options.includes(value) ? value : field.options[0];
    default:
      return String(value ?? '').slice(0, 20000);
  }
}

function sanitize(def, input) {
  const out = {};
  const errors = [];
  for (const f of def.fields) {
    out[f.name] = sanitizeValue(f, input ? input[f.name] : undefined);
    if (f.required && (out[f.name] === '' || out[f.name] == null)) errors.push(`${f.label} is required`);
  }
  return { data: out, errors };
}

module.exports = { singletons, collections, sanitize };
