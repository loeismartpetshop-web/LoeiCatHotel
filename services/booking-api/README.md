# Booking API

บริการกลางสำหรับทุกการเปลี่ยนแปลงข้อมูลสำคัญ

## Endpoint สำหรับ MVP

- `POST /availability/check`
- `POST /quotes`
- `POST /bookings/hold`
- `POST /bookings/:id/payment-proof`
- `POST /bookings/:id/confirm`
- `POST /line/webhook`
- `POST /ai/assist`

## กฎสำคัญ

- ตรวจจำนวนรวม 30 ตัวและห้องซ้ำใน database transaction
- ตรวจ LINE webhook signature ก่อนประมวลผล
- OpenAI API key และ Supabase secret key อยู่ฝั่ง server เท่านั้น
- หาก AI ใช้งานไม่ได้ ให้ตอบข้อความมาตรฐานและส่งต่อพนักงาน
- AI ห้ามยืนยันห้อง ราคา การชำระเงิน หรือการคืนเงินเอง
