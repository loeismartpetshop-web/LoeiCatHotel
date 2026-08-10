# HANDOFF — LOEI CAT HOTEL Booking System

อัปเดตล่าสุด: 10 สิงหาคม 2026 เวลา 22:00 น. (Asia/Bangkok)
สถานะ: Customer Booking Web App และ Staff Dashboard deploy บน Vercel Production และเชื่อม Supabase/LINE OA แล้ว ปัจจุบันยังอยู่ช่วง Pilot/Test และยังไม่ถือว่า Production-ready จนกว่าจะผ่าน Acceptance Test ครบ

## 0. งานล่าสุดวันที่ 10 สิงหาคม 2026

### Production และจุดเข้าใช้งาน

- Production alias: `https://loeicathotel.vercel.app`
- หน้าจองลูกค้า: `/`
- Staff Dashboard: `/staff`
- GitHub: `loeismartpetshop-web/LoeiCatHotel` สาขา `main`
- Vercel clean build ล่าสุดผ่านทั้ง Next.js build, TypeScript และการสร้าง route

### Staff Dashboard และ Supabase

- เพิ่ม Staff Dashboard ที่ใช้ Supabase Auth และตรวจสิทธิ์จาก `public.staff_profiles`
- Role ที่เปิดใช้งานในโค้ดปัจจุบันคือ `owner` และ `front_desk`
- เปิดเมนูภาพรวม ตารางห้อง รายการจอง การชำระเงิน และลูกค้า/น้องแมว
- เพิ่ม API dashboard รวมข้อมูลจาก `rooms`, `bookings`, `customers`, `pets`, `payments` และตารางที่เกี่ยวข้อง
- เพิ่มคิวตรวจมัดจำจาก LINE OA พนักงานตรวจสลิปแล้วกดยืนยัน จากนั้นระบบส่งบิลยอดคงเหลือ/ชำระวันเช็กอินกลับให้ลูกค้าผ่าน LINE
- เพิ่มการเพิ่ม/แก้ไข/ปิดใช้งานห้อง และการแก้ไขวันเวลา/สถานะหรือยกเลิกรายการจอง
- ปรับ UI ของลูกค้าและน้องแมวให้แสดงเป็นรายการแนวตั้ง อ่านง่าย และค้นหาได้

### เครื่องมือล้างข้อมูลช่วงทดสอบ

- Owner สามารถลบห้องหรือรายการจองทดสอบเป็นรายรายการได้ โดยต้องยืนยันด้วยรหัสห้องหรือรหัสการจอง
- Owner สามารถลบข้อมูลลูกค้าหนึ่งครอบครัว พร้อมน้องแมว การจอง การชำระเงิน และข้อมูลลูกที่เชื่อมโยงได้ โดยยืนยันด้วยเบอร์โทร
- เพิ่มปุ่ม `ลบข้อมูลทั้งหมด` แยกใน 4 หมวด: ห้อง, การจอง, การชำระเงิน, ลูกค้าและน้องแมว
- ปุ่มลบทั้งหมวดแสดงเฉพาะ Owner และต้องกรอกรหัสผ่านบัญชี Owner ปัจจุบัน ระบบตรวจซ้ำกับ Supabase Auth ทุกครั้ง
- รหัสผ่านไม่ถูกบันทึกลงฐานข้อมูล, browser storage, source code หรือ log
- การลบทำตามลำดับ child-first เพื่อไม่ติด Foreign Key เช่น `booking_pets`, `payments`, `booking_room_allocations` และประวัติที่เกี่ยวข้อง
- **คำเตือน:** การลบทั้งหมวดเป็น Permanent Delete และกู้คืนไม่ได้ ใช้เฉพาะข้อมูลทดสอบเท่านั้น ห้ามใช้หลังเริ่มรับข้อมูลจริงโดยไม่มี backup ที่ตรวจสอบแล้ว

ขอบเขตการลบทั้งหมวด:

