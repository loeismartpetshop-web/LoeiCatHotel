# LOEI CAT HOTEL Booking System

เปิด [HTML Overview](HTML_OVERVIEW.html) เพื่อดูหน้าต้นแบบทั้งหมดและสถานะความพร้อมในหน้าเดียว

ผู้รับช่วงพัฒนาให้อ่าน [HANDOFF](HANDOFF.md) ก่อนเริ่มงาน

ระบบจองห้องพักโรงแรมแมวเมืองเลย สำหรับลูกค้าผ่าน LINE OA และสำหรับพนักงานผ่านเว็บหลังบ้าน โดยใช้ฐานข้อมูลกลางชุดเดียวกัน

## สถานะโครงการ

- ระยะ: Project Foundation / Ready for Development
- เวอร์ชันเอกสาร: 1.0
- วันที่เริ่มต้น: 2026-07-29
- เจ้าของธุรกิจ: บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด
- แบรนด์: โรงแรมแมวเมืองเลย (LOEI CAT HOTEL)

## เป้าหมาย

1. ป้องกันการจองซ้ำและไม่รับแมวเกิน 30 ตัวต่อวัน
2. ให้ลูกค้าตรวจห้องว่าง จอง และชำระมัดจำผ่านลิงก์จาก LINE OA
3. ให้พนักงานเห็นตารางห้อง เช็กอิน เช็กเอาต์ การชำระเงิน และข้อมูลดูแลในระบบเดียว
4. เก็บข้อมูลสุขภาพ พฤติกรรม อาหาร ยา และเอกสารอย่างเป็นระบบ
5. รองรับ AI สำหรับตอบคำถาม เก็บข้อมูล ติดตามการชำระเงิน และแจ้งเตือน โดย AI ไม่เป็นผู้ตัดสินห้องว่างหรือยอดเงินเอง

## โครงสร้างโครงการ

```text
loei-cat-hotel-booking/
├── docs/                  เอกสารธุรกิจ สถาปัตยกรรม และแผนพัฒนา
├── database/              แบบร่างฐานข้อมูลและข้อมูลตั้งต้น
├── apps/
│   ├── customer-booking/  หน้าจองสำหรับลูกค้าและ LINE OA
│   └── staff-dashboard/   เว็บหลังบ้านสำหรับพนักงาน
├── packages/
│   └── domain/            กฎธุรกิจที่ทุกส่วนใช้งานร่วมกัน
├── services/
│   └── booking-api/       API, LINE OA, OpenAI และงานอัตโนมัติ
└── tests/                 เกณฑ์ตรวจรับระบบ
```

โครงการใช้รูปแบบ TypeScript Monorepo โดย Customer Booking Web App สามารถรันและ build ได้แล้ว ส่วน Booking API, Supabase และ Staff Dashboard ระบบจริงยังอยู่ระหว่างพัฒนา

## เอกสารเริ่มต้น

0. [สถานะโครงการและสิ่งที่ยังไม่ได้ทำ](STATUS.md)
1. [Project Charter](docs/01_PROJECT_CHARTER.md)
2. [Business Rules](docs/02_BUSINESS_RULES.md)
3. [Data Dictionary](docs/03_DATA_DICTIONARY.md)
4. [System Architecture](docs/04_SYSTEM_ARCHITECTURE.md)
5. [Customer Booking Flow](docs/05_CUSTOMER_BOOKING_FLOW.md)
6. [Staff Dashboard](docs/06_STAFF_DASHBOARD.md)
7. [LINE OA and AI](docs/07_LINE_OA_AI_SPEC.md)
8. [Security and Privacy](docs/08_SECURITY_PRIVACY.md)
9. [Roadmap](docs/09_ROADMAP.md)
10. [Decisions Required](docs/10_DECISIONS_REQUIRED.md)
11. [Room Label POS 80 mm](docs/11_ROOM_LABEL_80MM.md)
12. [Roles and No-Typing UX](docs/12_ROLES_AND_NO_TYPING_UX.md)

## หลักการสำคัญ

- Supabase PostgreSQL เป็น Single Source of Truth ตาม SmartPet ADR-001
- การตรวจห้องว่าง ราคา และเพดาน 30 ตัวเป็นกฎของระบบ ไม่ให้ AI เดา
- ลูกค้าเขียนข้อมูลผ่าน API/Edge Function เท่านั้น ไม่เขียนตารางสำคัญโดยตรง
- เอกสารสุขภาพจัดเก็บใน Private Storage และเข้าถึงด้วยสิทธิ์ที่จำกัด
- Service role/secret key ห้ามอยู่ในเว็บลูกค้าหรือเว็บพนักงาน
- ทุกการเปลี่ยนสถานะสำคัญต้องมีประวัติผู้ดำเนินการและเวลา

## ขั้นตอนต่อไป

1. ปิดรายการตัดสินใจที่ยังค้างใน `docs/10_DECISIONS_REQUIRED.md`
2. สร้าง Supabase development project และเชื่อม Supabase CLI
3. สร้าง migration ด้วย `supabase migration new` จาก `database/schema_draft.sql`
4. ทดสอบ schema, RLS, Storage policies และ availability transaction
5. พัฒนาหน้าจองลูกค้าและเว็บหลังบ้านตาม acceptance criteria
