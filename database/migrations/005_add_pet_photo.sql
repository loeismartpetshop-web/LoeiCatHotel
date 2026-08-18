-- เก็บรูปน้องแมวไว้ระบุตัวตนตอนรับช่วงเวร และใช้ช่วยประกาศตามหาแมวหาย
-- รูปเป็นข้อมูลส่วนบุคคลของลูกค้า จึงเก็บใน private bucket และเปิดดูด้วย signed URL อายุสั้นเท่านั้น

begin;

alter table public.pets
  add column if not exists photo_path text;

alter table public.pets
  add column if not exists photo_updated_at timestamptz;

comment on column public.pets.photo_path is
  'Object path ของรูปน้องแมวใน private bucket pet-photos';
comment on column public.pets.photo_updated_at is
  'เวลาที่อัปเดตรูปน้องแมวล่าสุด';

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', false)
on conflict (id) do nothing;

-- พนักงานที่ใช้งานอยู่อ่านรูปได้ ส่วนการอัปโหลด/ลบทำผ่าน API route ที่ใช้ service key
-- จึงไม่เปิด policy insert/delete ให้ client โดยตรง
drop policy if exists pet_photos_staff_read on storage.objects;
create policy pet_photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'pet-photos' and public.is_staff());

commit;

-- ตรวจผล: ควรเห็นคอลัมน์ photo_path และ photo_updated_at
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'pets'
  and column_name in ('photo_path', 'photo_updated_at')
order by column_name;
