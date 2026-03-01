# Studio Co-op — MVP User Stories

_Organized by user role. Priority: P0 = MVP must-have, P1 = next, P2 = later_

## Member Stories

### Booking
- **P0** As a member, I can view the weekly class schedule so I know what's available
- **P0** As a member, I can book a class with one tap
- **P0** As a member, I can cancel my booking (within the studio's cancellation window)
- **P0** As a member, I can see my upcoming bookings in one place
- **P0** As a member, I receive a push notification reminding me of my class (configurable: 24h, 2h before)
- **P0** As a member, I can confirm I'm still coming via a one-tap push notification
- **P0** As a member, I can join a waitlist when a class is full
- **P0** As a member, I get notified when a waitlist spot opens up
- **P1** ✅ As a member, I can pick my spot (pole, bike, reformer) when booking _(SpotPicker grid component on class detail page, shows available/taken/selected spots)_
- **P1** ✅ As a member, my booking automatically appears in my Google/Apple calendar _(Add to Calendar .ics download on class detail page)_

### Community
- **P0** As a member, I can see a feed of posts from classes I attended
- **P0** As a member, I can post photos/text to the class feed after attending
- **P0** As a member, I can see other attendees' posts from the same class
- **P1** ✅ As a member, I can react to feed posts (❤️, 🔥, 👏) _(API + UI in class detail feed)_
- **P1** ✅ As a member, I can see my attendance streak / stats _(stats card on member detail page)_
- **P2** ✅ As a member, I can share an achievement ("I got my invert!") _(achievements table + API + UI on member detail + feed posts with amber styling)_
- **P2** ✅ As a member, I can control what other members see about me (privacy settings) _(Privacy tab in settings: profile visibility, attendance, email, phone, achievements toggles)_

### Profile
- **P0** As a member, I can set up my profile with name and photo
- **P0** As a member, I can see my attendance history
- **P1** ✅ As a member, I can be a member of multiple studios with one account _(useStudioId hook + StudioSwitcher dropdown in dashboard header)_
- **P2** ✅ As a member, I can track my skill progression (discipline-specific) _(skill_definitions + member_skills tables, 8 discipline presets, level badges, teacher verification)_

## Teacher Stories

### Check-In
- **P0** As a teacher, I see a photo grid of everyone booked for my upcoming class
- **P0** As a teacher, I can tap to mark each person as present or absent
- **P0** As a teacher, I can add a walk-in who didn't book
- **P0** As a teacher, I can see member notes (injuries, experience level) at a glance
- **P0** As a teacher, I can complete check-in in under 30 seconds

### Class Management
- **P0** As a teacher, I can see my upcoming schedule
- **P0** As a teacher, I can post to the class feed (instructor posts)
- **P1** ✅ As a teacher, I can add/edit notes on a member's profile _(API endpoint + inline edit UI on member detail page)_
- **P2** ✅ As a teacher, I can request a sub for a class I can't teach _(sub_requests table + API + schedule/class detail UI with accept/cancel flow)_
- **P2** ✅ As a teacher, I can see my class attendance trends _(API endpoint + "My Teaching Stats" card on reports page with weekly trends + top classes)_

## Studio Owner Stories

### Setup
- **P0** As an owner, I can create my studio with name, discipline type, logo, and timezone
- **P0** As an owner, I can set up my class schedule (recurring templates)
- **P0** As an owner, I can invite teachers and assign them to classes
- **P0** As an owner, I can configure cancellation window (e.g., 12h before class)
- **P0** As an owner, I can set max capacity per class

### Management
- **P0** As an owner, I can see all my members in a searchable list
- **P0** As an owner, I can see attendance for any class
- **P0** As an owner, I can cancel a class instance (e.g., teacher sick) and notify all booked members
- **P1** ✅ As an owner, I can see analytics: attendance trends, popular classes, retention _(full reports page with 4 tabs + 5 API endpoints)_
- **P1** ✅ As an owner, I can configure the class community feed settings _(feed notifications toggle in settings)_
- **P1** ✅ As an owner, I can set up waitlist rules (auto-promote, notification timing) _(Waitlist settings tab: auto-promote toggle, confirmation window, max size, position notify)_
- **P2** ✅ As an owner, I can set up membership plans and pricing (Stripe Connect) _(full plan CRUD + Stripe Connect integration)_
- **P2** ✅ As an owner, I can enable/disable discipline-specific features _(feature flags system with global/studio/tier scopes)_
- **P2** ✅ As an owner, I can import members from Mindbody CSV export _(complete migration tool: upload → auto-detect → map → preview → execute)_

### Notifications
- **P0** As an owner, I can see who confirmed vs unconfirmed for upcoming classes
- **P1** ✅ As an owner, I can configure "we missed you" re-engagement messages _(settings toggle + days threshold + daily cron job)_
- **P1** ✅ As an owner, I can see a dashboard: "Smart confirmations saved X no-shows this month" _(green banner on reports page)_

---

## MVP Acceptance Criteria

The MVP is ready to test at one studio when:

1. ✅ A member can download the app, create an account, and join a studio
2. ✅ A member can view the schedule and book a class
3. ✅ A member gets a reminder notification before class
4. ✅ A teacher can open the check-in view and see a photo grid of booked members
5. ✅ A teacher can mark attendance with taps in <30 seconds
6. ✅ After class, attendees can see and post to a class-specific feed
7. ✅ Non-attendees CANNOT see the class feed (privacy verified)
8. ✅ An owner can set up the schedule and manage members via web dashboard
9. ✅ Waitlist works: when someone cancels, next person gets notified and promoted

That's 9 flows. If all 9 work at one pole studio, we have an MVP.
