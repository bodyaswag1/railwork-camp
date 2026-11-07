# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Riders**: adult snowboarders and skiers coached by Ilia Baskakov (BAS CAMP). Most are beginner to
  intermediate; some are park riders. They open the rider area mostly on a phone, often away from home:
  at the hall, at the resort, before a camp. The jobs they come for: see the next session, book one,
  check their weekly slot, keep their streak, and see the crew.
- **Coaches** (Ilia and the coaches he adds): publish trampoline and personal sessions, run rosters,
  mark attendance and payment, confirm levels and tricks, and manage camp entries. Mostly on a laptop
  between sessions, sometimes a phone at the hall.

## Product Purpose

bascamp.world is the BAS CAMP site: a punk snowboard magazine plus camp pages. The rider area
(`/me`, `/book`, `/community`, `/camps`, `/coach`) is the logged-in part. It turns a coaching
relationship that used to run on Instagram DMs into a timetable, a booking flow and a record of
progress. It succeeds when a rider can book or move a session in under a minute on a phone, and keeps
riding week after week.

## Positioning

Modelled process-for-process on GameChanger Academy (a tennis club in Prague), adapted to snowboarding:
personal sessions that repeat weekly ("weekly slot"), trampoline group sessions for air awareness and
trick preparation, and camps (a group, a place, a set of days). Progress is measured by turning up and
by tricks a coach confirms, never by ranking riders against each other.

## Operating Context

- Session kinds: personal (1:1 on the slope, can repeat weekly), trampoline (group, at a hall),
  camps (multi-day, apply → accepted → deposit → paid).
- Reserve now, pay offline. Packs of sessions are sold by the coach. Free changes until 48 hours
  before a session. Times are Europe/Vienna.
- Accounts: open sign-up plus coach invite links. A short riding questionnaire at sign-up.
- Streak: weeks with at least one session; a logged trip pauses it, never breaks it.
- Community: opt-in listing only. Feed (joined, level confirmed, trick landed, camp), crew directory,
  "ride together" posts, highlights.

## Capabilities and Constraints

- Astro static pages, browser-side Supabase (RLS on every table, privileged writes via SQL functions),
  Vercel hosting. No client framework; one script per page.
- Riders: phone first. Coaches: laptop first.
- Photos: rider avatars exist (Supabase storage). Session, camp and crew photos are placeholder slots
  until coach uploads are built.
- Undecided: confirmation emails for bookings/camps, monthly summaries, referrals.

## Brand Commitments

- Name: BAS CAMP / bascamp.world. Coach: Ilia Baskakov (@baskakov74).
- The public site is punk/zine (torn paper, graffiti marker, rotating boards). The rider area keeps the
  BAS palette and type but at an app register: usable first, the punk shows in details only.
- Named colours: Night Run #101314, Lift Tower #474C48, Slush Concrete #ABAAA6, Airbag Ice #E1EFFA,
  Park Signal #BA1422, Goggle Tint #FF94E3. Faces: Archivo (display), Onest (text), Most Wazted (marker).

## Evidence on Hand

- Real: the italy-2026 camp (Livigno, 23–27 Dec 2026, 15 spots, €999, €250 deposit), the 7-band level
  ladder, the 31-trick list, badges (founding rider, first session, ten sessions, 4/12-week streaks,
  first trick, five tricks, first camp, first trampoline).
- No real rider photos, testimonials or member counts. Do not invent them.

## Product Principles

1. Sessions first: the next session and the way to book one are always one tap away.
2. No rankings, ever. Progress is turning up and coach-confirmed tricks and levels.
3. Private by default. A rider appears to others only when they switch it on.
4. A module with nothing real to show hides itself or says so plainly; never a wall of zeros.
5. Settings are quiet: switches and short forms open on demand, never a form shouting at you.

## Accessibility & Inclusion

Outdoor phone use in bright light and gloves: large tap targets (44px+), strong contrast, no meaning
carried by colour alone.
