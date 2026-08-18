-- LOEI CAT HOTEL — Migration 003: Reference Seed
-- รันหลัง 002
--
-- ข้อมูลนี้มาจาก docs/02_BUSINESS_RULES.md (Approved Baseline)
-- ห้องสำรอง 2 ห้องยังไม่ใส่ เพราะรหัสและความจุยังไม่ยืนยัน (docs/10)

insert into public.hotel_settings (
  business_code, business_name, owner_phone
) values (
  'LOEI_CAT_HOTEL', 'โรงแรมแมวเมืองเลย', '083-917-8794'
)
on conflict (business_code) do nothing;

-- BR-PRICE-001
insert into public.rate_plans (
  rate_plan_code, rate_plan_name, billing_unit, price_per_pet, maximum_hours
) values
  ('HOURLY',         'ฝากไม่เกิน 6 ชั่วโมง',                'hour',  100.00, 6),
  ('HOTEL_SUPPLIED', 'รวมอาหาร น้ำ และทราย',                'night', 250.00, null),
  ('OWNER_SUPPLIED', 'ลูกค้านำอาหารและทรายเต้าหู้มาเอง',     'night', 150.00, null)
on conflict (rate_plan_code) do nothing;

-- BR-BOOKING-001 / BR-BOOKING-002
-- คอนโด 9 ห้อง รับ 2-4 ตัว
--
-- DECISION PENDING: ลูกค้าที่มีแมว 1 ตัวจะพักคอนโดได้ไหม
-- ตอนนี้ตั้ง minimum_pets = 2 ตามกฎธุรกิจปัจจุบัน
-- ถ้าเจ้าของตัดสินใจให้ 1 ตัวพักคอนโดได้ ให้รัน:
--   update public.rooms set minimum_pets = 1 where room_type = 'condo';
insert into public.rooms (
  room_code, display_name, room_type, minimum_pets, maximum_pets,
  display_to_customer, recommendation_order
)
select
  'CONDO-' || lpad(room_number::text, 2, '0'),
  'คอนโด ' || room_number,
  'condo'::public.room_type,
  2,
  4,
  true,
  room_number
from generate_series(1, 9) as room_number
on conflict (room_code) do nothing;

-- วิลล่า 7 ห้อง รับ 1-2 ตัว
insert into public.rooms (
  room_code, display_name, room_type, minimum_pets, maximum_pets,
  display_to_customer, recommendation_order
)
select
  'VILLA-' || lpad(room_number::text, 2, '0'),
  'วิลล่า ' || room_number,
  'villa'::public.room_type,
  1,
  2,
  true,
  100 + room_number
from generate_series(1, 7) as room_number
on conflict (room_code) do nothing;

-- ตรวจผลลัพธ์
select room_type, count(*) as room_count, sum(maximum_pets) as max_capacity
from public.rooms
group by room_type
order by room_type;