| หมวด | ข้อมูลที่ลบ | ข้อมูลที่ยังอยู่ |
|---|---|---|
| ห้อง | ห้องและการจัดห้องที่ผูกอยู่ | การจอง ลูกค้า น้องแมว และยอดการจอง |
| การจอง | การจอง การชำระเงิน ประวัติสถานะ การจัดห้อง ข้อความ และข้อมูลประกอบ | ลูกค้า น้องแมว และห้อง |
| การชำระเงิน | รายการชำระเงินและคำขอคืนเงินที่อ้างถึงรายการชำระ | การจองและ price snapshot ลูกค้า น้องแมว และห้อง |
| ลูกค้าและน้องแมว | ลูกค้า น้องแมว การจอง การชำระเงิน และข้อมูลลูกที่เกี่ยวข้อง | ห้อง |

### UX/UI ที่ปรับล่าสุด

- ใช้ธีมสีชมพูตามโลโก้ร้านทั้ง Customer Booking และ Staff Dashboard
- ใช้โลโก้ร้านแบบวงกลมและ favicon จากโลโก้จริง
- ปุ่มและ action dialog มี hover, active, loading และ error state ที่ชัดเจน
- หน้าต่างยืนยันการลบใช้ UI ของระบบ ไม่ใช้ browser prompt แบบเดิม
- บน desktop จัดกลุ่มการ์ดกรอกข้อมูลฝั่งขวาให้อยู่กึ่งกลางแนวตั้งเมื่อเนื้อหาสั้น โดยไม่กระทบ tablet/mobile และขั้นตอนที่เนื้อหายาว

### Commit ของงานวันนี้

| Commit | รายการ |
|---|---|
| `9093b82` | เชื่อม Staff Deposit Dashboard |
| `15adfbe` | เปิดใช้งานทุกหมวดใน Staff Dashboard |
| `3b91ae1` | เพิ่มการจัดการห้องและรายการจอง |
| `52ed07a` | เพิ่ม Owner purge สำหรับข้อมูลทดสอบรายรายการ |
| `242f4ef` | ปรับ action dialog, interaction และ favicon |
| `47a5d28` | เพิ่มการลบข้อมูลลูกค้าทั้งครอบครัว |
| `1e23ef1` | เพิ่มการลบข้อมูลทั้งหมดแบบตรวจรหัสผ่าน Owner |
| `ad88b13` | จัดการ์ดหน้าจอง desktop ให้อยู่กึ่งกลางแนวตั้ง |

### ผลตรวจล่าสุด

- `pnpm --filter @loei-cat-hotel/customer-booking typecheck` ผ่าน
- Vercel Production build ผ่าน
- `https://loeicathotel.vercel.app/` และ `/staff` ตอบ HTTP 200
- API ลบทั้งหมวดเมื่อไม่มี Authorization ตอบ HTTP 401 และไม่แตะข้อมูล Supabase
- ไม่ได้ทดลองลบข้อมูลจริงในการตรวจ Production

## 1. วัตถุประสงค์

พัฒนาระบบจองโรงแรมแมวเมืองเลยสำหรับลูกค้าผ่าน LINE OA/LIFF และระบบหลังบ้านสำหรับพนักงาน โดยใช้ฐานข้อมูลกลาง ป้องกันการจองซ้ำ ไม่รับแมวรวมเกิน 30 ตัว และรองรับการพิมพ์เอกสาร Thermal POS 80 มม.

เจ้าของธุรกิจ: บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด  
แบรนด์: โรงแรมแมวเมืองเลย / LOEI CAT HOTEL  
โทรศัพท์: 083-917-8794  
LINE OA: `@002lffmk`  
ที่อยู่: 189/9 ถ.สถลเชียงคาน ต.กุดป่อง อ.เมือง จ.เลย 42000

## 2. จุดเริ่มต้นสำหรับทีมพัฒนา

