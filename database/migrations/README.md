# Migrations

รันตามลำดับใน Supabase SQL Editor ของ project `loei-cat-hotel`
(องค์กร `loeismartpetshop-web's Org`, region Singapore)

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 1 | `001_schema.sql` | ตาราง enum index ทั้งหมด |
| 2 | `002_rls_policies.sql` | เปิด RLS ทุกตาราง + policy + storage bucket |
| 3 | `003_seed_reference.sql` | ราคา 3 แพ็กเกจ + ห้อง 16 ห้อง + ตั้งค่าโรงแรม |

**วางทีละไฟล์ กด Run แล้วดูว่าไม่มี error ก่อนไปไฟล์ถัดไป**

รันซ้ำได้เฉพาะไฟล์ 3 (มี `on conflict do nothing`) ส่วนไฟล์ 1 และ 2 รันซ้ำจะ error
เพราะ object มีอยู่แล้ว — ถือว่าปกติ ไม่ต้องแก้

## ตรวจว่าสำเร็จ

หลังรันครบ ควรได้:

```
condo | 9 | 36
villa | 7 | 14
```

และใน Table Editor ต้องเห็นทุกตารางมีป้าย **RLS enabled**

## หลังรันเสร็จ

รัน Security Advisor ใน dashboard (Advisors → Security) ต้องไม่มี error ระดับ
"table is public but RLS is disabled"

## สิ่งที่ยังไม่ได้ทำในชุดนี้ (ตั้งใจ)

รอคำตัดสินใน `docs/10_DECISIONS_REQUIRED.md` ก่อน:

| รายการ | รอ decision |
|---|---|
| ฟังก์ชันตรวจห้องว่าง + เพดาน 30 ตัว (`check_availability`) | แมว 1 ตัวพักคอนโดได้ไหม, เวลาทำความสะอาด |
| ฟังก์ชันสร้าง booking hold แบบ transaction | ข้างบน + วิธีนับคืน (ตัดสินแล้ว: นับตามวันที่) |
| Storage retention / auto-delete | ระยะเวลาเก็บเอกสารสุขภาพ |
| Auth ของพนักงาน | email/password หรือ magic link |

ฟังก์ชันตรวจห้องว่างเป็นหัวใจของระบบ (กันจองซ้ำ + เพดาน 30 ตัว ต้องอยู่ใน
transaction เดียว ตาม `HANDOFF.md` ข้อ 7) — เขียนผิดตั้งแต่แรกแล้วแก้ทีหลัง
แพงกว่ารอคำตอบ 2 ข้อ
