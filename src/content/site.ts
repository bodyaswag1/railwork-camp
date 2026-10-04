// Every visible string on the site lives here.
// Anything still unknown is marked TODO and rendered in [square brackets] so it is easy to spot.
//
// Content rules (from the brief):
//  - the public BAS CAMP price is €800 (no other price is ever shown)
//  - BAS CAMP takes every level, complete beginners included (never say beginners can't come); riders are
//    grouped by snowboard / ski, experience and level
//  - no invented achievements, results, reviews or quotes: student cases stay placeholders until they're real

export const TODO = {
  studentCases: 'TODO: the 3 student videos (vertical) + starting point, what they worked on, result, optional quote',
  coachingMedia: 'TODO: a coaching photo or clip for "From rider to coach"',
  lifeMedia: 'TODO: crew / dinner / spa / travel photos for BAS life',
  campProgram: 'TODO: day-by-day program (3 riding days), hotel, St. Moritz itinerary, spa',
  campIncluded: 'TODO: what the €800 includes and excludes',
  secondCoach: 'TODO: name + discipline of the second coach',
  boardSeasons: 'TODO: board seasons + which board was the first pro model',
  photos: 'TODO: original-quality photos (the current files are compressed messenger copies)',
  contacts: 'TODO: Telegram handle, WhatsApp number, email',
  formEndpoint: 'TODO: set PUBLIC_FORM_ENDPOINT in Vercel; until then the camp form hands the application over in an Instagram DM',
  figma: 'TODO: Figma exports hit the MCP rate limit — swap in bas-camp-logo, mascot-snowboard, bas-camp-splatter and the rest of the marker set',
} as const;

export const rider = {
  name: 'Ilia Baskakov',
  first: 'Ilia',
  last: 'Baskakov',
  role: 'Professional snowboarder & coach',
  yearsRiding: 20,
  yearsCoaching: 3,
  stance: 'Regular',
  biggestSpin: '1620°',
  favoriteTrick: 'Miller Flip',
  titles: '3× National Champion',
  instagram: 'baskakov74',
  instagramUrl: 'https://instagram.com/baskakov74',
  /** opens a DM thread with Ilia in the Instagram app (or instagram.com on desktop) */
  dmUrl: 'https://ig.me/m/baskakov74',
};

export const camp = {
  name: 'BAS CAMP',
  issue: 'Issue 01',
  full: 'BAS CAMP Italy 2026',
  kind: 'Snowboard + Freeski camp',
  disciplines: 'Snowboard + Freeski',
  dates: 'December 23–27, 2026',
  datesLong: '23–27 December 2026',
  datesShort: '23–27 Dec 2026',
  datesPoster: ['23—27', 'Dec 2026'],
  startDate: '2026-12-23',
  endDate: '2026-12-27',
  country: 'Italy',
  place: 'Valdidentro',
  price: '€800',
  priceValue: 800,
  spots: 12,
  days: 5,
  ridingDays: 3,
  coaches: 2,
  line: '5 days in the Alps. 3 focused riding days. Two coaches.',
  levels: 'All levels welcome',
};

export const brand = {
  logo: 'BAS',
  logoCamp: 'BAS★CAMP',
  issue: ['Issue 01', 'Winter 26/27'],
  logoAlt: 'BAS — Ilia Baskakov, back to the cover',
};

/** the eight pages of the magazine, in reading order */
export const pages = [
  { id: 'cover', num: '01', title: 'Ilia Baskakov', stageNote: 'cover!', head: 'dark' },
  { id: 'ilia', num: '02', title: 'The rider', stageNote: '20 years', head: 'light' },
  { id: 'coaching', num: '03', title: 'The coach', stageNote: 'watch.', head: 'dark' },
  { id: 'progress', num: '04', title: 'Student progress', stageNote: 'proof', head: 'light' },
  { id: 'train', num: '05', title: 'Train with Ilia', stageNote: 'your call', head: 'dark' },
  { id: 'life', num: '06', title: 'BAS life', stageNote: 'crew!', head: 'light' },
  { id: 'next-camp', num: '07', title: 'Next camp', stageNote: 'italy!', head: 'red' },
  { id: 'next-level', num: '08', title: 'Your next level', stageNote: 'go!', head: 'dark' },
] as const;
export const pageIndex = (id: (typeof pages)[number]['id']) => pages.findIndex((p) => p.id === id);

