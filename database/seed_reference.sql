-- Reference seed for development only.

insert into public.hotel_settings (
  business_code, business_name, owner_phone
) values (
  'LOEI_CAT_HOTEL', 'โรงแรมแมวเมืองเลย', '083-917-8794'
);

insert into public.rate_plans (
  rate_plan_code, rate_plan_name, billing_unit, price_per_pet, maximum_hours
) values
  ('HOURLY', 'ฝากไม่เกิน 6 ชั่วโมง', 'hour', 100.00, 6),
  ('HOTEL_SUPPLIED', 'รวมอาหาร น้ำ และทราย', 'night', 250.00, null),
  ('OWNER_SUPPLIED', 'ลูกค้านำอาหารและทรายเต้าหู้มาเอง', 'night', 150.00, null);

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
from generate_series(1, 9) as room_number;

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
from generate_series(1, 7) as room_number;

-- Reserve rooms are intentionally not seeded yet because their internal names
-- and capacities have not been confirmed. When added, they must use
-- room_type = 'reserve' and display_to_customer = false.