1. เปิด `HTML_OVERVIEW.html` เพื่อตรวจหน้าต้นแบบทั้งหมด
2. อ่าน `docs/02_BUSINESS_RULES.md`
3. อ่าน `docs/03_DATA_DICTIONARY.md`
4. อ่าน `docs/04_SYSTEM_ARCHITECTURE.md`
5. อ่าน `docs/10_DECISIONS_REQUIRED.md` และปิดประเด็นที่กระทบโครงสร้างก่อนเขียน migration
6. ตรวจ `database/schema_draft.sql` และแปลงเป็น Supabase migration ที่ตรวจสอบย้อนหลังได้
7. ใช้ `tests/ACCEPTANCE_CRITERIA.md` เป็นเกณฑ์ตรวจรับ

## 3. สิ่งที่มีอยู่แล้ว

### เอกสารและการออกแบบ

- Project Charter และขอบเขต MVP
- กฎธุรกิจ ราคา มัดจำ เวลา และสุขภาพ
- Data Dictionary
- System Architecture
- Customer Booking Flow
- Staff Dashboard Specification
- LINE OA และ AI Specification
- Security และ Privacy แนวทางเบื้องต้น
- Roadmap และรายการคำตัดสินที่ยังค้าง
- สิทธิ์ตามตำแหน่งงานและ No-Typing UX
- รูปแบบเอกสาร POS 80 มม.
- Acceptance Criteria

### ต้นแบบ HTML

ต้นแบบทั้งหมดเป็นไฟล์ HTML/CSS/JavaScript แบบ standalone ใช้ข้อมูลจำลอง ไม่มี API และไม่บันทึกข้อมูลจริง

| หน้าจอ | ไฟล์ |
|---|---|
| ภาพรวมต้นแบบทั้งหมด | `HTML_OVERVIEW.html` |
| หน้าจองลูกค้า 4 ขั้นตอน | `apps/customer-booking/prototypes/booking.html` |
| หน้าหลังยืนยันการจอง | `apps/customer-booking/prototypes/booking-confirmed.html` |
| บัตรยืนยันหนึ่งหน้าจอมือถือ | `apps/customer-booking/prototypes/booking-pass-mobile.html` |
| เอกสารการจอง POS 80 มม. | `apps/customer-booking/prototypes/booking-confirmation-80mm.html` |
| แดชบอร์ดพนักงาน | `apps/staff-dashboard/prototypes/dashboard.html` |
| ใบข้อมูลติดหน้าห้อง POS 80 มม. | `apps/staff-dashboard/prototypes/room-label-80mm.html` |

## 4. กฎธุรกิจที่ยืนยันแล้ว

### ห้องและความจุ

- Villa 1–7 รองรับ 1–2 ตัวต่อห้อง
- Condo 1–9 รองรับ 2–4 ตัวต่อห้องตามข้อมูลปัจจุบัน
- แมวในห้องเดียวกันต้องมาจากผู้ปกครอง/ครอบครัวเดียวกัน
- รับแมวที่อยู่ในสถานะถือห้องหรือยืนยันแล้วรวมไม่เกิน 30 ตัวในช่วงวันที่ทับซ้อน
- เมื่อครบ 30 ตัว ต้องหยุดรับจองออนไลน์ แม้ยังมีพื้นที่ห้องเหลือ
- แนะนำและจัด Condo ก่อน แต่ลูกค้าเลือก Villa ได้
- ห้องสำรอง 2 ห้องเป็น Staff-only ห้ามแสดงให้ลูกค้าเห็น

### ราคา

- 250 บาท/ตัว/คืน รวมอาหาร น้ำ และทราย
- 150 บาท/ตัว/คืน เมื่อลูกค้านำอาหารและทรายเต้าหู้มาเอง
- ฝากไม่เกิน 6 ชั่วโมง ราคา 100 บาท/ตัว
- เกิน 6 ชั่วโมงให้คิดอัตราค้างคืน
- Villa และ Condo ราคาเดียวกัน
- ราคาต้องเก็บเป็น snapshot ใน booking เพื่อไม่ให้ประวัติเปลี่ยนเมื่อแก้ราคา

