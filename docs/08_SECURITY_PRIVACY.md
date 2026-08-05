# Security and Privacy Baseline

Document Type: Security Standard  
Version: 1.0  
Status: Required

## การจัดชั้นข้อมูล

| ระดับ | ตัวอย่าง | การควบคุม |
|---|---|---|
| Public | ราคา เวลาเปิด ประเภทห้อง | แสดงสาธารณะได้ |
| Internal | สถานะห้อง รายงานงาน | เฉพาะพนักงาน |
| Confidential | เบอร์โทร LINE ID ประวัติการจอง | RLS และ least privilege |
| Sensitive | เอกสารสุขภาพ ยา ข้อมูลสัตวแพทย์ | Private Storage, signed URL, audit |

## RLS Baseline

- เปิด RLS ทุกตารางใน exposed schema
- ลูกค้าไม่อ่าน booking ด้วยรหัสที่เดาได้
- authenticated อย่างเดียวไม่เพียงพอ ต้องตรวจ ownership/role
- UPDATE ต้องมีทั้ง USING และ WITH CHECK
- role ใช้ app metadata หรือ staff profile ที่ server ควบคุม ไม่ใช้ user metadata
- views ที่ expose ให้ client ต้องใช้ `security_invoker = true` หรืออยู่ใน private schema
- SECURITY DEFINER ใช้เฉพาะกรณีจำเป็น อยู่ใน private schema ตรวจ auth และ revoke execute from public

## Frontend Secrets

- ฝั่งเว็บใช้ publishable key เท่านั้น
- service role/secret key อยู่ใน Edge Function secrets เท่านั้น
- ไม่ commit `.env` จริง
- webhook payment และ LINE ต้องตรวจ signature

## Storage

- bucket: `cat-hotel-health-documents` แบบ private
- จำกัดชนิดไฟล์ `image/jpeg`, `image/png`, `application/pdf`
- กำหนดขนาดสูงสุดก่อนเปิดใช้งานจริง
- object path ใช้ UUID ไม่ใช้ชื่อ/เบอร์โทร
- signed URL อายุสั้นสำหรับพนักงานที่มีสิทธิ์
- upload policy ต้องรองรับ INSERT และ SELECT; หากอนุญาตแทนที่ไฟล์จึงเพิ่ม UPDATE

## Logging

- ไม่ log access token, secret, payment credentials หรือเอกสารเต็ม
- log การดู/ดาวน์โหลดเอกสารสุขภาพเมื่อระบบรองรับ
- log override ห้อง ราคา สถานะ และการคืนเงิน

## Retention Decisions

ต้องกำหนดก่อน production:

- ระยะเวลาเก็บเอกสารสุขภาพ
- ระยะเวลาเก็บข้อมูลลูกค้าที่ไม่กลับมาใช้บริการ
- ขั้นตอนขอลบ/ส่งออกข้อมูล
- การสำรองและกู้คืน

## Official References

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/security/product-security

