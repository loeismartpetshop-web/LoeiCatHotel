-- LOEI CAT HOTEL — Migration 002: Row Level Security
-- รันหลัง 001
--
-- หลักการ (ตาม HANDOFF.md ข้อ 8 และ docs/08_SECURITY_PRIVACY.md):
--   1. ลูกค้าไม่เขียนตาราง booking/payment ตรง ๆ  ทุกอย่างผ่าน API route ฝั่ง server
--      ที่ใช้ service key (service key ข้าม RLS โดยธรรมชาติ)
--   2. RLS คือชั้นป้องกันสุดท้าย ไม่ใช่ชั้นเดียว
--   3. anon key ที่หลุดไปอยู่ใน browser ต้องทำอะไรอันตรายไม่ได้เลย
--
-- ค่าเริ่มต้นของ RLS คือ "ปฏิเสธทุกอย่าง" ตารางไหนไม่มี policy = เข้าไม่ได้เลย
-- จาก client เราจึงเขียน policy เฉพาะที่ต้องเปิดจริง

-- ─────────────────────────────────────────────────────────
-- เปิด RLS ทุกตาราง ไม่มีข้อยกเว้น
-- ─────────────────────────────────────────────────────────

alter table public.hotel_settings            enable row level security;
alter table public.rooms                     enable row level security;
alter table public.rate_plans                enable row level security;
alter table public.staff_profiles            enable row level security;
alter table public.customers                 enable row level security;
alter table public.pets                      enable row level security;
alter table public.bookings                  enable row level security;
alter table public.booking_pets              enable row level security;
alter table public.booking_room_allocations  enable row level security;
alter table public.payments                  enable row level security;
alter table public.refund_requests           enable row level security;
alter table public.booking_status_history    enable row level security;
alter table public.line_message_log          enable row level security;
alter table public.daily_care_tasks          enable row level security;
alter table public.print_history             enable row level security;
alter table public.emergency_consent         enable row level security;
alter table public.audit_log                 enable row level security;

-- ─────────────────────────────────────────────────────────
-- Helper: อ่าน role ของพนักงานที่ล็อกอินอยู่
-- security definer เพื่อไม่ให้เกิด RLS recursion ตอน policy อ่าน staff_profiles เอง
-- ─────────────────────────────────────────────────────────

create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.staff_profiles
  where auth_user_id = auth.uid()
    and is_active
  limit 1
$$;

revoke all on function public.current_staff_role() from public;
grant execute on function public.current_staff_role() to authenticated;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles
    where auth_user_id = auth.uid() and is_active
  )
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- เห็นข้อมูลการเงินได้เฉพาะ owner และ front_desk
-- caregiver และ housekeeper ห้ามเห็น (HANDOFF.md ข้อ 6)
create or replace function public.can_see_money()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() in ('owner', 'front_desk')
$$;

revoke all on function public.can_see_money() from public;
grant execute on function public.can_see_money() to authenticated;

-- ─────────────────────────────────────────────────────────
-- ข้อมูลอ้างอิงที่เปิดให้อ่านสาธารณะได้
-- หน้าจองต้องแสดงราคาและประเภทห้องก่อนลูกค้าล็อกอิน
-- เปิดเฉพาะ SELECT และเฉพาะแถวที่ตั้งใจให้ลูกค้าเห็น
-- ─────────────────────────────────────────────────────────

create policy rooms_public_read on public.rooms
  for select
  to anon, authenticated
  using (display_to_customer and status = 'active' and deleted_at is null);

create policy rate_plans_public_read on public.rate_plans
  for select
  to anon, authenticated
  using (is_active);

-- hotel_settings มีเบอร์เจ้าของ จึงให้เฉพาะพนักงานอ่าน
-- ค่าที่ลูกค้าต้องเห็น (เพดาน 30 ตัว เวลาทำการ) ให้ API ส่งไปแทน
create policy hotel_settings_staff_read on public.hotel_settings
  for select to authenticated using (public.is_staff());

-- ─────────────────────────────────────────────────────────
-- Staff profiles
-- ─────────────────────────────────────────────────────────

create policy staff_read_own on public.staff_profiles
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy staff_owner_read_all on public.staff_profiles
  for select to authenticated
  using (public.current_staff_role() = 'owner');

create policy staff_owner_manage on public.staff_profiles
  for all to authenticated
  using (public.current_staff_role() = 'owner')
  with check (public.current_staff_role() = 'owner');

-- ─────────────────────────────────────────────────────────
-- ลูกค้าอ่านข้อมูลตัวเองได้ (เมื่อผูก auth_user_id แล้ว) แต่เขียนไม่ได้
-- การเขียนทั้งหมดผ่าน API route ที่ verify LINE ID token แล้ว
-- ─────────────────────────────────────────────────────────