export const nav = {
  label: 'Main',
  links: [
    { label: 'Ilia', page: 'ilia' },
    { label: 'Coaching', page: 'coaching' },
    { label: 'Camp', href: '/camp' },
    { label: 'Instagram', href: rider.instagramUrl, external: true },
  ],
  cta: 'Join BAS CAMP',
  ctaShort: 'Join camp',
};

export const ui = {
  skip: 'Skip to content',
  menu: 'Menu',
  close: 'Close ✕',
  contents: 'Contents',
  insertLink: 'BAS CAMP Italy · 23–27 Dec 2026 →',
  announce: (n: number, total: number, title: string) => `Page ${n} of ${total}: ${title}`,
  pagesNav: 'Pages',
  prev: 'Previous',
  next: 'Next',
  slide: (n: number, total: number) => `${n} of ${total}`,
  newTab: '(opens Instagram)',
};

// ---------------------------------------------------------------- 01 cover / hero
export const hero = {
  kicker: 'Pro snowboarder · Coach',
  h1: ['Ilia', 'Baskakov'],
  claim: 'Ride better.',
  sub: 'Professional snowboarder & coach.',
  proof: ['3× National Champion', 'Europa Cup podiums', '20 years riding'],
  spin: { label: 'Biggest spin', value: '1620°' },
  ctaCamp: 'Join BAS CAMP',
  ctaCoaching: 'Private coaching',
  photoAlt: 'Ilia Baskakov on the snow in a red competition bib, number 27, making a peace sign',
  hint: 'Swipe up',
  hintDesktop: 'Scroll',
};

// ---------------------------------------------------------------- 02 the rider
// The career-stats page of the first magazine (badges, the three pro boards that drop in and spin), with a
// photo slider where the single portrait used to be.
export type RiderPic = { photo: 'air' | 'rail' | 'night' | 'studio' | 'smile' | 'bib'; pos?: string; cap: string; alt: string };

export const riderPage = {
  kicker: 'The rider',
  h2: ['Ilia', 'Baskakov'],
  sub: 'Career stats',
  meta: '20 years riding · 3 years coaching',
  note: 'the legend',
  pics: {
    label: 'Photos of Ilia',
    note: 'swipe →',
    slides: [
      { photo: 'rail', pos: '58% 50%', cap: 'Rainbow rail', alt: 'Ilia in a one-hand plant on a rainbow rail, his Joint board overhead' },
      { photo: 'air', pos: '42% 38%', cap: 'Upside down', alt: 'Ilia upside down in the air above a kicker, a drone filming him' },
      { photo: 'bib', pos: '50% 28%', cap: 'Bib 27', alt: 'Ilia on the snow in a red competition bib, number 27, making a peace sign' },
      { photo: 'night', pos: '45% 55%', cap: 'Night shift', alt: 'Ilia smiling under his helmet at a night session' },
      { photo: 'studio', pos: '50% 30%', cap: 'Studio', alt: 'Studio portrait of Ilia in white goggles, his hand raised' },
      { photo: 'smile', pos: '50% 32%', cap: 'That grin', alt: 'Ilia laughing in a bandana' },
    ] as RiderPic[],
  },
  badges: {
    champ: { big: '3×', small: ['National', 'Champion'] },
    europa: { top: 'Europa Cup', marker: 'Podiums', ink: '!!' },
    junior: { top: 'Junior World', mid: 'Championship', low: 'participant' },
    spin: { label: 'Biggest spin', value: '1620°' },
    trick: { label: 'Favorite trick', value: 'Miller Flip' },
    stance: { label: 'Stance', value: 'Regular' },
  },
  boards: [
    {
      top: 'board-1-top', base: 'board-1-base',
      alt: 'Baskakov Pro Model, black and red top sheet',
      spinLabel: 'Spin the Baskakov Pro Model',
      big: '[—]', // TODO(boardSeasons): length
      small: 'Pro Model · [season]', // TODO(boardSeasons)
      tag: 'First pro model', // TODO(boardSeasons): confirm which board was first
    },
    {
      top: 'board-2-top', base: 'board-2-base',
      alt: 'Baskakov Pro 2025/26, white and orange top sheet',
      spinLabel: 'Spin the Baskakov Pro 2025/26',
      big: '157W',
      small: 'Pro · 2025/26',
    },
    {
      top: 'board-3-top', base: 'board-3-base',
      alt: 'Baskakov Pro, black and teal collage top sheet',
      spinLabel: 'Spin the Baskakov Pro collage board',
      big: '[—]', // TODO(boardSeasons): length
      small: 'Pro Collage · [season]', // TODO(boardSeasons)
    },
  ] as { top: string; base: string; alt: string; spinLabel: string; big: string; small: string; tag?: string }[],
  notes: { pro: 'pro ×3', one: '#1', egg: '1620°!', stamp: 'Joint × Baskakov' },
  hint: 'Joint pro models · tap a board',
};

