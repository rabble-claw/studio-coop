-- ============================================================
-- SEED DATA: Empire Aerial Arts — Wellington, NZ
-- ============================================================
-- The studio on Cuba Street, Wellington.
-- Disciplines: pole, aerial hoop, aerial silks, handbalance,
--              hula hoop, flexibility, strength & conditioning
-- ============================================================

-- Clean slate (idempotent)
truncate public.coupon_redemptions, public.coupons, public.comp_classes,
         public.payments, public.class_passes, public.subscriptions,
         public.membership_plans, public.migration_imports,
         public.private_bookings, public.studio_network_members,
         public.studio_networks, public.feed_posts, public.attendance,
         public.bookings, public.class_instances, public.class_templates,
         public.memberships, public.notifications, public.studios,
         public.users cascade;

-- ============================================================
-- USERS (fixed UUIDs for cross-referencing)
-- ============================================================
-- Owner
insert into public.users (id, email, name, avatar_url) values
  ('aa000000-0000-0000-0000-000000000001', 'alex@empireaerialarts.com', 'Alex Rivera',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Alex&backgroundColor=ffd5dc');

-- Teachers
insert into public.users (id, email, name, avatar_url) values
  ('aa000000-0000-0000-0000-000000000002', 'jade@empireaerialarts.com', 'Jade Nguyen',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Jade&backgroundColor=c0aede'),
  ('aa000000-0000-0000-0000-000000000003', 'tane@empireaerialarts.com', 'Tane Wiremu',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Tane&backgroundColor=b6e3f4'),
  ('aa000000-0000-0000-0000-000000000004', 'sophie@empireaerialarts.com', 'Sophie Chen',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Sophie&backgroundColor=ffd5dc'),
  ('aa000000-0000-0000-0000-000000000005', 'maia@empireaerialarts.com', 'Maia Robinson',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Maia&backgroundColor=d1d4f9');

-- Members (15)
insert into public.users (id, email, name, avatar_url) values
  ('aa000000-0000-0000-0000-000000000010', 'aroha@gmail.com', 'Aroha Patel',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Aroha&backgroundColor=ffd5dc'),
  ('aa000000-0000-0000-0000-000000000011', 'lily.w@outlook.com', 'Lily Williamson',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Lily&backgroundColor=c0aede'),
  ('aa000000-0000-0000-0000-000000000012', 'sam.k@gmail.com', 'Sam Kairua',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=SamK&backgroundColor=b6e3f4'),
  ('aa000000-0000-0000-0000-000000000013', 'grace.lee@gmail.com', 'Grace Lee',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Grace&backgroundColor=ffd5dc'),
  ('aa000000-0000-0000-0000-000000000014', 'nina.r@icloud.com', 'Nina Rossi',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Nina&backgroundColor=d1d4f9'),
  ('aa000000-0000-0000-0000-000000000015', 'jordan.t@outlook.com', 'Jordan Taylor',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=JordanT&backgroundColor=b6e3f4'),
  ('aa000000-0000-0000-0000-000000000016', 'mia.h@gmail.com', 'Mia Henare',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Mia&backgroundColor=ffd5dc'),
  ('aa000000-0000-0000-0000-000000000017', 'ruby.m@outlook.com', 'Ruby Mitchell',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Ruby&backgroundColor=c0aede'),
  ('aa000000-0000-0000-0000-000000000018', 'zoe.w@gmail.com', 'Zoe Walker',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Zoe&backgroundColor=d1d4f9'),
  ('aa000000-0000-0000-0000-000000000019', 'alex.m@icloud.com', 'Alex Morgan',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=AlexM&backgroundColor=b6e3f4'),
  ('aa000000-0000-0000-0000-000000000020', 'casey.b@gmail.com', 'Casey Brown',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Casey&backgroundColor=ffd5dc'),
  ('aa000000-0000-0000-0000-000000000021', 'tara.s@outlook.com', 'Tara Singh',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Tara&backgroundColor=c0aede'),
  ('aa000000-0000-0000-0000-000000000022', 'indi.k@gmail.com', 'Indi Kaur',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Indi&backgroundColor=d1d4f9'),
  ('aa000000-0000-0000-0000-000000000023', 'freya.j@icloud.com', 'Freya Jones',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Freya&backgroundColor=b6e3f4'),
  ('aa000000-0000-0000-0000-000000000024', 'hana.m@gmail.com', 'Hana Moana',
   'https://api.dicebear.com/9.x/avataaars/svg?seed=Hana&backgroundColor=ffd5dc');

-- ============================================================
-- STUDIO
-- ============================================================
insert into public.studios (id, name, slug, discipline, description, timezone, currency, settings, tier) values
  ('bb000000-0000-0000-0000-000000000001',
   'Empire Aerial Arts',
   'empire-aerial-arts',
   'aerial',
   'Wellington''s home for pole, aerial, and circus arts. Cuba Street vibes, all levels welcome. Come fly with us!',
   'Pacific/Auckland',
   'NZD',
   '{"cancellationWindowHours": 6, "defaultMaxCapacity": 10, "confirmationReminderHours": [24, 2], "feedEnabled": true, "waitlistEnabled": true, "spotSelectionEnabled": false}',
   'studio');

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
-- Owner
insert into public.memberships (user_id, studio_id, role, status, tags) values
  ('aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'owner', 'active', '{}');

-- Teachers
insert into public.memberships (user_id, studio_id, role, status, tags) values
  ('aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000001', 'teacher', 'active', '{"pole","aerial hoop"}'),
  ('aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000001', 'teacher', 'active', '{"handbalance","strength"}'),
  ('aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000001', 'teacher', 'active', '{"silks","flexibility"}'),
  ('aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000001', 'teacher', 'active', '{"hula hoop","dance"}');

-- Members
insert into public.memberships (user_id, studio_id, role, status, tags) values
  ('aa000000-0000-0000-0000-000000000010', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L3"}'),
  ('aa000000-0000-0000-0000-000000000011', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L2"}'),
  ('aa000000-0000-0000-0000-000000000012', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L4"}'),
  ('aa000000-0000-0000-0000-000000000013', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L1"}'),
  ('aa000000-0000-0000-0000-000000000014', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"casual"}'),
  ('aa000000-0000-0000-0000-000000000015', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L2"}'),
  ('aa000000-0000-0000-0000-000000000016', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L3"}'),
  ('aa000000-0000-0000-0000-000000000017', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"casual"}'),
  ('aa000000-0000-0000-0000-000000000018', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L1"}'),
  ('aa000000-0000-0000-0000-000000000019', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L5"}'),
  ('aa000000-0000-0000-0000-000000000020', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"casual"}'),
  ('aa000000-0000-0000-0000-000000000021', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L2"}'),
  ('aa000000-0000-0000-0000-000000000022', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L3"}'),
  ('aa000000-0000-0000-0000-000000000023', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"casual"}'),
  ('aa000000-0000-0000-0000-000000000024', 'bb000000-0000-0000-0000-000000000001', 'member', 'active', '{"regular","L1"}');

-- ============================================================
-- CLASS TEMPLATES
-- ============================================================
-- Pole classes (taught by Alex + Jade)
insert into public.class_templates (id, studio_id, name, description, teacher_id, day_of_week, start_time, duration_min, max_capacity, location, recurrence) values
  ('cc000000-0000-0000-0000-000000000001',
   'bb000000-0000-0000-0000-000000000001',
   'Pole Technique L1',
   'Your first steps on the pole! Learn basic spins, climbs, and holds in a supportive environment. No experience needed.',
   'aa000000-0000-0000-0000-000000000001',
   1, '18:00', 60, 10, 'Studio A', 'weekly'),
  ('cc000000-0000-0000-0000-000000000002',
   'bb000000-0000-0000-0000-000000000001',
   'Pole Technique L2',
   'Build on your basics with inverts, combos, and flow transitions. Prerequisites: L1 complete.',
   'aa000000-0000-0000-0000-000000000002',
   2, '18:30', 75, 10, 'Studio A', 'weekly'),
  ('cc000000-0000-0000-0000-000000000003',
   'bb000000-0000-0000-0000-000000000001',
   'Pole Technique L3',
   'Intermediate tricks, combos, and choreography. Get upside down with confidence.',
   'aa000000-0000-0000-0000-000000000001',
   3, '18:30', 75, 8, 'Studio A', 'weekly'),
  ('cc000000-0000-0000-0000-000000000004',
   'bb000000-0000-0000-0000-000000000001',
   'Pole Technique L4-5',
   'Advanced pole for experienced students. Complex combos, deadlifts, and choreography.',
   'aa000000-0000-0000-0000-000000000002',
   4, '19:00', 90, 8, 'Studio A', 'weekly');

-- Aerial classes
insert into public.class_templates (id, studio_id, name, description, teacher_id, day_of_week, start_time, duration_min, max_capacity, location, recurrence) values
  ('cc000000-0000-0000-0000-000000000005',
   'bb000000-0000-0000-0000-000000000001',
   'Aerial Hoop',
   'Learn tricks and sequences on the lyra (aerial hoop). All levels welcome, we''ll give you options.',
   'aa000000-0000-0000-0000-000000000002',
   1, '19:15', 60, 8, 'Studio B', 'weekly'),
  ('cc000000-0000-0000-0000-000000000006',
   'bb000000-0000-0000-0000-000000000001',
   'Aerial Silks',
   'Climb, wrap, and drop on the aerial silks. Beautiful and challenging — you''ll love it.',
   'aa000000-0000-0000-0000-000000000004',
   3, '17:00', 75, 6, 'Studio B', 'weekly');

-- Specialties
insert into public.class_templates (id, studio_id, name, description, teacher_id, day_of_week, start_time, duration_min, max_capacity, location, recurrence) values
  ('cc000000-0000-0000-0000-000000000007',
   'bb000000-0000-0000-0000-000000000001',
   'Handbalance',
   'Handstand progressions, press work, and balance drills. Build a solid foundation with Tane.',
   'aa000000-0000-0000-0000-000000000003',
   5, '17:30', 60, 12, 'Open Floor', 'weekly'),
  ('cc000000-0000-0000-0000-000000000008',
   'bb000000-0000-0000-0000-000000000001',
   'Hula Hoop Flow',
   'On-body and off-body hooping for all levels. Dance, flow, and have fun with Maia.',
   'aa000000-0000-0000-0000-000000000005',
   2, '17:00', 60, 14, 'Open Floor', 'weekly'),
  ('cc000000-0000-0000-0000-000000000009',
   'bb000000-0000-0000-0000-000000000001',
   'Flexibility',
   'Active and passive stretching for splits, backbends, and shoulders. All levels.',
   'aa000000-0000-0000-0000-000000000004',
   6, '10:00', 60, 14, 'Studio B', 'weekly'),
  ('cc000000-0000-0000-0000-000000000010',
   'bb000000-0000-0000-0000-000000000001',
   'Strength & Conditioning',
   'Cross-training for aerialists. Core, grip, upper body, and mobility work.',
   'aa000000-0000-0000-0000-000000000003',
   6, '11:15', 60, 16, 'Open Floor', 'weekly');

-- ============================================================
-- CLASS INSTANCES — current week (Mon 23 Feb – Sun 1 Mar 2026)
-- Plus some from last week (completed) for attendance/feed data
-- ============================================================

-- PAST WEEK — completed classes for history
insert into public.class_instances (id, template_id, studio_id, teacher_id, date, start_time, end_time, status, max_capacity, feed_enabled) values
  -- Mon 16 Feb — Pole L1
  ('dd000000-0000-0000-0000-000000000050',
   'cc000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-02-16', '18:00', '19:00', 'completed', 10, true),
  -- Mon 16 Feb — Aerial Hoop
  ('dd000000-0000-0000-0000-000000000051',
   'cc000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-02-16', '19:15', '20:15', 'completed', 8, true),
  -- Tue 17 Feb — Pole L2
  ('dd000000-0000-0000-0000-000000000052',
   'cc000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-02-17', '18:30', '19:45', 'completed', 10, true),
  -- Wed 18 Feb — Pole L3
  ('dd000000-0000-0000-0000-000000000053',
   'cc000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-02-18', '18:30', '19:45', 'completed', 8, true),
  -- Sat 21 Feb — Flexibility
  ('dd000000-0000-0000-0000-000000000054',
   'cc000000-0000-0000-0000-000000000009', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000004',
   '2026-02-21', '10:00', '11:00', 'completed', 14, true),
  -- Sat 21 Feb — Strength
  ('dd000000-0000-0000-0000-000000000055',
   'cc000000-0000-0000-0000-000000000010', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000003',
   '2026-02-21', '11:15', '12:15', 'completed', 16, true),
  -- Mon 23 Feb — Pole L1
  ('dd000000-0000-0000-0000-000000000056',
   'cc000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-02-23', '18:00', '19:00', 'completed', 10, true),
  -- Mon 23 Feb — Aerial Hoop
  ('dd000000-0000-0000-0000-000000000057',
   'cc000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-02-23', '19:15', '20:15', 'completed', 8, true),
  -- Tue 24 Feb — Hula Hoop
  ('dd000000-0000-0000-0000-000000000058',
   'cc000000-0000-0000-0000-000000000008', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000005',
   '2026-02-24', '17:00', '18:00', 'completed', 14, true),
  -- Tue 24 Feb — Pole L2
  ('dd000000-0000-0000-0000-000000000059',
   'cc000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-02-24', '18:30', '19:45', 'completed', 10, true),
  -- Wed 25 Feb — Silks
  ('dd000000-0000-0000-0000-000000000060',
   'cc000000-0000-0000-0000-000000000006', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000004',
   '2026-02-25', '17:00', '18:15', 'completed', 6, true),
  -- Wed 25 Feb — Pole L3
  ('dd000000-0000-0000-0000-000000000061',
   'cc000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-02-25', '18:30', '19:45', 'completed', 8, true);

-- THIS WEEK — upcoming scheduled classes (Thu 26 Feb onward)
insert into public.class_instances (id, template_id, studio_id, teacher_id, date, start_time, end_time, status, max_capacity, feed_enabled) values
  -- Thu 26 Feb — Pole L4-5
  ('dd000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-02-26', '19:00', '20:30', 'scheduled', 8, true),
  -- Fri 27 Feb — Handbalance
  ('dd000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000007', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000003',
   '2026-02-27', '17:30', '18:30', 'scheduled', 12, true),
  -- Sat 28 Feb — Flexibility
  ('dd000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000009', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000004',
   '2026-02-28', '10:00', '11:00', 'scheduled', 14, true),
  -- Sat 28 Feb — Strength & Conditioning
  ('dd000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000010', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000003',
   '2026-02-28', '11:15', '12:15', 'scheduled', 16, true);

-- NEXT WEEK — Mon 2 Mar to Sun 8 Mar
insert into public.class_instances (id, template_id, studio_id, teacher_id, date, start_time, end_time, status, max_capacity, feed_enabled) values
  -- Mon 2 Mar — Pole L1
  ('dd000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-03-02', '18:00', '19:00', 'scheduled', 10, true),
  -- Mon 2 Mar — Aerial Hoop
  ('dd000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-03-02', '19:15', '20:15', 'scheduled', 8, true),
  -- Tue 3 Mar — Hula Hoop
  ('dd000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000008', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000005',
   '2026-03-03', '17:00', '18:00', 'scheduled', 14, true),
  -- Tue 3 Mar — Pole L2
  ('dd000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-03-03', '18:30', '19:45', 'scheduled', 10, true),
  -- Wed 4 Mar — Silks
  ('dd000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000006', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000004',
   '2026-03-04', '17:00', '18:15', 'scheduled', 6, true),
  -- Wed 4 Mar — Pole L3
  ('dd000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000001',
   '2026-03-04', '18:30', '19:45', 'scheduled', 8, true),
  -- Thu 5 Mar — Pole L4-5
  ('dd000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000002',
   '2026-03-05', '19:00', '20:30', 'scheduled', 8, true),
  -- Fri 6 Mar — Handbalance
  ('dd000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000007', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000003',
   '2026-03-06', '17:30', '18:30', 'scheduled', 12, true),
  -- Sat 7 Mar — Flexibility
  ('dd000000-0000-0000-0000-000000000013',
   'cc000000-0000-0000-0000-000000000009', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000004',
   '2026-03-07', '10:00', '11:00', 'scheduled', 14, true),
  -- Sat 7 Mar — Strength
  ('dd000000-0000-0000-0000-000000000014',
   'cc000000-0000-0000-0000-000000000010', 'bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000003',
   '2026-03-07', '11:15', '12:15', 'scheduled', 16, true);

-- ============================================================
-- BOOKINGS — current + next week
-- ============================================================

-- Thu 26 Feb — Pole L4-5 (4 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000019', 'booked'),
  ('dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000012', 'booked'),
  ('dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000022', 'booked');

-- Fri 27 Feb — Handbalance (6 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000015', 'booked'),
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000016', 'booked'),
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000019', 'booked'),
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000012', 'booked'),
  ('dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000024', 'booked');

-- Sat 28 Feb — Flexibility (8 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000011', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000013', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000014', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000016', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000018', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000021', 'booked'),
  ('dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000024', 'booked');

-- Sat 28 Feb — Strength (5 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000012', 'booked'),
  ('dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000015', 'booked'),
  ('dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000019', 'booked'),
  ('dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000022', 'booked');

-- Mon 2 Mar — Pole L1 (7 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000013', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000018', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000024', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000020', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000023', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000017', 'booked'),
  ('dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000014', 'booked');

-- Mon 2 Mar — Aerial Hoop (5 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000011', 'booked'),
  ('dd000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000016', 'booked'),
  ('dd000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000021', 'booked'),
  ('dd000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000014', 'booked');

-- Tue 3 Mar — Pole L2 (6 booked)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000011', 'booked'),
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000015', 'booked'),
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000021', 'booked'),
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000018', 'booked'),
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000013', 'booked'),
  ('dd000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000024', 'booked');

-- Wed 4 Mar — Silks (5 booked, nearly full!)
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000010', 'booked'),
  ('dd000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000014', 'booked'),
  ('dd000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000016', 'booked'),
  ('dd000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000023', 'booked'),
  ('dd000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000017', 'booked');

-- ============================================================
-- ATTENDANCE + BOOKINGS for past completed classes
-- ============================================================

-- Mon 23 Feb — Pole L1 (completed) — 8 attended
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000013', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000018', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000024', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000020', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000023', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000017', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000014', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000011', 'confirmed');

insert into public.attendance (class_instance_id, user_id, checked_in, checked_in_at, checked_in_by) values
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000013', true, '2026-02-23 17:50:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000018', true, '2026-02-23 17:52:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000024', true, '2026-02-23 17:53:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000020', true, '2026-02-23 17:55:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000023', true, '2026-02-23 17:56:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000017', true, '2026-02-23 17:58:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000014', true, '2026-02-23 17:59:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000011', true, '2026-02-23 18:02:00+13', 'aa000000-0000-0000-0000-000000000001');

-- Mon 23 Feb — Aerial Hoop (completed) — 6 attended
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000010', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000011', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000016', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000021', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000014', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000022', 'confirmed');

insert into public.attendance (class_instance_id, user_id, checked_in, checked_in_at, checked_in_by) values
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000010', true, '2026-02-23 19:10:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000011', true, '2026-02-23 19:12:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000016', true, '2026-02-23 19:13:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000021', true, '2026-02-23 19:14:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000014', true, '2026-02-23 19:15:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000022', true, '2026-02-23 19:16:00+13', 'aa000000-0000-0000-0000-000000000002');

-- Tue 24 Feb — Pole L2 (completed) — 7 attended
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000011', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000015', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000021', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000018', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000013', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000024', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000016', 'confirmed');

insert into public.attendance (class_instance_id, user_id, checked_in, checked_in_at, checked_in_by) values
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000011', true, '2026-02-24 18:25:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000015', true, '2026-02-24 18:26:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000021', true, '2026-02-24 18:27:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000018', true, '2026-02-24 18:28:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000013', true, '2026-02-24 18:30:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000024', true, '2026-02-24 18:31:00+13', 'aa000000-0000-0000-0000-000000000002'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000016', true, '2026-02-24 18:33:00+13', 'aa000000-0000-0000-0000-000000000002');

-- Wed 25 Feb — Pole L3 (completed) — 6 attended
insert into public.bookings (class_instance_id, user_id, status) values
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000010', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000012', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000016', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000022', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000019', 'confirmed'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000015', 'confirmed');

insert into public.attendance (class_instance_id, user_id, checked_in, checked_in_at, checked_in_by) values
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000010', true, '2026-02-25 18:25:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000012', true, '2026-02-25 18:26:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000016', true, '2026-02-25 18:27:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000022', true, '2026-02-25 18:28:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000019', true, '2026-02-25 18:30:00+13', 'aa000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000015', true, '2026-02-25 18:32:00+13', 'aa000000-0000-0000-0000-000000000001');

-- ============================================================
-- FEED POSTS — post-class community vibes
-- ============================================================

-- Mon 23 Feb — Pole L1 feed
insert into public.feed_posts (class_instance_id, user_id, content, post_type, created_at) values
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000013',
   'First time nailing the fireman spin! So stoked!', 'achievement', '2026-02-23 19:15:00+13'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000018',
   'Those body waves at the end were everything. Thanks Alex!', 'post', '2026-02-23 19:20:00+13'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000024',
   'Week 4 and I can finally climb to the top! This community is the best.', 'milestone', '2026-02-23 19:30:00+13'),
  ('dd000000-0000-0000-0000-000000000056', 'aa000000-0000-0000-0000-000000000001',
   'So proud of everyone tonight! You all worked so hard. See you next week!', 'post', '2026-02-23 19:45:00+13');

-- Mon 23 Feb — Aerial Hoop feed
insert into public.feed_posts (class_instance_id, user_id, content, post_type, created_at) values
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000010',
   'Man in the moon felt magical tonight. Jade is the best teacher!', 'post', '2026-02-23 20:30:00+13'),
  ('dd000000-0000-0000-0000-000000000057', 'aa000000-0000-0000-0000-000000000016',
   'Finally held the amazon position for the full count! Arms are jelly but worth it.', 'achievement', '2026-02-23 20:35:00+13');

-- Tue 24 Feb — Pole L2 feed
insert into public.feed_posts (class_instance_id, user_id, content, post_type, created_at) values
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000015',
   'Inverts are clicking! Something about Jade''s cues just make it work.', 'achievement', '2026-02-24 20:00:00+13'),
  ('dd000000-0000-0000-0000-000000000059', 'aa000000-0000-0000-0000-000000000021',
   'Love the energy in this class. Empire fam for life!', 'post', '2026-02-24 20:10:00+13');

-- Wed 25 Feb — Pole L3 feed
insert into public.feed_posts (class_instance_id, user_id, content, post_type, created_at) values
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000012',
   'Butterfly combo is officially in the bag. Time to film it!', 'achievement', '2026-02-25 20:00:00+13'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000022',
   'Alex pushed us hard tonight and it was exactly what I needed.', 'post', '2026-02-25 20:15:00+13'),
  ('dd000000-0000-0000-0000-000000000061', 'aa000000-0000-0000-0000-000000000001',
   'L3 crew absolutely smashed it tonight! The progress in this group is unreal.', 'post', '2026-02-25 20:30:00+13');

-- ============================================================
-- V2 SEED DATA: Membership Plans, Coupons, Comp Classes
-- ============================================================

-- MEMBERSHIP PLANS — Empire Aerial Arts (NZD)
insert into public.membership_plans (id, studio_id, name, description, type, price_cents, currency, interval, class_limit, validity_days, active, sort_order) values
  ('ee000000-0000-0000-0000-000000000001',
   'bb000000-0000-0000-0000-000000000001',
   'Unlimited Monthly',
   'Unlimited classes every month. The best value if you love to train! Come as often as you like.',
   'unlimited', 18000, 'NZD', 'month', null, null, true, 1),

  ('ee000000-0000-0000-0000-000000000002',
   'bb000000-0000-0000-0000-000000000001',
   '8-Class Pack',
   'Eight classes to use at your own pace. Valid for 60 days from purchase.',
   'class_pack', 16000, 'NZD', 'once', 8, 60, true, 2),

  ('ee000000-0000-0000-0000-000000000003',
   'bb000000-0000-0000-0000-000000000001',
   'Drop-In Class',
   'Single class, pay as you go. No commitment needed.',
   'drop_in', 2500, 'NZD', 'once', 1, null, true, 3);

-- COUPONS
insert into public.coupons (id, studio_id, code, type, value, applies_to, max_redemptions, valid_from, valid_until, active) values
  ('ff000000-0000-0000-0000-000000000001',
   'bb000000-0000-0000-0000-000000000001',
   'WELCOME20',
   'percent_off', 20,
   'new_member',
   null,
   '2026-01-01 00:00:00+00',
   '2026-12-31 23:59:59+00',
   true),

  ('ff000000-0000-0000-0000-000000000002',
   'bb000000-0000-0000-0000-000000000001',
   'BRINGAFRIEND',
   'free_classes', 1,
   'drop_in',
   100,
   '2026-02-01 00:00:00+00',
   '2026-06-30 23:59:59+00',
   true);

-- COMP CLASSES (a few sample grants)
insert into public.comp_classes (studio_id, user_id, granted_by, reason, total_classes, remaining_classes, expires_at) values
  ('bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000013',
   'aa000000-0000-0000-0000-000000000001',
   'Helped set up for the showcase performance',
   2, 2,
   '2026-06-01 00:00:00+00'),

  ('bb000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000017',
   'aa000000-0000-0000-0000-000000000001',
   'Birthday treat — enjoy!',
   1, 1,
   '2026-04-01 00:00:00+00');
