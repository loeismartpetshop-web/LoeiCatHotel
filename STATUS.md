# สถานะโครงการ LOEI CAT HOTEL Booking System

อัปเดต: 10 สิงหาคม 2026 เวลา 23:40 น. (Asia/Bangkok)
สถานะรวม: ขึ้น Production บน Vercel และเชื่อม Supabase/LINE OA แล้ว อยู่ระหว่าง Pilot/Test ยังไม่ผ่าน Acceptance Test ครบ จึงยังไม่ถือว่า Production-ready

## จุดเข้าใช้งาน

- Production: `https://loeicathotel.vercel.app`
- หน้าจองลูกค้า: `/`
- Staff Dashboard: `/staff`
- GitHub: `loeismartpetshop-web/LoeiCatHotel` สาขา `main` ล่าสุดที่ `63c869b`

## ดำเนินการแล้ว

### เอกสารและการออกแบบ

- ขอบเขตระบบ กฎธุรกิจ ราคา ห้องพัก ความจุ มัดจำ และเวลาบริการ
- Data Dictionary, System Architecture และ Customer Booking Flow
- สิทธิ์ตามตำแหน่งงาน แนวทาง No-Typing สำหรับพนักงานต่างชาติ และ Acceptance Criteria
- ต้นแบบ HTML ครบทุกหน้า รวมเอกสาร Thermal POS 80 มม.
- `HANDOFF.md` สำหรับส่งต่อทีมพัฒนา อัปเดตตามงานล่าสุดแล้ว

### ฐานข้อมูล

- สร้าง Supabase Project จริงและรัน migration ใน `database/migrations/` แล้ว
  - `001_schema.sql` โครงสร้างตารางหลัก
  - `002_rls_policies.sql` RLS ทุกตารางที่เปิดผ่าน Data API
  - `003_seed_reference.sql` ข้อมูลอ้างอิงตั้งต้น
  - `003_staff_role_owner_front_desk_only.sql` ลด role เหลือ `owner` และ `front_desk`
  - `004_add_customer_mihome_app_id.sql` เพิ่มคอลัมน์ `customers.mihome_app_id`

### Customer Booking

- Next.js Web App หน้าจอง 4 ขั้นตอน เชื่อม Booking API และ Supabase Production
- คำนวณราคาและมัดจำ 50% จาก domain package พร้อมเก็บ price snapshot
- อัปโหลดหลักฐานมัดจำและส่งเข้าคิวตรวจสลิปของพนักงาน
- เพิ่มช่อง Mi Home App ID สำหรับแชร์สิทธิ์ดูกล้องห้องพัก (ไม่บังคับกรอก)
- ล็อกช่องเบอร์โทรให้กรอกได้เฉพาะตัวเลข 10 หลักบนมือถือ/Android
- ธีมสีชมพูตามโลโก้ร้าน โลโก้วงกลม และ favicon จากโลโก้จริง

### Staff Dashboard

- Supabase Auth และตรวจสิทธิ์จาก `public.staff_profiles` (`owner`, `front_desk`)
- เมนูภาพรวม ตารางห้อง รายการจอง การชำระเงิน และลูกค้า/น้องแมว
- คิวตรวจมัดจำจาก LINE OA พนักงานยืนยันแล้วระบบส่งบิลยอดคงเหลือกลับทาง LINE
- เพิ่ม/แก้ไข/ปิดใช้งานห้อง และแก้ไขวันเวลา สถานะ หรือยกเลิกรายการจอง
- ค้นหาลูกค้าด้วยชื่อ เบอร์โทร Mi Home ID, LINE หรือชื่อแมว
- เครื่องมือลบข้อมูลทดสอบ: รายรายการ ลบทั้งครอบครัวลูกค้า และลบทั้งหมวดแบบตรวจรหัสผ่าน Owner

### LINE OA

- LINE webhook พร้อม signature validation
- Push ยืนยันการจอง 1 ครั้งต่อ event ด้วย idempotency key

## ยังไม่ได้ดำเนินการ

- ยังไม่ผ่าน Acceptance Test ครบตาม `tests/ACCEPTANCE_CRITERIA.md`
- ยังไม่ได้ทดสอบการจองจริงบน iOS/Android และ LINE in-app browser หลังเพิ่มช่อง Mi Home ID
- ยังไม่ได้ทดสอบ concurrent booking และการหมดอายุ hold 24:00 น. อย่างเป็นระบบ
- ยังไม่มี integration test runner / CI ที่ครอบคลุม booking flow, LINE delivery และการลบข้อมูล
- ยังไม่ได้ทดสอบเครื่องพิมพ์ Thermal POS 80 มม. กับเครื่องจริง
- ยังไม่ได้ยืนยันข้อมูลรับชำระและ QR กับธนาคาร
- ยังไม่ได้ทดลองใช้งานกับพนักงานจริงแบบ Pilot
- ประเด็น P0/P1 ใน `docs/10_DECISIONS_REQUIRED.md` ยังปิดไม่ครบ

## ขั้นตอนถัดไป

1. ทดสอบการจองจริงบน Android และ LINE in-app browser หลังเพิ่มช่อง Mi Home ID
2. ทดสอบ concurrent booking และ booking expiry
3. ทดสอบสิทธิ์ของ `owner` และ `front_desk` ให้ครบทุกเมนู
4. ทดสอบพิมพ์เอกสาร POS 80 มม. กับเครื่องจริง
5. ปิดประเด็น P0 ที่เหลือใน `docs/10_DECISIONS_REQUIRED.md`
6. Pilot กับพนักงานด้วยข้อมูลจำลอง ก่อนเปิดรับข้อมูลลูกค้าจริง