// ---------------------------------------------------------------- 03 from rider to coach
export const coachPage = {
  kicker: 'From rider to coach',
  h2: [['20', 'years riding.'], ['3', 'years coaching.']],
  lead: 'Being able to ride is one thing.',
  leadMore: 'Being able to understand what is holding another rider back — and explain how to fix it — is another.',
  loopLabel: 'How a session works',
  loop: [
    { word: 'Watch', line: 'your riding, on snow and on video' },
    { word: 'Understand', line: "what's really holding you back" },
    { word: 'Adjust', line: 'one specific fix, with exercises' },
    { word: 'Repeat', line: 'until it holds' },
  ],
  loopNote: 'again',
  more: '"at least one more!"',
  support: ['Individual feedback', 'Specific exercises', 'Riding analysis', 'Video feedback', 'Progression built on your level'],
  media: { label: 'Coaching', cap: '[Coaching photo or clip]' },
};

// ---------------------------------------------------------------- 04 student progress
export type StudentCase = {
  n: string;
  rider: string;
  tag: string;
  start: string;
  work: string;
  result: string;
  quote?: string;
  video?: { src?: string; poster?: string };
};

export const progress = {
  kicker: 'Student progress',
  h2: ["Don't take our word for it.", 'Watch the progress.'],
  stamp: 'Real riders',
  note: 'proof ↓',
  carousel: 'Student stories',
  labels: { start: 'Starting point', work: 'Worked on', result: 'Result', video: 'Student video', play: (n: string) => `Play rider ${n}'s video`, pause: (n: string) => `Pause rider ${n}'s video` },
  // TODO(studentCases): replace each bracket with the real case; drop `quote` if the rider has none
  cases: [1, 2, 3].map((n) => ({
    n: String(n).padStart(2, '0'),
    rider: `[Rider ${n} — name]`,
    tag: '[Snowboard · level]',
    start: '[Where they started]',
    work: '[What they worked on]',
    result: '[What they can do now]',
    quote: '[Optional quote from the rider]',
    video: {},
  })) as StudentCase[],
};

// ---------------------------------------------------------------- 05 ways to train
export const train = {
  kicker: 'Train with Ilia',
  h2: ['How do you', 'want to ride?'],
  note: 'pick one',
  or: 'or',
  coaching: {
    label: 'A',
    title: 'Private coaching',
    from: 'From',
    price: '€150',
    per: '/ day',
    body: "Personal coaching built around your goals and your level.",
    areas: ['Fundamentals', 'Carving', 'Freestyle', 'Park', 'Progression', 'Video feedback'],
    cta: 'Train with Ilia',
    note: 'Opens a DM to @baskakov74',
    alt: 'Ilia in a one-hand plant on a rail',
  },
  camp: {
    label: 'B',
    title: 'BAS CAMP',
    lines: ['5 days.', 'Alps.', 'Coaching.', 'Crew.'],
    next: 'Next camp',
    when: '23–27 December 2026',
    where: 'Italy',
    disciplines: 'Snowboard + Freeski',
    price: '€800',
    sticker: '12 spots',
    cta: 'Explore camp',
    alt: 'A rider in a red jacket pulling on goggles above a glacier',
  },
};

// ---------------------------------------------------------------- 06 BAS life
export type LifeTile = { photo?: 'glacier' | 'fisheye' | 'bandana' | 'night' | 'smile'; pos?: string; cap: string; alt?: string; todo?: boolean; shape: 'tall' | 'square' | 'wide' };

export const life = {
  kicker: 'BAS life',
  h2: ['Come for the riding.', 'Stay for the people.'],
  stamp: 'No. 06 · Off the clock',
  crew: 'crew!',
  carousel: 'BAS life photos',
  note: 'good times',
  tiles: [
    { photo: 'glacier', pos: '50% 45%', shape: 'tall', cap: 'Top of the glacier', alt: 'A rider in a red jacket and white mittens pulling on goggles, a peak behind' },
    { photo: 'fisheye', pos: '50% 50%', shape: 'square', cap: 'Park laps', alt: 'Fisheye shot of a rider in yellow doing a handplant on a blue park feature' },
    { photo: 'bandana', pos: '50% 30%', shape: 'tall', cap: 'Between runs', alt: 'A rider in a skull bandana and silver sunglasses looking out over the park' },
    { shape: 'square', todo: true, cap: '[Photo: crew dinner]' },
    { photo: 'smile', pos: '50% 35%', shape: 'tall', cap: 'Evenings', alt: 'Ilia laughing in a bandana at night' },
    { shape: 'square', todo: true, cap: '[Photo: spa / recovery]' },
  ] as LifeTile[],
  viewer: 'Photo viewer',
  closeViewer: 'Close viewer',
  open: (cap: string) => `Open photo: ${cap}`,
};