### มัดจำและการชำระเงิน

- มัดจำ 50% ของยอดจอง
- ชำระภายใน 24:00 น. ของวันที่สร้างรายการจอง
- เมื่อไม่ชำระตามกำหนด ต้องหมดอายุการถือห้องและคืน inventory
- ยอดคงเหลือชำระวันเช็กอิน
- การคืนเงินห้ามอนุมัติอัตโนมัติ ต้องส่งให้พนักงาน/Owner พิจารณาและติดต่อกลับ
- ข้อมูลรับชำระที่ให้มา: `KPS004KB000002201754`
- ชื่อบัญชี: บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด
- รหัสรับชำระข้างต้นยังไม่ได้ยืนยันว่าเป็น QR payload หรือหมายเลขที่สร้าง Dynamic QR ได้ ต้องทดสอบกับธนาคารก่อน Production

### เวลาให้บริการ

- เปิดทุกวัน 08:30–18:00 น.
- เช็กอิน 08:30–18:00 น.
- รับกลับ 12:00–18:00 น.
- รับกลับช้าได้ถึง 20:00 น. โดยต้องโทรแจ้ง Owner ที่ 083-917-8794
- ไม่มีค่าปรับรับกลับช้าตามข้อมูลปัจจุบัน

### สุขภาพ

- วัคซีนอย่างน้อย 1 เข็ม
- ป้องกันเห็บหมัดทุกเดือน
- อาบน้ำทำความสะอาดก่อนเข้าพัก
- ไม่รับโรคที่แพร่เชื้อสู่แมวตัวอื่นและแมวที่มีเห็บหมัด
- เอกสารสุขภาพข้ามตอนจองได้ แต่ระบบต้องรองรับอัปโหลด
- แจ้งเตือนเอกสารก่อนเข้าพัก 1 วัน
- หากเอกสารไม่ครบ พนักงานสอบถามและอนุมัติหน้างานได้ โดยต้องบันทึกผู้อนุมัติและเวลา
- เก็บคลินิก/โรงพยาบาลสัตว์ประจำและเบอร์ติดต่อ
- หากไม่มี ให้ลูกค้าเลือกอนุญาตใช้สถานพยาบาลในเครือกรณีฉุกเฉิน

## 5. กระบวนการจองที่ตกลงแล้ว

1. ลูกค้ากด `จองห้อง` ใน LINE OA
2. เปิด LIFF Customer Booking
3. เลือกวันเข้า วันกลับ และจำนวนแมว
4. ระบบตรวจเพดาน 30 ตัวและห้องว่าง
5. ลูกค้าเลือกประเภทห้องและแพ็กเกจราคา
6. กรอกข้อมูลผู้ปกครอง แมว สุขภาพ และสถานพยาบาลฉุกเฉิน
7. ระบบแสดงยอดรวมและมัดจำ 50%
8. สร้าง booking hold ถึง 24:00 น. ของวันนั้น
9. ลูกค้าชำระเงินและอัปโหลดหลักฐาน
10. รายการเข้าแดชบอร์ดสถานะรอตรวจสลิป
11. พนักงานตรวจและกดยืนยัน
12. ระบบกันห้องอย่างเป็นทางการและส่ง LINE Push Message 1 ครั้ง
13. ลูกค้าเปิดบัตรยืนยัน แคปหน้าจอ หรือพิมพ์เอกสารการจอง
14. ลูกค้ากด `กลับไป LINE OA` ด้วย LIFF close โดยไม่ต้องส่ง Push เพิ่ม

ข้อกำหนดสำคัญ: ป้องกัน Push Message ยืนยันซ้ำสำหรับ booking/event เดียวกันด้วย idempotency key

