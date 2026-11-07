// One small outline icon set for the rider area: 24px grid, 1.6 stroke, round joins, drawn in currentColor.
// Used by the tab bars, the avatar menu and a few row actions. Plain strings so both .astro files and the
// page scripts can drop them in.
const svg = (body: string, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  // a hut with a pitched roof: home
  home: svg('<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  // a calendar with a plus: book
  book: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/><path d="M12 12.5v5M9.5 15h5"/>'),
  // a week grid: sessions / timetable
  sessions: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/><path d="M8 13h2M12 13h2M16 13h0M8 16.5h2M12 16.5h2"/>'),
  // three heads: the crew
  crew: svg('<circle cx="12" cy="8.5" r="3"/><path d="M6.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="5.5" cy="10" r="2"/><path d="M2.5 17.5c.3-1.7 1.4-2.8 3-3"/><circle cx="18.5" cy="10" r="2"/><path d="M21.5 17.5c-.3-1.7-1.4-2.8-3-3"/>'),
  // a rising line: progress
  progress: svg('<path d="M4 19h16"/><path d="M5 15.5l4-4 3 3 6-6.5"/><path d="M15 8h3v3"/>'),
  // a person: profile
  profile: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>'),
  // a tent under a peak: camps
  camps: svg('<path d="M3 20h18"/><path d="M5 20 12 7l7 13"/><path d="M12 20v-5"/><path d="M9.5 6 12 2l2.5 4"/>'),
  // two sliders: settings
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  // a clipboard: coach
  coach: svg('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3.5h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'),
  // door with arrow: sign out
  signout: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h9"/>'),
  // arrow out of a box: external
  external: svg('<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  chevronR: svg('<path d="M9.5 6l6 6-6 6"/>', 'ico ico--sm'),
  chevronL: svg('<path d="M14.5 6l-6 6 6 6"/>', 'ico ico--sm'),
  pin: svg('<path d="M12 21s-6-5.4-6-10.5A6 6 0 0 1 18 10.5C18 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>', 'ico ico--sm'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>', 'ico ico--sm'),
  repeat: svg('<path d="M17 3l3 3-3 3"/><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4"/>', 'ico ico--sm'),
  camera: svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.5" r="3.2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'ico ico--sm'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
} as const;
