// Every visible string on the site lives here.
// Anything still unknown is marked TODO and rendered in [square brackets] so it is easy to spot.
//
// Content rules (from the brief):
//  - the public BAS CAMP price is €800 (no other price is ever shown)
//  - BAS CAMP takes every level, complete beginners included (never say beginners can't come); riders are
//    grouped by snowboard / ski, experience and level
//  - no invented achievements, results, reviews or quotes: student cases stay placeholders until they're real

export const TODO = {
  studentCases: 'TODO: Ilia to write up each student in more detail (what they worked on, quotes)',
  lifeMedia: 'TODO: St. Moritz / Christmas / breakfast photos (home BAS life + /camp camp life)',
  campFaq: 'TODO: how to get there, payment / deposit, cancellation — nothing is promised until confirmed',
  photos: 'TODO: original-quality photos (the current files are compressed messenger copies)',
  formEndpoint: 'TODO: set PUBLIC_FORM_ENDPOINT in Vercel; until then the camp form hands the application over in an Instagram DM',
  promoEndpoint: 'TODO: optional PUBLIC_PROMO_ENDPOINT (POST {code} → {valid, message}); until then codes travel with the application and are checked by hand',
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
  phone: '+43 676 9828836',
  phoneHref: 'tel:+436769828836',
  email: 'baskakov.ilia74@gmail.com',
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
  spots: 15,
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
  { id: 'next-camp', num: '03', title: 'Next camp', stageNote: 'italy!', head: 'red' },
  { id: 'coaching', num: '04', title: 'The coach', stageNote: 'watch.', head: 'dark' },
  { id: 'progress', num: '05', title: 'Student progress', stageNote: 'proof', head: 'light' },
  { id: 'train', num: '06', title: 'Train with Ilia', stageNote: 'your call', head: 'dark' },
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
  ctaCamp: 'Join BAS CAMP',
  ctaCoaching: 'Private coaching',
  photoAlt: 'Studio portrait of Ilia Baskakov in white goggles, holding up a gloved hand with his ring',
  hint: 'Swipe up',
  hintDesktop: 'Scroll',
};

// ---------------------------------------------------------------- 02 the rider
// The career-stats page of the first magazine (badges, the three pro boards that drop in and spin), with a
// photo slider where the single portrait used to be.
// a print in the pile: a photo, or a GIF (public/clips/…) over its still poster (src/assets/clips/…). The GIF only
// loads once its print comes up; page copies for the paper show the poster.
export type RiderPic = { kind: 'photo' | 'gif'; photo?: 'air' | 'rail' | 'boardslide'; gif?: string; poster?: 'trick-9563' | 'trick-2644' | 'trick-0123' | 'trick-6120'; pos?: string; cap: string; alt: string };

