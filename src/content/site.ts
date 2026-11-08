/**
 * Every piece of copy, link and placeholder on the page lives here.
 * Fill in the [placeholders] before launch.
 */

/** A looping card video. Paths are relative to /public (e.g. 'videos/web.mp4'). */
export interface CardVideo {
  mp4: string;
  webm?: string;
  poster?: string;
}

export interface Service {
  n: string;
  title: string;
  body: string;
  /** Add once the clip exists; until then the card shows a calm placeholder glow. */
  video?: CardVideo;
}

export interface FaqItem {
  q: string;
  a: string;
}

export const site = {
  /** WhatsApp number with country code, digits only (e.g. '60123456789'). Empty until launch. */
  whatsappNumber: '',
  email: '[studio email]',
  nav: [
    { label: 'Work', href: '#work' },
    { label: 'About', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'FAQ', href: '#faq' },
  ],
  socials: [
    { label: 'LinkedIn', href: '#' },
    { label: 'Instagram', href: '#' },
    { label: 'Behance', href: '#' },
  ],

  meta: {
    title: 'Advent Studio | Design & development studio for apps, web and brands',
    description:
      'Custom apps, workflow automation, websites and brand identities for teams that need to move faster.',
  },

  hero: {
    headline: 'Design & development studio for apps, web and brands.',
    subline:
      'Custom apps, workflow automation, websites and brand identities for teams that need to move faster.',
    cta: 'Book a call',
  },

  work: {
    label: 'Selected work',
    tags: ['UX', 'UI', 'Web app', 'Automation'],
    title: 'From a shared spreadsheet to a live dashboard.',
    statement: ['From a shared spreadsheet', 'to a live dashboard.'],
    lead: 'A team ran every project from a shared spreadsheet and chat threads. We designed and built the web app that turned it into one live view of what needs attention.',
    video: { mp4: 'videos/work-dashboard.mp4', webm: 'videos/work-dashboard.webm', poster: 'videos/work-dashboard.jpg' },
    story: [
      {
        label: 'The problem',
        text: 'Projects, deadlines and follow-ups lived in a shared spreadsheet and chat threads. Nobody could see what was slipping until it had already slipped.',
      },
      {
        label: 'What we built',
        text: 'A web app that reads the same spreadsheet and turns it into a dashboard, a project timeline and reminders, designed around how the team already worked.',
      },
      {
        label: 'The outcome',
        text: 'One place to see every project. What is late or due rises to the top on its own, so each day starts from what needs attention instead of a search through files.',
      },
    ],
    videoLabel: 'Demo: the project dashboard we designed and built, running on a laptop. A task is ticked off and the open bug count drops.',
    note: 'The real interface, shown with sample data.',
    siteProof: {
      label: 'Also on show: this website',
      items: ['Designed and built in-house', 'Lighthouse mobile performance 95+', 'Accessibility 100', 'Works without JavaScript'],
    },
  },

  about: {
    statement: 'We build the software that lets ambitious teams move faster.',
    body: 'We design and engineer custom apps, automated workflows and web products that remove friction from how modern businesses operate.',
    values: ['Speed with precision', 'Engineering excellence', 'Future proofing', 'Radical clarity'],
  },

  services: [
    {
      n: '01',
      title: 'Web design & development',
      body: 'Marketing sites and landing pages that explain what you do and turn visitors into conversations. Designed, built and launched, fast on every screen.',
    },
    {
      n: '02',
      title: 'UI / UX & product design',
      body: 'Research, user flows, prototypes and interface design for apps and tools people enjoy using. We find where the experience breaks, then fix it.',
    },
    {
      n: '03',
      title: 'Custom apps & automation',
      body: 'Internal tools, dashboards and automated workflows that replace spreadsheets and copy-paste. Built around how your team really works.',
    },
    {
      n: '04',
      title: 'Brand identity',
      body: 'Logos, visual systems and guidelines that make a young company look established, and keep it consistent everywhere it shows up.',
    },
  ] satisfies Service[],

  offer: {
    heading: 'Now taking [X] founding clients',
    terms: '[Price] · [Timeline]',
    status: '[X] spots left',
    cta: 'Book a call',
  },

  faq: [
    {
      q: 'How much does it cost?',
      a: 'Every project gets a fixed quote after a short call, so you know the full price before we start. Projects start from [PRICE].',
    },
    {
      q: 'How long does it take?',
      a: 'Most websites launch in [X] weeks. Apps and automations depend on scope; we agree the timeline in the quote and show progress every week.',
    },
    {
      q: 'What happens after I book?',
      a: 'We chat on WhatsApp, then have a short call to understand the problem. Within [X] days you get a written scope and a fixed quote. Once you approve, we design, build and launch, with progress visible every week.',
    },
    {
      q: 'Who owns the work?',
      a: 'You do. At handover you get the code, the design files and every account in your name. We stay on for [X] weeks of support after launch.',
    },
  ] satisfies FaqItem[],

  footer: {
    headline: 'Let’s talk.',
    cta: 'Chat on WhatsApp',
    smallPrint: '© 2026 Advent Studio',
  },
} as const;