// ---------------------------------------------------------------- 07 next camp teaser
export const nextCamp = {
  kicker: 'Next camp',
  issue: 'Issue 01',
  stamp: '12 spots',
  place: 'Italy',
  dates: camp.datesPoster,
  facts: ['Snowboard + Freeski', '12 spots', '€800', 'All levels'],
  line: camp.line,
  cta: 'Explore BAS CAMP',
  photoAlt: '',
  note: 'see you there',
};

// ---------------------------------------------------------------- 08 final call
export const nextLevel = {
  h2: ["What's your", 'next level?'],
  stamp: 'Last page · Issue 01',
  pick: 'pick one',
  paths: [
    { kind: 'coaching', label: 'Private coaching', sub: 'From €150 / day · on your level', cta: 'Train with Ilia' },
    { kind: 'camp', label: 'BAS CAMP', sub: '23–27 Dec 2026 · Italy · €800', cta: 'Join BAS CAMP' },
  ],
  social: 'Follow the riding',
  footer: {
    issue: 'Issue 01 · Winter 26/27',
    copyright: '© 2026 Ilia Baskakov · BAS',
    toTop: '↑ Back to the cover',
  },
};

// ---------------------------------------------------------------- /camp
export const campPage = {
  title: 'BAS CAMP Italy 2026 — Snowboard + Freeski camp with Ilia Baskakov, Dec 23–27',
  description: '5 days in the Italian Alps with pro snowboarder Ilia Baskakov: 3 focused riding days, two coaches, 12 spots. Snowboard + Freeski, all levels welcome, complete beginners included. December 23–27, 2026. €800.',
  back: '← Ilia Baskakov',
  h1: ['5 days', 'in the Alps.'],
  by: 'With pro snowboarder & coach Ilia Baskakov',
  facts: [['23–27 Dec', '2026'], ['Italy', 'Valdidentro'], ['Snowboard', '+ Freeski'], ['12 spots', '€800']],
  cta: 'Take the spot ↓',
  levels: 'All levels welcome — complete beginners included.',
  what: {
    kicker: 'The camp',
    h2: 'What you get',
    items: [
      { t: '3 focused riding days', s: 'Five days in the Alps, three of them all about riding.' },
      { t: 'Two coaches', s: 'One camp, Snowboard + Freeski.' },
      { t: 'Your group, your level', s: 'Grouped by snowboard or ski, experience and level.' },
      { t: 'Video feedback', s: 'See your riding, understand it, fix it.' },
      { t: '12 spots', s: 'A small crew, so every rider gets real coaching time.' },
    ],
  },
  who: {
    kicker: "Who it's for",
    lead: 'Everyone who wants to ride better.',
    marker: 'first-timers too!',
    body: 'BAS CAMP takes every level — including people who have never skied or snowboarded. Riders are split into groups by discipline (snowboard or ski), experience and level, so every session is pitched right for you.',
    list: ['Never been on snow? Start from your very first turns.', 'Riding the whole mountain? Build carving, park and control.', 'Already in the park? Work on new tricks with video feedback.'],
  },
  program: {
    h2: 'Five days',
    meta: 'December 23–27, 2026 · 3 riding days · [program to confirm]',
    days: [
      { date: '23', title: '[Day 1]', body: '[Program to confirm]' },
      { date: '24', title: '[Day 2]', body: '[Program to confirm]' },
      { date: '25', title: '[Day 3]', body: '[Program to confirm]' },
      { date: '26', title: '[Day 4]', body: '[Program to confirm]' },
      { date: '27', title: '[Day 5]', body: '[Program to confirm]' },
    ],
  },
  beyond: {
    kicker: 'Off the slopes',
    h2: 'Not just riding',
    items: [
      { t: 'The hotel', s: '[Hotel name and details]' },
      { t: 'St. Moritz', s: '[St. Moritz itinerary]' },
      { t: 'Spa', s: '[Spa details]' },
    ],
  },
  included: { h2: 'Included', items: ['Coaching on 3 riding days', 'Video feedback', '[Accommodation — to confirm]', '[Anything else included — to confirm]'] },
  notIncluded: { h2: 'Not included', items: ['[Lift pass — to confirm]', '[Travel to Italy — to confirm]', '[Insurance — to confirm]'] },
  price: { kicker: 'Price & spots', value: '€800', spots: '12 spots · Snowboard + Freeski', cta: 'Take the spot →' },
  coach: {
    kicker: 'Two coaches · Snowboard + Freeski',
    h2: 'Your coaches',
    chips: ['20 yrs riding', '3 yrs coaching', '3× National Champion', '1620° biggest spin', '3 Joint pro models'],
    body: 'Europa Cup podiums, Junior World Championship participant. Regular stance; favourite trick, the Miller flip.',
    second: { name: '[Second coach]', role: '[Discipline · background]' },
  },
  faq: {
    h2: 'FAQ',
    items: [
      { q: "I've never been on snow. Can I come?", a: 'Yes. Complete beginners are welcome, including people who have never skied or snowboarded. Groups are set by discipline, experience and level.' },
      { q: 'Ski or snowboard?', a: 'Both. BAS CAMP is a Snowboard + Freeski camp, with two coaches.' },
      { q: 'Where exactly in Italy?', a: 'Valdidentro, in Lombardy, next to Bormio and Livigno. [Meeting point / resort details to confirm]' },
      { q: 'Is accommodation included?', a: '[To confirm]' },
      { q: 'How do I secure my spot?', a: 'Send the form below. Ilia replies personally with the details and payment. [Deposit and payment details to confirm]' },
      { q: 'What should I bring?', a: '[Kit list: helmet, back protector, etc.]' },
    ],
  },
  apply: {
    kicker: 'Apply',
    h2: 'Take the spot',
    lead: 'Tell us who you are and how you ride. Ilia replies personally with the details and payment.',
    marker: 'ride hard. learn fast.',
    name: 'Name',
    discipline: 'You ride',
    disciplines: ['Snowboard', 'Ski'] as const,
    contactVia: 'Contact via',
    methods: ['Telegram', 'WhatsApp', 'Email'] as const,
    placeholders: { Telegram: '@username', WhatsApp: '+39 …', Email: 'you@example.com' },
    level: 'Your level',
    levelPick: 'Pick one',
    levels: [
      ['first', 'Never been on snow'],
      ['beginner', 'Beginner — a few days on snow'],
      ['piste', 'Confident on the whole mountain'],
      ['park', 'Riding park regularly'],
      ['advanced', 'Spinning 5s and up'],
    ],
    message: 'Message',
    optional: '(optional)',
    messagePh: 'What do you want to get out of the camp?',
    submit: 'Send →',
    sending: 'Sending…',
    errors: {
      name: 'Your name, please.',
      contact: 'How should Ilia reach you?',
      email: 'That email looks off.',
      phone: 'Use a phone number, with country code.',
      level: 'Pick your level.',
      network: "Couldn't send it. Check your connection and try again.",
    },
    sent: {
      stamp: 'Received',
      line: (first: string) => `See you on the hill, ${first}.`,
      reply: (method: string) => `Ilia will reach you via ${method}.`,
      again: 'Send another',
    },
    // no form backend yet: the application goes to Ilia as an Instagram DM the rider sends themselves
    handoff: {
      stamp: 'One last step',
      line: 'Send it to Ilia on Instagram.',
      body: 'Your application is ready. Copy it, then paste it into the chat with @baskakov74 and hit send.',
      copy: 'Copy & open Instagram',
      copied: 'Copied — paste it in the chat',
      open: 'Open Instagram only',
      label: 'Your application',
      intro: 'Hi Ilia! I want to join BAS CAMP Italy, 23–27 Dec 2026.',
    },
  },
  footer: {
    contacts: 'Telegram [handle] · WhatsApp [number] · [email]', // TODO: contacts
    issue: 'BAS CAMP · Issue 01',
    back: '← Back to Ilia Baskakov',
    toTop: '↑ Back to top',
  },
};

export const seo = {
  title: 'Ilia Baskakov — Pro snowboarder & coach · BAS',
  description: 'Ilia Baskakov, professional snowboarder and coach: 3× National Champion, Europa Cup podiums, 20 years riding, 1620° biggest spin. Private coaching from €150 a day and BAS CAMP, 23–27 December 2026 in Italy.',
  ogAlt: 'Ilia Baskakov — Ride better.',
};
