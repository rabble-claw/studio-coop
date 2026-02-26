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
- **P1** As a member, I can pick my spot (pole, bike, reformer) when booking
- **P1** As a member, my booking automatically appears in my Google/Apple calendar

### Community
- **P0** As a member, I can see a feed of posts from classes I attended
- **P0** As a member, I can post photos/text to the class feed after attending
- **P0** As a member, I can see other attendees' posts from the same class
- **P1** As a member, I can react to feed posts (❤️, 🔥, 👏)
- **P1** As a member, I can see my attendance streak / stats
- **P2** As a member, I can share an achievement ("I got my invert!")
- **P2** As a member, I can control what other members see about me (privacy settings)

### Profile
- **P0** As a member, I can set up my profile with name and photo
- **P0** As a member, I can see my attendance history
- **P1** As a member, I can be a member of multiple studios with one account
- **P2** As a member, I can track my skill progression (discipline-specific)

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
- **P1** As a teacher, I can add/edit notes on a member's profile
- **P2** As a teacher, I can request a sub for a class I can't teach
- **P2** As a teacher, I can see my class attendance trends

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
- **P1** As an owner, I can see analytics: attendance trends, popular classes, retention
- **P1** As an owner, I can configure the class community feed settings
- **P1** As an owner, I can set up waitlist rules (auto-promote, notification timing)
- **P2** As an owner, I can set up membership plans and pricing (Stripe Connect)
- **P2** As an owner, I can enable/disable discipline-specific features
- **P2** As an owner, I can import members from Mindbody CSV export

### Notifications
- **P0** As an owner, I can see who confirmed vs unconfirmed for upcoming classes
- **P1** As an owner, I can configure "we missed you" re-engagement messages
- **P1** As an owner, I can see a dashboard: "Smart confirmations saved X no-shows this month"

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
