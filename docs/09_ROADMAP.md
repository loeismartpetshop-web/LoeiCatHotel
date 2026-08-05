# Development Roadmap

Document Type: Roadmap  
Version: 1.0  
Status: Proposed

## Phase 0: Foundation

- อนุมัติ business rules และ decisions ที่ค้าง
- สร้าง Supabase development project
- เชื่อม repository และ Supabase CLI
- สร้าง migration, seed และ test data
- วาง RLS และบทบาทพนักงาน

## Phase 1: Booking Core

- rooms, customers, pets, bookings, allocations
- availability transaction และเพดาน 30 ตัว
- pricing และ deposit calculation
- booking state machine
- payment record และ expiry job
- automated tests สำหรับ overlap, capacity และ idempotency

## Phase 2: Staff Dashboard

- login และ staff roles
- dashboard วันนี้
- room calendar
- booking management
- check-in/check-out และยอดคงเหลือ
- health review และ care tasks
- refund review

## Phase 3: Customer Web + LINE OA

- customer booking flow
- LIFF/LINE Login
- booking status และ upload เอกสาร
- LINE Messaging API notifications
- Rich Menu และ staff handoff

## Phase 4: AI Assistant

- knowledge retrieval
- tool/API calling สำหรับ availability, price, status
- intent routing และ staff handoff
- monitoring, evaluation และ guardrails

## Phase 5: Optimization

- รายงาน occupancy, revenue, repeat customers
- ระบบขอรีวิว
- grooming และ Loei Cat Club
- marketing automation

## Definition of Done ระยะที่ 1

- schema และ migration ผ่านการ review
- RLS และ grants ผ่าน security test
- จองพร้อมกันแล้วไม่เกิดห้องซ้ำ
- ทุกวันที่ทับซ้อนไม่เกิน 30 ตัว
- price/deposit คำนวณจาก server
- expiry ที่ 24.00 น. ปล่อยห้องได้และ retry ไม่สร้างผลซ้ำ
- มี audit history สำหรับสถานะสำคัญ

