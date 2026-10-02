// Every visible string on the site lives here.
// Anything still unknown is marked TODO and rendered in [square brackets] so it is easy to spot.

export const TODO = {
  location: false, // resolved: Valdidentro (posters + client confirmation)
  price: 'TODO: price',
  spots: 'TODO: spots',
  program: 'TODO: day-by-day program',
  accommodation: 'TODO: accommodation',
  janApr: 'TODO: Jan–Apr schedule',
  boardSeasons: 'TODO: board seasons + which board was the first pro model',
  masterOfSport: 'TODO: confirm Master of Sport is official',
  gallery: 'TODO: gallery photos + clips',
  mountainShot: 'TODO: mountain shot for the camp ad',
  photos: 'TODO: original-quality photos',
  contacts: 'TODO: Telegram handle, WhatsApp number, email',
  figma: 'TODO: Figma exports hit the MCP rate limit — swap in bas-camp-logo, mascot-snowboard, bas-camp-splatter "Italy 2026" and the rest of the marker set',
} as const;

export const rider = {
  name: 'Ilia Baskakov',
  first: 'Ilia',
  last: 'Baskakov',
  role: 'Pro snowboarder · Freestyle coach',
  yearsRiding: 20,
  yearsCoaching: 3,
  stance: 'Regular',
  biggestSpin: '1620°',
  favoriteTrick: 'Miller Flip',
  titles: '3× National Champion',
  instagram: 'baskakov74',
  instagramUrl: 'https://instagram.com/baskakov74',
};

export const camp = {
  name: 'BAS CAMP',
  full: 'BAS CAMP Italy 2026',
  kind: 'Freestyle Progression Camp',
  hostedBy: 'Hosted by Ilia Baskakov · pro snowboarder & freestyle coach',
  dates: 'December 23–27, 2026',
  datesShort: 'Dec 23–27',
  datesLines: ['Dec 23–27', '2026'],
  startDate: '2026-12-23',
  endDate: '2026-12-27',
  country: 'Italy',
  place: 'Valdidentro',
  level: 'Piste+',
  pitch: 'For riders who want more air, more style, more control. Small crew. Big progression.',
  pitchA: 'For riders who want more air, more style, more control.',
  pitchB: 'Small crew. Big progression.',
  taglines: ['Ride hard.', 'Learn fast.', 'Send it.'],
  stamps: { lastSpots: 'Last spots', take: 'Take the spot' },
  features: ['Small group', 'Park riding', 'Airbag sessions', 'Personal video feedback', 'Level Piste+'],
  groupSize: '[TODO: group size]',
};

export const issue = {
  label: ['Issue 01', 'Winter 26/27'],
  box: ['No. 01', 'Winter 26/27', 'Free · €0.00'],
  barcode: '4 607162 001620',
  logo: 'BAS★CAMP',
  logoAlt: 'BAS CAMP — back to the cover',
};

export const pages = [
  { id: 'cover', num: '01', title: 'Cover', stageNote: 'cover!' },
  { id: 'stats', num: '02', title: 'Career stats', stageNote: 'the stats' },
  { id: 'gallery', num: '03', title: 'Gallery', stageNote: 'keepers' },
  { id: 'training', num: '04', title: 'Training', stageNote: 'train hard' },
  { id: 'camp-ad', num: '05', title: 'Back cover', stageNote: 'send it!' },
] as const;

export const ui = {
  skip: 'Skip to content',
  menu: 'Menu',
  close: 'Close ✕',
  contents: 'Contents · Issue 01',
  insertLink: 'Special insert: BAS CAMP Italy 2026 →',
  announce: (n: number, total: number, title: string) => `Page ${n} of ${total}: ${title}`,
  pagesNav: 'Pages',
};

export const cover = {
  giant: 'Baskakov',
  photoAlt: 'Ilia Baskakov in white goggles, holding up a hand with his ring',
  coverLines: {
    spin: '1620°',
    spinLabel: 'biggest spin',
    issue: 'The Miller Flip issue',
    champ: '3× National Champion',
    inside: 'Inside: BAS CAMP Italy, December',
  },
  h1: ['Ilia', 'Baskakov'],
  tag: 'Pro snowboarder · Freestyle coach',
  intro: "Twenty years on a snowboard, three of them coaching. Regular stance, a 1620 in the bag, and a Miller flip he'd pick over any trick.",
  note: 'regular!',
};