## 6. แดชบอร์ดและตำแหน่งผู้ใช้งาน

### Owner

- เห็นและจัดการทุกข้อมูล
- ราคา ห้อง ผู้ใช้ สิทธิ์ คืนเงิน และกรณีพิเศษ

### Front Desk

- จองแทนลูกค้า จัดห้อง ตรวจสลิป เช็กอิน เช็กเอาต์ และพิมพ์เอกสาร

### Caregiver

- เห็นข้อมูลดูแลที่จำเป็น
- กดบันทึกทำความสะอาด เติมน้ำ ให้อาหาร ให้ยา ถ่ายรูป และเหตุผิดปกติ
- ไม่เห็นข้อมูลการเงิน

### Housekeeper

- เห็นห้องและงานทำความสะอาด
- กดเริ่มงาน เสร็จงาน เติมทราย และแจ้งอุปกรณ์ขาด
- ไม่เห็นการเงินหรือสุขภาพที่ไม่จำเป็น

UX ต้องใช้ปุ่ม ตัวเลือก และ QR เป็นหลัก เพราะพนักงานบางคนเป็นชาวต่างชาติและไม่ถนัดพิมพ์ข้อความ ระบบควรเก็บ code กลางและแปล label ตามภาษาของพนักงาน

## 7. สถาปัตยกรรมเป้าหมาย

- Customer UI: Mobile-first web/LIFF
- Staff UI: Responsive web dashboard
- Database/Auth/Storage: Supabase
- Server operations: API หรือ Supabase Edge Functions
- LINE: LIFF + Messaging API webhook/push
- AI: OpenAI API ใช้เฉพาะงานช่วยตอบ/สรุป ไม่ใช้ตัดสินห้อง ราคา การชำระ หรือคืนเงิน
- Source of Truth: Supabase PostgreSQL

กฎตรวจห้องว่าง การจองซ้ำ และเพดาน 30 ตัวต้องทำใน database transaction ฝั่ง server ไม่ใช้เฉพาะ validation ใน browser

## 8. ความปลอดภัยที่ต้องรักษา

- ห้ามใส่ `SUPABASE_SECRET_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` หรือ `OPENAI_API_KEY` ใน frontend หรือ commit เข้า source control
- เปิด RLS ทุกตารางที่เปิดผ่าน Supabase Data API
- ลูกค้าเขียน booking/payment ผ่าน server endpoint ที่ตรวจข้อมูลแล้ว
- เอกสารสุขภาพและสลิปอยู่ใน Private Storage
- ใช้ Signed URL อายุสั้นสำหรับการดูไฟล์
- บันทึก audit log สำหรับการเปลี่ยนสถานะ จัดห้อง ตรวจเงิน อนุมัติสุขภาพ และคืนเงิน
- AI ต้องปิดได้ด้วย `AI_ENABLED=false` และระบบจองยังทำงานต่อได้
- ไม่มี secret หรือข้อมูลลูกค้าจริงอยู่ในโครงการปัจจุบัน

## 9. โครงสร้างฐานข้อมูลตั้งต้น

ไฟล์ `database/schema_draft.sql` มีตารางตั้งต้น:

- `hotel_settings`
- `rooms`
- `customers`
- `pets`
- `rate_plans`
- `bookings`
- `booking_pets`
- `booking_room_allocations`
- `payments`
- `refund_requests`
- `booking_status_history`

ไฟล์นี้เป็น draft ไม่ใช่ migration สำหรับ Production ทีมพัฒนาต้อง:

1. ปิดคำตัดสินที่กระทบ schema
2. สร้าง migration ใหม่ด้วย Supabase CLI
3. เพิ่ม transaction/function สำหรับ hold และ confirm booking
4. เพิ่ม role model, RLS policies, Storage policies และ audit fields
5. เพิ่มตาราง/ฟิลด์สำหรับ daily care tasks, print history, LINE delivery idempotency และ emergency consent หากยังไม่มี
6. ทดสอบ concurrent booking อย่างน้อย 2 request ในช่วงเวลาเดียวกัน

