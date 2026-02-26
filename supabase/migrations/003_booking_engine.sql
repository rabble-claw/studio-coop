-- Booking engine: add credit tracking to bookings for accurate refunds on cancellation.
-- credit_source / credit_source_id record which payment bucket was charged at booking time
-- so we can reverse the exact same deduction when a member cancels.

alter table public.bookings
  add column if not exists credit_source text
    check (credit_source in (
      'subscription_unlimited',
      'subscription_limited',
      'class_pack',
      'comp_class'
    )),
  add column if not exists credit_source_id uuid;

-- Index to speed up "find bookings by class + status" queries used by waitlist promotion
create index if not exists idx_bookings_class_waitlist
  on public.bookings(class_instance_id, waitlist_position)
  where status = 'waitlisted';

-- Composite unique index: a user can only have one non-cancelled booking per class
create unique index if not exists uq_bookings_user_class_active
  on public.bookings(user_id, class_instance_id)
  where status not in ('cancelled', 'no_show');