export const stats = {
  h2: ['Ilia', 'Baskakov'],
  sub: 'Career stats',
  meta: '20 years riding · 3 years coaching',
  portraitAlt: 'Ilia Baskakov smiling in a bandana',
  note: 'the legend',
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
      big: '[—]', // TODO: length
      small: 'Pro Model · [season]', // TODO: board seasons
      tag: 'First pro model', // TODO: confirm which board was first
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
      big: '[—]', // TODO: length
      small: 'Pro Collage · [season]', // TODO: board seasons
    },
  ],
  notes: { pro: 'pro ×3', one: '#1', egg: '1620°!' },
  hint: 'Joint pro models · tap a board',
};

export type Tile = {
  f: string; kind: 'Photo' | 'Clip'; cap: string; rot: string;
  photo?: 'studio' | 'night' | 'smile'; pos?: string; zoom?: number;
  video?: { src?: string; poster?: string; track?: string };
  mark?: 'halo' | 'frame' | 'star' | 'x'; note?: string;
};

export const gallery = {
  h2: 'Contact sheet',
  meta: 'Roll 03 · 400 ISO',
  todo: '[TODO: gallery photos + clips]',
  note: 'keepers ↓',
  rec: 'REC',
  vhs: 'VHS · SP',
  clipPlaceholder: '● REC — clip goes here',
  viewer: 'Photo viewer',
  prev: 'Previous',
  next: 'Next',
  closeViewer: 'Close viewer',
  open: (f: string, cap: string) => `Open frame ${f}: ${cap}`,
  tiles: [
    { f: '03A', kind: 'Photo', photo: 'studio', pos: '50% 28%', rot: '-1.6deg', cap: 'Studio. White goggles, the ring.', mark: 'halo' },
    { f: '03B', kind: 'Photo', photo: 'night', pos: '42% 56%', rot: '1.2deg', cap: 'Night session, Gagarin watching.', mark: 'frame', note: 'night shift' },
    { f: '03C', kind: 'Clip', video: {}, rot: '-0.8deg', cap: '[Clip 01: park lap]' },
    { f: '03D', kind: 'Photo', photo: 'smile', pos: '50% 34%', rot: '2deg', cap: 'Bandana. Post-session grin.', mark: 'star', note: 'that grin' },
    { f: '03E', kind: 'Photo', photo: 'studio', pos: '46% 58%', zoom: 1.9, rot: '1deg', cap: 'The ring: Master of Sport. [confirm]', mark: 'x' },
    { f: '03F', kind: 'Photo', photo: 'night', pos: '70% 18%', zoom: 1.3, rot: '-2deg', cap: '[Gallery photo]', note: '??' },
    { f: '03G', kind: 'Clip', video: {}, rot: '1.6deg', cap: '[Clip 02: airbag session]' },
    { f: '03H', kind: 'Photo', photo: 'smile', pos: '50% 70%', zoom: 1.2, rot: '-1deg', cap: '[Gallery photo]', mark: 'star' },
  ] as Tile[],
};

export const training = {
  label: 'Section 04 · Coaching',
  h2: 'Training',
  intro: "[Short intro: how Ilia coaches, who it's for, what you leave with.]",
  formats: [
    { h: 'Private sessions', body: '[1:1 · length · price]' },
    { h: 'Group park days', body: '[Crew size · park · price]' },
    { h: 'Camps', body: 'BAS CAMP Italy, Dec 23–27. See the back cover.', hot: true },
  ],
  season: 'Season 26/27',
  tour: 'Tour dates',
  dates: [
    { when: ['Dec', '23–27'], what: 'BAS CAMP ★', where: 'Italy · Valdidentro · Level Piste+', stamp: 'Last spots', hot: true },
    { when: ['Jan', '–Apr'], what: 'Season sessions', where: '[Dates and places to confirm]', ink: '??' },
  ],
  footNote: "camp's on the back",
};

export const backCover = {
  h2: ['Ride hard.', 'Learn fast.', 'Send it.'],
  note: 'Italy 2026',
  small: 'For riders who want more air, more style, more control. Small crew. Big progression.',
  info: [['Italy · Valdidentro', 'Level Piste+'], ['2026', 'December 23–27']],
  coupon: {
    top: 'Coupon No. 001 · clip & keep',
    cta: 'Take the spot →',
    bottom: 'Dec 23–27 · small crew · ',
    hot: 'last spots',
    note: 'clip it!',
  },
};