create policy customers_read_own on public.customers
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy customers_staff_read on public.customers
  for select to authenticated
  using (public.is_staff());

create policy pets_read_own on public.pets
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.customer_id = pets.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy pets_staff_read on public.pets
  for select to authenticated
  using (public.is_staff());

create policy pets_staff_write on public.pets
  for update to authenticated
  using (public.current_staff_role() in ('owner', 'front_desk', 'caregiver'))
  with check (public.current_staff_role() in ('owner', 'front_desk', 'caregiver'));

-- ─────────────────────────────────────────────────────────
-- Bookings
-- ─────────────────────────────────────────────────────────

create policy bookings_read_own on public.bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.customer_id = bookings.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy bookings_staff_read on public.bookings
  for select to authenticated
  using (public.is_staff());

-- เฉพาะ owner และ front_desk แก้ booking ได้จาก client
-- การสร้าง booking ทำผ่าน server เท่านั้น จึงไม่มี policy insert
create policy bookings_staff_update on public.bookings
  for update to authenticated
  using (public.current_staff_role() in ('owner', 'front_desk'))
  with check (public.current_staff_role() in ('owner', 'front_desk'));

create policy booking_pets_staff_read on public.booking_pets
  for select to authenticated using (public.is_staff());

create policy booking_pets_read_own on public.booking_pets
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.customers c on c.customer_id = b.customer_id
      where b.booking_id = booking_pets.booking_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy allocations_staff_read on public.booking_room_allocations
  for select to authenticated using (public.is_staff());

create policy allocations_staff_write on public.booking_room_allocations
  for all to authenticated
  using (public.current_staff_role() in ('owner', 'front_desk'))
  with check (public.current_staff_role() in ('owner', 'front_desk'));

-- ─────────────────────────────────────────────────────────
-- การเงิน — caregiver และ housekeeper เข้าไม่ถึงเลย
-- ─────────────────────────────────────────────────────────

create policy payments_money_roles_read on public.payments
  for select to authenticated using (public.can_see_money());

create policy payments_money_roles_write on public.payments
  for update to authenticated
  using (public.can_see_money())
  with check (public.can_see_money());

create policy payments_read_own on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.customers c on c.customer_id = b.customer_id
      where b.booking_id = payments.booking_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy refunds_owner_only on public.refund_requests
  for all to authenticated
  using (public.current_staff_role() = 'owner')
  with check (public.current_staff_role() = 'owner');

create policy refunds_front_desk_read on public.refund_requests
  for select to authenticated
  using (public.current_staff_role() = 'front_desk');

-- ─────────────────────────────────────────────────────────
-- งานดูแลประจำวัน — caregiver และ housekeeper ทำงานตรงนี้
-- ─────────────────────────────────────────────────────────

create policy care_tasks_staff_read on public.daily_care_tasks
  for select to authenticated using (public.is_staff());

create policy care_tasks_staff_write on public.daily_care_tasks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy print_history_staff on public.print_history
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy emergency_consent_staff_read on public.emergency_consent
  for select to authenticated using (public.is_staff());

create policy emergency_consent_read_own on public.emergency_consent
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.customer_id = emergency_consent.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy status_history_staff_read on public.booking_status_history
  for select to authenticated using (public.is_staff());

-- audit_log และ line_message_log: server เขียนอย่างเดียว
-- owner อ่านได้เพื่อตรวจสอบย้อนหลัง
create policy audit_owner_read on public.audit_log
  for select to authenticated
  using (public.current_staff_role() = 'owner');

create policy line_log_owner_read on public.line_message_log
  for select to authenticated
  using (public.current_staff_role() = 'owner');

-- ─────────────────────────────────────────────────────────
-- Storage buckets — private ทั้งหมด เข้าถึงด้วย signed URL เท่านั้น
-- ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values
  ('health-documents', 'health-documents', false),
  ('payment-slips',    'payment-slips',    false),
  ('care-photos',      'care-photos',      false)
on conflict (id) do nothing;

-- เอกสารสุขภาพ: พนักงานทุกตำแหน่งยกเว้น housekeeper อ่านได้
create policy health_docs_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'health-documents'
    and public.current_staff_role() in ('owner', 'front_desk', 'caregiver')
  );

-- สลิปมัดจำ: เฉพาะตำแหน่งที่เห็นการเงินได้
create policy payment_slips_money_read on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-slips' and public.can_see_money());

-- รูปดูแล: พนักงานทุกคนอ่านและอัปโหลดได้
create policy care_photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'care-photos' and public.is_staff());

create policy care_photos_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'care-photos' and public.is_staff());

-- หมายเหตุ: ลูกค้าอัปโหลดเอกสารสุขภาพและสลิปผ่าน API route ที่ใช้ service key
-- ไม่เปิด policy insert ให้ anon/authenticated โดยตรง เพราะจะเปิดช่องให้อัปโหลดมั่วได้
