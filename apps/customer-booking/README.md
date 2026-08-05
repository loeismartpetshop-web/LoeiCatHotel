# Customer Booking App

Customer Booking Web App สำหรับเปิดจาก LINE OA/LIFF พัฒนาด้วย vinext, React และ TypeScript โดยต่อยอดจาก Prototype เดิมโดยไม่เปลี่ยนโครงสร้าง Monorepo

## สถานะปัจจุบัน

- มี Web App แบบ responsive และ mobile-first ที่รัน/build ได้
- มีขั้นตอนเลือกวัน จำนวนแมว ห้อง แพ็กเกจ ข้อมูลผู้ปกครอง/แมว และหน้าสรุป
- ใช้กฎราคา มัดจำ และเพดาน 30 ตัวจาก `@loei-cat-hotel/domain`
- มี validation ฝั่งหน้าจอและแสดงข้อจำกัดที่ยังต้องปิดคำตัดสิน
- ยังเป็นโหมดต้นแบบ ไม่สร้าง booking จริงและยังไม่เชื่อม Supabase/Booking API/LIFF

## ต้นแบบอ้างอิง

- `prototypes/booking.html` — หน้าจองเดิมบนมือถือ
- `prototypes/booking-confirmed.html` — หน้าหลังยืนยันการจอง
- `prototypes/booking-pass-mobile.html` — บัตรยืนยันบนมือถือ
- `prototypes/booking-confirmation-80mm.html` — เอกสารยืนยัน POS 80 มม.

## Security

- ใช้ publishable key เท่านั้นเมื่อเชื่อม Supabase
- ไม่เขียนตาราง booking/payment จาก frontend โดยตรง
- เรียก Booking API/Edge Function สำหรับการเปลี่ยนสถานะสำคัญ
- ไม่เก็บ health document URL แบบ public