export const campPage = {
  title: 'BAS CAMP Italy 2026 — Freestyle Progression Camp, Dec 23–27',
  description: 'Freestyle snowboard progression camp with Ilia Baskakov in Valdidentro, Italy, December 23–27, 2026. Small group, park riding, airbag sessions, personal video feedback. Level Piste+.',
  strip: 'Special insert · BAS CAMP Italy 2026 · pull out & keep',
  back: '← Back to the issue',
  h1: 'Freestyle progression camp',
  facts: [['Dec 23–27', '2026'], ['Italy', 'Valdidentro'], ['Level', 'Piste+']],
  cta: 'Take the spot ↓',
  what: { kicker: 'The camp in five lines', h2: 'What you get' },
  who: {
    kicker: "Who it's for",
    lead: 'For riders who want more air, more style, more control.',
    marker: 'Small crew. Big progression.',
    list: ['You ride the whole mountain comfortably (Piste+).', '[TODO: who else this camp is for]', '[TODO: what you should already be able to do]'],
  },
  program: {
    h2: 'Day by day',
    meta: 'December 23–27, 2026 · [program to confirm]',
    days: [
      { n: 1, date: '23', title: 'Arrival + park lap', body: '[Meet the crew, check levels, first laps]' },
      { n: 2, date: '24', title: 'Airbag day', body: '[Airbag sessions: spins and flips, safely]' },
      { n: 3, date: '25', title: 'Park + filming', body: '[Kickers and rails, everything on camera]' },
      { n: 4, date: '26', title: 'Video feedback', body: '[Personal breakdown, then back on the hill]' },
      { n: 5, date: '27', title: 'Send day', body: '[Put it all together. Final session + edit]' },
    ],
  },
  included: { h2: 'Included', items: ['5 days of coaching with Ilia', 'Airbag sessions', 'Personal video feedback', '[Accommodation?]'] },
  notIncluded: { h2: 'Not included', items: ['[Lift pass]', '[Travel to Italy]', '[Insurance]'] },
  price: { kicker: 'Price & spots', value: '[€—]', spots: '[N] spots total · [N] left', cta: 'Take the spot →' },
  coach: {
    kicker: 'Your coach',
    chips: ['20 yrs riding', '3 yrs coaching', '3× National Champion', '1620° biggest spin', '3 Joint pro models'],
    body: 'Europa Cup podiums, Junior World Championship participant. Regular stance; favourite trick, the Miller flip.',
  },
  faq: {
    h2: 'FAQ',
    items: [
      { q: 'Do I need park experience?', a: 'No. Level Piste+ means you ride the whole mountain confidently; Ilia builds the park progression from there.' },
      { q: 'Where exactly in Italy?', a: 'Valdidentro, in Lombardy, next to Bormio and Livigno. [TODO: meeting point / resort details]' },
      { q: 'Is accommodation included?', a: '[To confirm]' },
      { q: 'How do I pay and secure my spot?', a: '[Deposit and payment details]' },
      { q: 'What should I bring?', a: '[Kit list: helmet, back protector, etc.]' },
    ],
  },
  apply: {
    kicker: 'Coupon No. 001',
    h2: 'Take the spot',
    lead: 'Tell us who you are and how you ride. Ilia replies personally with details and payment.',
    marker: 'ride hard. learn fast. send it.',
    name: 'Name',
    contactVia: 'Contact via',
    methods: ['Telegram', 'WhatsApp', 'Email'] as const,
    placeholders: { Telegram: '@username', WhatsApp: '+39 …', Email: 'you@example.com' },
    level: 'Your level',
    levelPick: 'Pick one',
    levels: [
      ['piste', 'Piste+ — confident on the whole mountain'],
      ['park-new', 'New to the park'],
      ['park', 'Riding park regularly'],
      ['advanced', 'Spinning 5s and up'],
    ],
    message: 'Message',
    optional: '(optional)',
    messagePh: 'What do you want to land this winter?',
    submit: 'Send the coupon →',
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
      reply: (method: string) => `Ilia will reach you via ${method} within [48 hours].`,
      again: 'Send another',
    },
  },
  footer: {
    contacts: 'Telegram [handle] · WhatsApp [number] · [email]', // TODO: contacts
    issue: 'Issue 01 · Winter 26/27',
    back: '← Back to the magazine',
  },
};

export const seo = {
  title: 'Ilia Baskakov — Issue 01, Winter 26/27',
  description: 'Ilia Baskakov, pro snowboarder and freestyle coach. 20 years riding, 1620° biggest spin, 3× National Champion. Inside: BAS CAMP Italy, December 23–27, 2026.',
  ogAlt: 'Ilia Baskakov magazine cover — BASKAKOV in red over a black-and-white portrait',
};