export const riderPage = {
  kicker: 'The rider',
  h2: ['Ilia', 'Baskakov'],
  sub: 'Career stats',
  meta: '20 years riding · 3 years coaching',
  note: 'the legend',
  // the headline result, under the name
  xgames: { place: '2nd', ord: 'place', event: 'X Games', where: 'China', ink: 'silver!' },
  pics: {
    label: 'Photos of Ilia',
    note: '← swipe →',
    slides: [
      { kind: 'gif', gif: '/clips/trick-9563.gif', poster: 'trick-9563', cap: 'Bs 1620', alt: 'Ilia spinning off a big kicker, his Joint board grabbed' },
      { kind: 'photo', photo: 'boardslide', pos: '50% 40%', cap: 'Fs Blunt', alt: 'Ilia sliding a red rainbow rail, snow spraying, a mountain behind' },
      { kind: 'gif', gif: '/clips/trick-2644.gif', poster: 'trick-2644', cap: 'Fs Miller flip', alt: 'Ilia upside down off a kicker in a red suit' },
      { kind: 'photo', photo: 'rail', pos: '58% 50%', cap: 'Bs Miller flip over the rainbow rail', alt: 'Ilia in a one-hand plant on a rainbow rail, his Joint board overhead' },
      { kind: 'gif', gif: '/clips/trick-0123.gif', poster: 'trick-0123', cap: 'Fs 180 in switch bs rodeo 540 out', alt: 'Ilia grabbing his board high off a jump' },
      { kind: 'gif', gif: '/clips/trick-6120.gif', poster: 'trick-6120', cap: 'Fs 1440', alt: 'Ilia flipping off a park kicker' },
      { kind: 'photo', photo: 'air', pos: '42% 38%', cap: 'Cab 540 Japan grab', alt: 'Ilia upside down in the air above a kicker, a drone filming him' },
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
      big: '157',
      small: 'Pro Model · 2023/24',
      tag: 'First pro model',
    },
    {
      top: 'board-2-top', base: 'board-2-base',
      alt: 'Baskakov Pro 2025/26, white and orange top sheet',
      spinLabel: 'Spin the Baskakov Pro 2025/26',
      big: '159',
      small: 'Pro · 2025/26',
    },
    {
      top: 'board-3-top', base: 'board-3-base',
      alt: 'Baskakov Pro, black and teal collage top sheet',
      spinLabel: 'Spin the Baskakov Pro collage board',
      big: '161',
      small: 'Pro Collage · 2024/25',
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
  media: { gif: '/clips/coach-session.gif', alt: 'A coaching session on the slope: riders with their boards at the top of a run' },
};

// ---------------------------------------------------------------- 04 student progress
export type StudentCase = {
  n: string;
  rider: string;
  tag: string;
  /** the change in one line, big on the card: where they were → where they are */
  gain: { from: string; to: string; note: string };
  start: string;
  work: string;
  result: string;
  quote?: string;
  /** a looping before/after GIF (public/clips/…) over its still first frame (src/assets/clips/…) */
  gif?: { src: string; poster: 'progress-01' | 'progress-02' | 'progress-03'; alt: string };
};
export const progress = {
  kicker: 'Student progress',
  h2: ["Don't take our word for it.", 'Watch the progress.'],
  stamp: 'Real riders',
  note: 'proof ↓',
  carousel: 'Student stories',
  labels: { start: 'Starting point', work: 'Worked on', result: 'Result', video: 'Student video' },
  // from Ilia (Oct 2026): names, levels, starting point and result; "worked on" is the coaching focus in short
  // easiest first, so the park doesn't scare anyone off: Katya, then Max, then Timur
  cases: [
    {
      n: '01', rider: 'Katya', tag: 'Snowboard · beginner',
      gain: { from: 'Day one', to: 'Linked turns', note: 'in one session' },
      start: 'Just starting to learn to snowboard',
      work: 'Technique: stance, edging, turning',
      result: 'New technique after one session: linked turns',
      gif: { src: '/clips/progress-03.gif', poster: 'progress-03', alt: 'Before: Katya, in a yellow jacket, on her first turns. After: Katya linking turns down the slope.' },
    },
    {
      n: '02', rider: 'Max', tag: 'Snowboard · beginner',
      gain: { from: '1 m', to: '14 m', note: '14× the jump' },
      start: 'A 1 m jump: a bump in the snow',
      work: 'Speed, pop and landings, one kicker size at a time',
      result: 'A 14 m jump on the big kicker',
      gif: { src: '/clips/progress-01.gif', poster: 'progress-01', alt: 'Before: Max on a snowy slope, jumping a small bump. After: Max on a 14 metre kicker.' },
    },
    {
      n: '03', rider: 'Timur', tag: 'Snowboard · intermediate',
      gain: { from: 'Never tried', to: 'Landed it', note: 'in one day' },
      start: 'Never tried the BS rodeo, always dreamed of it',
      work: 'Building the flip step by step, into the airbag',
      result: 'Landed it into the airbag in one day. Next: snow',
      gif: { src: '/clips/progress-02.gif', poster: 'progress-02', alt: 'Before: Timur at the airbag. After: Timur riding the kicker into the airbag for his backside rodeo.' },
    },
  ] as StudentCase[],
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
    from: '',
    price: '€100',
    per: '/ hour',
    day: '€300 / day · 4 hours',
    body: "Personal coaching built around your goals and your level.",
    areas: ['Carving', 'Park', 'Flat freestyle', 'Technique improvement'],
    cta: 'Train with Ilia',
    note: 'Opens a DM to @baskakov74',
    alt: 'Ilia going over a rider’s clip with her on the slope',
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
    sticker: '15 spots',
    cta: 'Explore camp',
    alt: 'The BAS crew lined up on the snow, laughing',
  },
};

// ---------------------------------------------------------------- 07 next camp teaser
export const nextCamp = {
  kicker: 'Next camp',
  issue: 'Issue 01',
  stamp: '15 spots',
  place: 'Italy',
  dates: camp.datesPoster,
  facts: ['Snowboard + Freeski', '15 spots', '€800', 'All levels'],
  line: camp.line,
  cta: 'Explore BAS CAMP',
  photoAlt: '',
  note: 'see you there',
};

// ---------------------------------------------------------------- 08 final call
// the contacts and the way back to the start, at the foot of the last page (Train with Ilia)
export const nextLevel = {
  social: 'Follow the riding',
  footer: {
    issue: 'Issue 01 · Winter 26/27',
    copyright: '© 2026 Ilia Baskakov · BAS',
    toTop: '↑ Back to start',
  },
};

// ---------------------------------------------------------------- /camp
// A multi-day progression camp first (ride → feedback → video → adjust → ride again), the coaches second,
// the trip third. Public price €800 only; a promo code is collected with the application and checked later
// (by Ilia, or a backend once PUBLIC_PROMO_ENDPOINT exists) — never priced in the page.
export type PlacePhoto = 'ice-karting' | 'st-moritz' | 'livigno-village' | 'livigno-pistes' | 'livigno-halfpipe';
/** photos of places from Wikimedia Commons, used under their licences (cropped); photos supplied by BAS have no entry */
export const credits: Partial<Record<PlacePhoto, { author: string; license: string; licenseUrl?: string; source: string }>> = {
  'livigno-pistes': { author: 'Ting read', license: 'Public domain', source: 'https://commons.wikimedia.org/wiki/File:Livigno_Winter_2013.JPG' },
  'livigno-village': { author: 'qwesy qwesy', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', source: 'https://commons.wikimedia.org/wiki/File:Livigno_-_panoramio_(25)_retouched.jpg' },
  'livigno-halfpipe': { author: 'Vincenzo.togni', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', source: 'https://commons.wikimedia.org/wiki/File:Die_Halfpipe_des_Livigno_Snow_Park_an_den_olympischen_Spielen_2026.jpg' },
};

export const campPage = {
  title: 'BAS CAMP Issue 01 — Snowboard + Ski training camp in Livigno, Italy, 23–27 Dec 2026',
  description: 'Snowboard + ski training camp in Livigno, Italian Alps, with Ilia Baskakov and Aleksey Bogatyrev: coaching, filming and video analysis, a personal programme after camp, ice karting, 4 nights with breakfast. Beginner to advanced, 15 spots, €800. 23–27 December 2026.',
  nav: [
    { label: 'Livigno', href: '#ride' },
    { label: 'Coaches', href: '#coaches' },
    { label: 'Level', href: '#level' },
    { label: 'Schedule', href: '#day' },
    { label: 'Price', href: '#price' },
    { label: 'FAQ', href: '#faq' },
  ],
  join: 'Join',
  menu: 'Menu',
  close: 'Close ✕',
  back: '← Back to start',

  // 01 poster
  hero: {
    issue: 'Issue 01',
    season: 'Winter 26/27',
    kicker: 'BAS CAMP',
    h1: ['Snowboard + Ski', 'training camp.'],
    sub: 'Boost your riding. Enjoy your holiday.',
    dates: ['23—27', 'Dec', '2026'],
    place: 'Italy',
    spots: '15 spots',
    price: '€800',
    levelsLabel: 'Levels',
    levels: ['Beginner', 'Intermediate', 'Advanced'],
    cta: 'Join the camp',
    how: 'How it works ↓',
    scroll: 'Scroll',
    notes: { ride: 'ride / learn / repeat', tourist: 'Crew of 15', date: '23—27.12' },
    photoAlt: 'Ilia Baskakov in a one-hand plant on a rainbow rail, mountains behind',
  },

  // 02 where we ride — photos from Wikimedia Commons, credited on the page (see `credits`)
  ride: {
    kicker: 'Where we ride',
    h2: ['Livigno.', 'Italian Alps.'],
    line: 'Wide pistes. Park sessions. Big mountain views.',
    facts: [
      { v: '115 km', l: 'of pistes', s: 'For every level.' },
      { v: 'The Beach', l: 'snowpark', s: 'Easy & medium lines.' },
      { v: '2026', l: 'Olympic venue', s: 'Snowboard & freestyle.' },
    ],
    photos: [
      { photo: 'livigno-pistes', cap: 'the pistes', alt: 'Snowy Livigno valley seen from the top of a piste, peaks all round' },
      { photo: 'livigno-village', cap: 'the village', alt: 'Livigno village at the bottom of the slopes, skiers on the snow in front' },
      { photo: 'livigno-halfpipe', cap: 'Olympic halfpipe', alt: 'The Livigno Snow Park halfpipe at the 2026 Winter Olympics, a crowd watching' },
    ] as { photo: PlacePhoto; cap: string; alt: string }[],
    note: 'our office',
  },

  // 03 progress with a plan
  idea: {
    kicker: 'The plan',
    h2: ['Progress', 'with a plan.'],
    steps: [
      { n: '01', t: 'Understand.', s: 'Know what holds your riding back and why.' },
      { n: '02', t: 'Improve.', s: 'Targeted exercises. Coach feedback. Repeat and refine.' },
      { n: '03', t: 'Keep going.', s: 'A personal programme after camp: what to train and which exercises to use.' },
    ],
    cta: 'View training programme',
    notes: ['why?', 'again!', 'take it home'],
  },

  // 08 camp organisation + a day at camp
  day: {
    kicker: 'Camp organisation',
    h2: ['We plan.', 'You ride.'],
    lines: ['Training, activities and the daily schedule — organised for you.', 'Know where to be, what’s next and who to ask.'],
    cta: 'View camp guide',
    title: 'A day at camp',
    caveat: 'Example schedule · times may vary.',
    small: [
      { t: '07:00', w: 'Wake up' },
      { t: '07:30', w: 'Warm-up' },
      { t: '08:00', w: 'Breakfast' },
      { t: '08:30', w: 'Out' },
    ],
    mountain: { t: '09:00—14:00', w: 'Mountain.', lines: ['Riding', 'Coaching', 'Exercises', 'Feedback', 'Filming'], alt: 'Ilia and a rider going over a clip on a phone on the slope' },
    after: [
      { t: '14:00—15:00', w: 'Lunch' },
      { t: '15:00—15:30', w: 'Cool-down' },
      { t: '15:30—16:30', w: 'Rest' },
      { t: '16:30—18:00', w: 'Ice karting', hot: true },
      { t: '18:00—19:00', w: 'Dinner' },
    ] as { t: string; w: string; hot?: boolean }[],
    video: { t: '19:00—20:00', w: 'Video review.', line: 'The day’s riding on the screen: what changed, what’s next.', gif: '/clips/camp-video.gif', alt: 'Riders with boards in hand at the top of a run, clouds over the peaks' },
    notes: { mountain: 'the main thing', video: 'the other main thing', kart: 'vroom' },
  },

  // 04 coaches
  coaches: {
    kicker: 'The coaches',
    h2: ['Who’s yelling', '“at least one more”?'],
    ilia: {
      discipline: 'Snowboard',
      name: ['Ilia', 'Baskakov'],
      big: [
        { v: '3×', l: 'National Champion' },
        { v: '1620°', l: 'Biggest spin' },
      ],
      facts: [
        { v: '20', l: 'Years riding' },
        { v: '3', l: 'Years coaching' },
        { v: 'X Games China', l: '2nd place' },
        { v: 'Europa Cup', l: 'Podiums' },
        { v: 'Junior World', l: 'Championship · participant' },
        { v: '3', l: 'Snowboard pro models' },
      ],
      details: [{ l: 'Stance', v: 'Regular' }, { l: 'Favorite trick', v: 'Miller Flip' }],
      alt: 'Ilia Baskakov upside down in the air above a kicker',
      alt2: 'Ilia in a red competition bib, number 27',
      note: 'the face of BAS',
      ig: rider.instagram,
    },
    aleksey: {
      discipline: 'Ski',
      name: ['Aleksey', 'Bogatyrev'],
      role: 'Ski coach',
      big: [
        { v: '14+', l: 'Years on skis' },
        { v: '25 m', l: 'Biggest gap' },
      ],
      facts: [
        { v: 'Lifesteez Media', l: 'Rider + filmer' },
        { v: 'Action sports', l: 'Cinematographer' },
      ],
      bio: [
        'Started freeskiing in 2012 after 10+ years of aggressive inline skating.',
        'Coaches beginner → advanced. Based in the Austrian Alps.',
        'Works across skiing, snowboarding and action-sports film production.',
      ],
      tricks: { l: 'Favorite tricks', v: ['Knuckle nose butter 7', 'Tail press variations'] },
      alt: 'Aleksey Bogatyrev on skis, crossing his skis over a rail in a snowy park',
      note: 'behind the camera too',
      ig: 'aleksey_bogatyrev',
    },
  },

  // 05 level
  level: {
    kicker: 'Your level',
    h2: ['Start where', 'you are.'],
    sub: 'From your first turn to your next trick.',
    steps: [
      { k: 'Zero', t: 'Never skied or snowboarded?', s: 'We can start from the beginning.' },
      { k: 'Beginner', t: 'Build confidence,', s: 'turns, control and fundamentals.' },
      { k: 'Intermediate', t: 'Clean up technique', s: 'and build stronger riding.' },
      { k: 'Progression', t: 'Carving. Freestyle. Park.', s: 'Specific skills.' },
    ],
    caveat: 'Depending on ability, readiness and mountain conditions.',
    groups: { a: 'Snowboard', b: 'Ski', mid: ['Groups', 'by level'] },
    groupLine: 'Split by discipline first, then by level: experienced riders don’t train in the same group as first-day beginners.',
    note: 'all levels. for real.',
    proof: 'See how riders progress with Ilia',
  },

  // 07 the five days
  schedule: {
    kicker: 'The five days',
    h2: ['5 days.', 'No copy-paste days.'],
    days: [
      { d: '23', m: 'Dec', t: ['Ride.'], body: 'Coached riding / training day.', small: 'Exact hours depend on arrival and logistics.', tone: 'paper' },
      { d: '24', m: 'Dec', t: ['Ride.', 'Then spa.'], body: 'Training day. Spa in the evening.', stamp: 'Spa entrance not included', tone: 'ice' },
      { d: '25', m: 'Dec', t: ['Off.', 'St. Moritz.'], body: 'Recovery, a day trip, hanging out. Current plan: St. Moritz.', small: 'What you spend in St. Moritz isn’t part of the €800.', tone: 'pink' },
      { d: '26', m: 'Dec', t: ['Back on.'], body: 'Coached riding day: apply and lock in what you worked on.', tone: 'red' },
      { d: '27', m: 'Dec', t: ['One more?'], body: 'Departure. Optional riding until lunch, depending on your travel plans and mountain conditions.', tone: 'dark' },
    ],
    notes: { xmas: 'christmas!!', arrow: 'then →' },
  },

  // 06 camp life — where the crew goes off the slope
  life: {
    kicker: 'Camp life',
    h2: ['Yes, we leave', 'the slope sometimes.'],
    line: 'Off the board we go together. Here’s where:',
    stamp: 'We’re going',
    acts: [
      { photo: 'ice-karting', cap: 'Ice karting', when: 'After riding', alt: 'Two drivers in orange helmets racing red karts side by side on a snow track', src: 'place' },
      { photo: 'sauna', cap: 'Spa', when: '24 Dec, evening', note: 'Entry not included', alt: 'A rider in a felt sauna hat resting in a wooden sauna', src: 'own' },
      { photo: 'st-moritz', cap: 'St. Moritz', when: '25 Dec, day trip', alt: 'St. Moritz at dusk above its frozen lake, hotels lit up under a snowy pine slope', src: 'place' },
    ] as { photo: PlacePhoto | 'sauna'; cap: string; when: string; note?: string; alt: string; src: 'place' | 'own' }[],
  },

  // 07 the crew
  crew: {
    kicker: 'Community',
    h2: ['Same mountain.', 'Same crew.'],
    lines: [
      'BAS is a bunch of riders and skiers who train together, eat together and watch each other’s clips at night.',
      'Snowboard and ski culture from the inside: park laps, filming, the jokes from the lift line. Coming alone is normal — you won’t ride alone.',
    ],
    tiles: [
      { photo: 'crew', cap: 'Crew', alt: 'Riders lined up on the snow behind the fence, laughing and throwing horns', pos: '50% 62%' },
      { photo: 'dinner', cap: 'Dinner', alt: 'The whole crew around a long table of pizza boxes after riding', pos: '50% 62%' },
      { photo: 'glacier', cap: 'Alps', alt: 'A rider in a red jacket pulling on goggles above a glacier', pos: '50% 40%' },
      { photo: 'bandana', cap: 'Park', alt: 'A rider in a skull bandana and silver sunglasses looking over the park', pos: '50% 30%' },
      { photo: 'fisheye', cap: 'Snow', alt: 'Fisheye shot of a rider in yellow doing a handplant in the park', pos: '50% 50%' },
    ] as { photo: 'glacier' | 'fisheye' | 'bandana' | 'crew' | 'dinner'; cap: string; alt: string; pos?: string }[],
    note: 'the crew',
    swipe: 'swipe →',
  },

  // 10 price
  price: {
    kicker: 'Price',
    value: '€800',
    h2: 'What’s included?',
    inLabel: 'In',
    outLabel: 'Out',
    included: ['4 nights’ accommodation', 'Hotel breakfasts', 'Snowboard or ski coaching & tailored exercises', 'Filming & video analysis', 'Personal training programme after camp', 'Warm-up & cool-down', 'Ice karting', 'Camp organisation'],
    excluded: ['Ski pass', 'Travel to and from the camp', 'Equipment rental', 'Lunch, dinner & other food and drinks', 'Spa entry'],
    note: 'no small print',
    cta: 'Join the camp',
  },

  // 12 faq
  faq: {
    kicker: 'Questions',
    h2: 'FAQ',
    items: [
      { q: 'I’ve never been on a snowboard / skis. Can I come?', a: 'Yes. Complete beginners are welcome.' },
      { q: 'Can experienced riders join?', a: 'Yes. Groups are divided by discipline and level.' },
      { q: 'Can I come alone?', a: 'Yes.' },
      { q: 'Snowboard or ski?', a: 'Both. There is a snowboard coach and a ski coach.' },
      { q: 'How many people?', a: 'Maximum 15 participants.' },
      { q: 'Is the hotel included?', a: 'Yes. 4 nights.' },
      { q: 'Where do we stay?', a: 'Meublè Rosalpina, a family-run guesthouse in Valdidentro (Via San Carlo 16), next to Livigno.' },
      { q: 'Is breakfast included?', a: 'Yes.' },
      { q: 'Is ice karting included?', a: 'Yes.' },
      { q: 'Is the ski pass included?', a: 'No.' },
      { q: 'Is the spa included?', a: 'No.' },
      { q: 'Is rental included?', a: 'No.' },
      { q: 'What happens on December 25?', a: 'Current plan: day off / St. Moritz.' },
      { q: 'Can I ride on December 27?', a: 'Potentially until lunch, depending on departure plans and conditions.' },
      // TODO(campFaq): confirm these three before launch — nothing is promised until then
      { q: 'How do we get there?', a: '[To be confirmed: travel to Livigno / Valdidentro]', todo: true },
      { q: 'Payment / deposit?', a: '[To be confirmed: payment and deposit]', todo: true },
      { q: 'Cancellation?', a: '[To be confirmed: cancellation policy]', todo: true },
    ] as { q: string; a: string; todo?: boolean }[],
  },

  // 13 final poster + application
  apply: {
    issue: 'Issue 01',
    h2: ['See you', 'on the mountain.'],
    poster: [['Italy', ''], ['23—27 Dec', '2026'], ['15 spots', ''], ['€800', '']],
    kicker: 'Apply',
    lead: 'Not a payment — an application. We’ll contact you to confirm your place, riding group and next steps.',
    name: 'Name',
    contact: 'Contact',
    contactHint: 'Instagram / Telegram / email',
    contactPh: '@yourname or you@example.com',
    discipline: 'Discipline',
    disciplines: ['Snowboard', 'Ski'] as const,
    level: 'Level',
    levels: [['first', 'First time'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] as [string, string][],
    message: 'Message',
    optional: '(optional)',
    messagePh: 'Anything we should know? What do you want to work on?',
    promo: { toggle: 'Got a code?', label: 'Code', apply: 'Apply', saved: 'Got it — we’ll check it when we confirm your place.', checking: 'Checking…', bad: 'That code didn’t work. Check it, or leave it empty.' },
    submit: 'Apply for BAS CAMP',
    sending: 'Sending…',
    errors: {
      name: 'Your name, please.',
      contact: 'How can we reach you? Instagram, Telegram or email.',
      email: 'That email looks off.',
      level: 'Pick your level.',
      network: 'Couldn’t send it. Check your connection and try again.',
    },
    sent: {
      stamp: 'Application in',
      line: (first: string) => `See you on the mountain, ${first}.`,
      reply: 'We’ll contact you to confirm your place, riding group and next steps.',
      again: 'Send another',
    },
    // no form backend yet: the application goes to Ilia as an Instagram DM the rider sends themselves
    handoff: {
      stamp: 'One last step',
      line: 'Send it to Ilia on Instagram.',
      body: 'Your application is ready. Copy it, paste it into the chat with @baskakov74 and hit send. We’ll contact you to confirm your place, riding group and next steps.',
      copy: 'Copy & open Instagram',
      copied: 'Copied — paste it in the chat',
      open: 'Open Instagram only',
      label: 'Your application',
      intro: 'Hi Ilia! I’d like to join BAS CAMP Issue 01, Italy, 23–27 Dec 2026.',
    },
  },
  sticky: { dates: '23—27 Dec', price: '€800', cta: 'Join →' },
  footer: {
    issue: 'BAS CAMP · Issue 01 · Winter 26/27',
    back: '← Back to start',
    toTop: '↑ Back to top',
  },
};

export const seo = {
  title: 'Ilia Baskakov — Pro snowboarder & coach · BAS',
  description: 'Ilia Baskakov, professional snowboarder and coach: 2nd at X Games China, 3× National Champion, Europa Cup podiums, 20 years riding, 1620° biggest spin. Private coaching (€100 an hour, €300 a day) and BAS CAMP, 23–27 December 2026 in Italy.',
  ogAlt: 'Ilia Baskakov — Ride better.',
};