## 10. ตัวแปรระบบ

ดูรายการได้ที่ `.env.example`

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_LINE_LIFF_ID
SUPABASE_SECRET_KEY
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
PAYMENT_WEBHOOK_SECRET
OPENAI_API_KEY
OPENAI_PROJECT_ID
OPENAI_MODEL
AI_ENABLED=false
PUBLIC_APP_URL
```

ไฟล์ `.env.example` มีเฉพาะชื่อคีย์ ห้ามนำค่า secret ไปเขียนใน HANDOFF หรือเอกสารอื่น

## 11. สถานะโค้ด

- มี root `package.json`, `pnpm-workspace.yaml` และ TypeScript base config
- มี `packages/domain` พร้อมกฎคำนวณราคาตั้งต้น มัดจำ และเพดาน 30 ตัว
- `apps/customer-booking` เป็น Next.js Web App ที่มีหน้าจองลูกค้า, Booking API, LINE webhook และ Staff Dashboard ในแอปเดียวกัน
- Customer Booking และ Staff Dashboard เชื่อม Supabase Production ผ่าน environment variables ของ Vercel แล้ว
- Staff Dashboard ที่ใช้งานจริงอยู่ที่ `apps/customer-booking/app/staff`; ส่วน `apps/staff-dashboard/prototypes` เป็นไฟล์ต้นแบบอ้างอิงเดิม
- Server API ที่ใช้งานจริงอยู่ใต้ `apps/customer-booking/app/api`; `services/booking-api` ยังเป็นโครงสร้างที่เสนอเดิม
- Deploy Production ผ่าน Vercel และ source code หลักอยู่ใน GitHub สาขา `main`
- ยังไม่มี integration test runner/CI ที่ครอบคลุมทุก booking flow, concurrent booking, LINE delivery และการลบข้อมูล
- อย่ารายงานว่า Production-ready จนกว่าจะผ่าน acceptance test, pilot กับพนักงาน, ทดสอบ LINE บน iOS/Android และทดสอบเครื่องพิมพ์จริง

## 12. ลำดับการพัฒนาที่แนะนำ

### Phase 1 — Foundation

1. ปิดประเด็น P0 ในหัวข้อ 13
2. สร้าง Supabase Development Project
3. สร้าง migration, seed, RLS และ Storage buckets
4. สร้าง authentication สำหรับพนักงานและเชื่อม LINE identity สำหรับลูกค้า

### Phase 2 — Booking Core

1. Availability transaction
2. Quote และ price snapshot
3. Booking hold พร้อมหมดอายุ 24:00 น.
4. Room allocation และเพดาน 30 ตัว
5. Payment proof upload และ staff confirmation
6. Audit/status history

### Phase 3 — User Interfaces

1. แปลง Customer HTML prototype เป็น application จริง
2. แปลง Staff Dashboard prototype เป็น application จริง
3. ทำ No-Typing task buttons และ role-based navigation
4. เชื่อมเอกสาร POS 80 มม. กับข้อมูลจริง

### Phase 4 — LINE และ Notifications

1. LIFF app และปุ่มจองใน Rich Menu
2. Webhook signature validation
3. ปุ่มกลับ LINE ด้วย `liff.closeWindow()` พร้อม fallback
4. Push ยืนยันเพียง 1 ครั้งหลังพนักงาน confirm
5. แจ้งเตือนเอกสารก่อนเข้าพัก 1 วัน

### Phase 5 — QA และ Pilot

1. ทดสอบมือถือ iOS/Android และ LINE in-app browser
2. ทดสอบ concurrent booking และ booking expiry
3. ทดสอบสิทธิ์ทุก role
4. ทดสอบ Thermal POS 80 มม. กับเครื่องจริง
5. ทดลองใช้กับพนักงานและข้อมูลจำลองก่อนเปิด Production

## 13. ประเด็นที่ต้องตอบก่อนเริ่ม Production

### P0 — ต้องตอบก่อนสร้าง Booking Core

- แมว 1 ตัวพัก Condo ได้หรือไม่ เพราะ Condo ระบุ 2–4 ตัว แต่เป็นห้องที่แนะนำก่อน
- วิธีนับจำนวนคืนอย่างเป็นทางการ
- ความจุและชื่อภายในของห้องสำรอง 2 ห้อง
- เวลาที่ต้อง block ห้องเพื่อทำความสะอาดหลังเช็กเอาต์
- ใช้ LINE Login อย่างเดียวหรือเพิ่ม OTP เบอร์โทร
- วิธีตรวจสลิป: พนักงานตรวจเอง, Slip Verification API หรือ Payment Gateway
- ยืนยันข้อมูลรับชำระและ QR กับธนาคาร

### P1 — ต้องตอบก่อน Pilot

- ภาษาของพนักงานแต่ละตำแหน่ง
- พนักงานหนึ่งคนมีได้หลาย role หรือไม่
- ผู้มีสิทธิ์ยืนยันการให้ยาและเหตุผิดปกติ
- ประเภทและขนาดไฟล์อัปโหลด
- ระยะเวลาเก็บสลิปและเอกสารสุขภาพ
- Privacy notice และ consent ฉบับใช้งานจริง
- วงเงินฉุกเฉินที่ลูกค้ายินยอม

### P2 — พัฒนาหลัง MVP ได้

- ราคารายเดือน
- ค่าดูแลพิเศษ/ให้ยา
- Dynamic QR และ payment callback
- OpenAI assistant
- Voice-to-text สำหรับพนักงาน
- ระบบรายงานและวิเคราะห์ลูกค้าประจำ

## 14. Definition of Done สำหรับ MVP

- ลูกค้าจองผ่าน LIFF ได้และได้รับเลขจอง
- ไม่มีห้องเดียวกันถูกยืนยันซ้ำในช่วงเวลาทับซ้อน
- ระบบไม่ให้ยอดแมวเกิน 30 ตัว
- ราคาและมัดจำคำนวณตรงตามกฎ
- hold หมดอายุ 24:00 น. และคืน inventory
- ลูกค้าอัปโหลดสลิปและเอกสารได้อย่างปลอดภัย
- พนักงานตรวจเงิน จัดห้อง และยืนยันได้ตามสิทธิ์
- ส่ง Push ยืนยันไม่เกิน 1 ครั้งต่อ event
- ระบบจองทำงานได้แม้ OpenAI ปิดหรือเครดิตหมด
- พิมพ์เอกสารการจองและใบหน้าห้องบน POS 80 มม. ได้
- Audit log ระบุผู้ดำเนินการและเวลาได้
- ผ่าน acceptance criteria และ pilot กับพนักงาน

## 15. หมายเหตุสำหรับผู้รับช่วงงาน

- เริ่มจากข้อมูลในเอกสารและ prototype ที่มีอยู่ ไม่ควรเขียนระบบใหม่โดยข้ามกฎธุรกิจ
- Prototype มีข้อมูลตัวอย่าง เช่น `BK-20260730-015`, ชื่อแมว และยอดเงิน ห้ามนำไปใช้เป็นข้อมูลจริง
- หากเอกสารขัดกัน ให้ยึด `docs/02_BUSINESS_RULES.md` และคำยืนยันล่าสุดจาก Owner แล้วอัปเดต Decision Log
- ทุกการแก้กฎราคา ความจุ และ payment flow ต้องเพิ่ม acceptance test
- อัปเดต `STATUS.md`, `HANDOFF.md` และ `docs/10_DECISIONS_REQUIRED.md` เมื่อมีคำตัดสินใหม่
