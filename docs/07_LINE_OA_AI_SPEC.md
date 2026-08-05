# LINE OA and AI Specification

Document Type: Integration and AI Specification  
Version: 1.0  
Status: Ready for Integration Design

## LINE OA

Rich Menu ที่แนะนำ:

- จองห้องพัก
- ตรวจสอบการจอง
- ส่งเอกสารสุขภาพ
- ราคาและประเภทห้อง
- ติดต่อทีมงาน
- แผนที่โรงแรม

## AI Intent

| Intent | การทำงาน |
|---|---|
| check_availability | เรียก API ด้วยวันและจำนวนแมว |
| quote_price | เรียก pricing API และแสดงผลจากระบบ |
| explain_room | อธิบายวิลล่า/คอนโดจากฐานความรู้ |
| start_booking | ส่ง deep link ไปหน้าจอง |
| booking_status | ยืนยันตัวตนแล้วเรียก booking API |
| upload_health_document | ส่ง deep link แบบ scoped ไปหน้าอัปโหลด |
| cancel_request | สร้างคำขอให้ทีมงานติดต่อกลับ |
| speak_to_staff | ส่งต่อทีมงานพร้อมสรุปบทสนทนา |

## AI Guardrails

- ไม่สร้าง booking โดยการเขียนฐานข้อมูลโดยตรง
- ไม่รับราคา ยอด หรือสถานะจากข้อความลูกค้าเป็นค่าจริง
- ใช้ tool/API response เป็นข้อมูลอ้างอิงทุกครั้ง
- ไม่แสดงข้อมูล booking จนกว่าจะยืนยันตัวตนด้วย LINE identity และ/หรือ OTP เบอร์โทร
- ไม่ประมวลผลคืนเงินเอง
- เรื่องสุขภาพต้องใช้ข้อความว่าเป็นการเก็บข้อมูล ไม่ใช่การวินิจฉัย
- เมื่อ API ล้มเหลว ให้แจ้งตามจริงและส่งต่อทีมงาน

## Handoff Package

เมื่อส่งต่อให้พนักงาน AI ต้องสรุป:

- ชื่อลูกค้าและช่องทางติดต่อ
- intent และคำถามล่าสุด
- วันเข้าพัก/รับกลับ จำนวนแมว และประเภทห้องถ้ามี
- booking code ถ้ามี
- รายการข้อมูลที่ขาด
- ระดับเร่งด่วน

## Knowledge Source

- คู่มือธุรกิจ LOEI CAT HOTEL
- Business rules ในโครงการนี้
- ราคาและห้องจาก API เท่านั้น
- FAQ ที่ผ่านการอนุมัติ
- ห้ามให้ AI ใช้ข้อความสนทนาเก่าเป็น source of truth ด้านราคา/ห้อง

