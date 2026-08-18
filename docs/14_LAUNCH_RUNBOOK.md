# แผนขึ้นระบบจริง — LOEI CAT HOTEL

Document Type: Launch Runbook
Version: 1.0
อัปเดต: 5 สิงหาคม 2026

ลำดับการขึ้นระบบ LINE OA + Supabase + Vercel ตั้งแต่สถานะปัจจุบันจนเปิดรับลูกค้าจริง

อ่านคู่กับ `13_LINE_OA_SETUP_GUIDE.md` (รายละเอียด LINE) และ `HANDOFF.md` (กฎธุรกิจ)

---

## สถานะตั้งต้น

| ส่วน | สถานะ |
|---|---|
| LINE Provider / Messaging API / LINE Login / LIFF | เสร็จ |
| ค่า 4 ตัวใน `.env` | ครบ |
| หน้าเว็บลูกค้า `loeicathotel.vercel.app` | ออนไลน์ (prototype) |
| Supabase project | **ยังไม่มี** |
| API / webhook | **ยังไม่มีโค้ด** |
| Staff dashboard | prototype HTML |
| Decision ที่ค้าง | **บล็อกอยู่หลายข้อ** |

**สถาปัตยกรรมที่เลือก:** API เป็น route ในโปรเจค Vercel เดียวกับหน้าเว็บ → `https://loeicathotel.vercel.app/api/...`

```
LINE OA ──webhook──> Vercel /api/line/webhook ──> Supabase
LIFF ────────────────> Vercel หน้าเว็บ ──/api/──> Supabase
Staff ───────────────> Vercel หน้าพนักงาน ──/api/──> Supabase
```

---

## Phase 0 — ปิด decision ที่บล็อก (ก่อนแตะโค้ด)

จาก `10_DECISIONS_REQUIRED.md` ข้อที่ **บล็อกจริง** ต้องตอบก่อน เพราะแก้ทีหลังแปลว่าต้องเขียน migration ใหม่และแก้ logic:

| # | คำถาม | บล็อกอะไร |
|---|---|---|
| 1 | นับจำนวนคืนยังไง (เข้า 09:00 ออก 12:00 วันถัดไป = 1 คืน?) | สูตรคำนวณราคาทั้งหมด |
| 2 | แมว 1 ตัวพักคอนโดได้ไหม | logic จัดห้อง + ตรวจห้องว่าง |
| 3 | หลังเช็กเอาต์ block ห้องกี่นาทีเพื่อทำความสะอาด | ตรวจห้องว่าง |
| 4 | ลูกค้ายืนยันตัวตนด้วย LINE Login อย่างเดียว หรือ + OTP เบอร์ | โครงสร้าง auth ทั้งระบบ |
| 5 | พนักงานล็อกอินยังไง (email/password / magic link) | Supabase Auth config |
| 6 | ตรวจสลิปยังไง — คนดูอย่างเดียว หรือมีตรวจอัตโนมัติ | flow ยืนยันการจอง |
| 7 | ไฟล์เอกสารสุขภาพ: ขนาดสูงสุด ชนิดไฟล์ เก็บกี่ปี | Storage policy + RLS |
| 8 | ข้อความ consent และนโยบายความเป็นส่วนตัว | หน้าจอง (กฎหมาย ต้องมีก่อนรับข้อมูลจริง) |

**เลื่อนไปทีหลังได้:** ราคารายเดือน, ค่าดูแลพิเศษ/ให้ยา, ค่าพาไปโรงพยาบาล, SLA คืนเงิน, payment gateway (MVP ใช้ PromptPay + สลิป), ห้องสำรอง 2 ห้อง (เปิดโดยไม่มีก่อนได้)

> ข้อ 8 เป็นเรื่องกฎหมาย ไม่ใช่แค่เทคนิค — **ห้ามรับข้อมูลลูกค้าจริงก่อนมีข้อความ consent**

---

## Phase 1 — Supabase

### 1.1 สร้าง project

- Region: **Southeast Asia (Singapore)** ใกล้ไทยที่สุด latency ต่ำสุด
- สร้าง 2 project: `loei-cat-hotel-dev` และ `loei-cat-hotel-prod`
- เก็บ database password ไว้ใน password manager ไม่ใช่ในไฟล์

### 1.2 แปลง schema เป็น migration

`database/schema_draft.sql` มีอยู่แล้ว (16 ห้อง: คอนโด 9 + วิลล่า 7) แต่หัวไฟล์ระบุชัดว่า **ห้าม deploy ตรง**

```bash
supabase link --project-ref <dev-ref>
supabase migration new initial_schema
# วางเนื้อหาจาก database/schema_draft.sql
supabase db push
```

ต้องแก้ schema ตามคำตอบ Phase 0 ก่อน push โดยเฉพาะข้อ 2 (`minimum_pets` ของคอนโดตอนนี้ = 2) และข้อ 3 (ต้องมีฟิลด์เวลาทำความสะอาด)

### 1.3 ตารางที่ต้องเพิ่มจาก draft

ตาม `HANDOFF.md` ข้อ 5:

- `line_message_log` — กัน push ซ้ำ (`idempotency_key` เป็น primary key)
- `daily_care_tasks` — งานดูแลประจำวัน
- `print_history` — ประวัติพิมพ์เอกสาร
- `emergency_consent` — ความยินยอมใช้สถานพยาบาลในเครือ

### 1.4 RLS — เปิดทุกตาราง ไม่มีข้อยกเว้น

```sql
alter table public.bookings enable row level security;
-- ทำทุกตาราง
```

หลักการ: ลูกค้า **ไม่เขียน** ตาราง booking/payment ตรง ๆ ทุกอย่างผ่าน API route ที่ตรวจข้อมูลแล้ว RLS เป็นชั้นป้องกันสุดท้าย ไม่ใช่ชั้นเดียว

### 1.5 Storage

| Bucket | Public? | เก็บอะไร |
|---|---|---|
| `health-documents` | **Private** | วัคซีน ใบรับรองสุขภาพ |
| `payment-slips` | **Private** | สลิปมัดจำ |
| `care-photos` | Private | รูปน้องแมวระหว่างเข้าพัก |

เข้าถึงด้วย signed URL อายุสั้นเท่านั้น ห้ามตั้ง public

### 1.6 Seed

`database/seed_reference.sql` มีราคา 3 แพ็กเกจและห้อง 16 ห้องพร้อมแล้ว — **ใช้กับ dev เท่านั้น** ส่วน prod ต้องยืนยันเลขห้องจริงกับเจ้าของก่อน

---

## Phase 2 — API บน Vercel

### 2.1 ปัญหาที่ต้องแก้ก่อน: prefix ตัวแปร

`.env.example` ใช้ `PUBLIC_LINE_LIFF_ID` แต่ Next.js/vinext จะส่งตัวแปรไปถึง browser **เฉพาะที่ขึ้นต้นด้วย `NEXT_PUBLIC_`** เท่านั้น

ถ้าไม่แก้ `process.env.PUBLIC_LINE_LIFF_ID` จะเป็น `undefined` ใน browser และ `liff.init()` พังทันที

เลือกทางใดทางหนึ่งแล้วทำให้ตรงกันทั้งโปรเจค:

- เปลี่ยนชื่อเป็น `NEXT_PUBLIC_LINE_LIFF_ID` (ง่ายสุด)
- หรือ map ผ่าน build config

### 2.2 ตั้ง Environment Variables ใน Vercel

Project Settings → Environment Variables แยก Production / Preview

| ตัวแปร | ฝั่ง |
|---|---|
| `NEXT_PUBLIC_LINE_LIFF_ID` | Client |
| `NEXT_PUBLIC_SUPABASE_URL` | Client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client |
| `LINE_LOGIN_CHANNEL_ID` | **Server only** |
| `LINE_CHANNEL_SECRET` | **Server only** |
| `LINE_CHANNEL_ACCESS_TOKEN` | **Server only** |
| `SUPABASE_SECRET_KEY` | **Server only** |

ตรวจว่าไม่มีตัว Server only หลุดเข้า client bundle: `pnpm build` แล้ว grep หา token ในไฟล์ `dist/client/`

### 2.3 ลำดับสร้าง endpoint

| ลำดับ | Endpoint | ต้องมี Supabase? |
|---|---|---|
| 1 | `POST /api/line/webhook` (verify + reply) | ไม่ต้อง |
| 2 | `POST /api/availability/check` | ต้อง |
| 3 | `POST /api/quotes` | ต้อง |
| 4 | `POST /api/bookings/hold` | ต้อง |
| 5 | `POST /api/bookings/:id/payment-proof` | ต้อง |
| 6 | `POST /api/bookings/:id/confirm` → push | ต้อง |
| 7 | `POST /api/ai/assist` | ต้อง (ทำหลังสุด `AI_ENABLED=false`) |

**ข้อ 1 ทำได้เลยตอนนี้** ใช้ค่าที่มีครบแล้ว ไม่ต้องรอ Supabase

### 2.4 กฎที่ห้ามพลาด

**Webhook ต้องอ่าน raw body**

```ts
// app/api/line/webhook/route.ts
export async function POST(req: Request) {
  const raw = await req.text();          // raw ก่อน parse
  const sig = req.headers.get('x-line-signature');
  if (!sig || !verifyLineSignature(raw, sig)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = JSON.parse(raw);
  // ...
  return new Response('OK', { status: 200 });
}
```

JSON parse ก่อนคำนวณ signature = validate ไม่ผ่านทุกครั้ง

**ต้องตอบ 200 ภายใน ~1 วินาที** — Vercel serverless อาจถูกตัดหลัง response ส่งกลับ ห้ามทำงานหนักหลัง return ถ้าต้องทำ ให้ใช้ `waitUntil()` หรือแยกเป็นงาน background

**การตรวจห้องว่าง / เพดาน 30 ตัว ต้องอยู่ใน DB transaction**

เขียนเป็น Postgres function แล้วเรียกด้วย `rpc()` ห้ามทำแบบ select-แล้ว-insert ใน JS เพราะลูกค้า 2 คนกดพร้อมกันจะจองทับกันได้ (`HANDOFF.md` ข้อ 7)

**ห้ามเชื่อ userId จาก client**

รับ `liff.getIDToken()` แล้ว verify ที่ server ด้วย `LINE_LOGIN_CHANNEL_ID` ก่อนผูกกับ booking เสมอ

---

## Phase 3 — เชื่อม LINE เข้าระบบจริง

1. Deploy webhook แล้วใส่ Webhook URL: `https://loeicathotel.vercel.app/api/line/webhook` → กด **Verify**
2. ยืนยัน **Bot link feature** ใน LIFF: On (Aggressive) + ผูก OA `LOEI CAT HOTEL`
3. ต่อ `liff.init()` + ปุ่มกลับ LINE (`liff.closeWindow()`) ในหน้าจอง
4. Rich Menu 6 ปุ่ม (`13_LINE_OA_SETUP_GUIDE.md` ข้อ 7) — MVP ทำผ่าน OA Manager ก่อน
5. Push ยืนยัน + `line_message_log` กันซ้ำ
6. **ปิด Auto-response** — ทำ **ขั้นตอนนี้เป็นขั้นสุดท้าย** เท่านั้น ปิดก่อนที่ webhook จะพร้อม = ลูกค้า 228 คนทักมาแล้วเงียบ

---

## Phase 4 — Staff Dashboard

ตอนนี้เป็น prototype HTML ยังไม่ได้ต่อข้อมูลจริง

1. Supabase Auth สำหรับพนักงาน (ตาม Phase 0 ข้อ 5)
2. RLS ตามตำแหน่ง: Owner / Front Desk / Caregiver / Housekeeper (`HANDOFF.md` ข้อ 6)
   - Caregiver และ Housekeeper **ห้ามเห็นข้อมูลการเงิน**
3. หน้าตรวจสลิป → กดยืนยัน → trigger push
4. พิมพ์เอกสาร Thermal 80 มม. (`11_ROOM_LABEL_80MM.md`)
5. UX แบบกดเลือก ไม่ต้องพิมพ์ (`12_ROLES_AND_NO_TYPING_UX.md`) — พนักงานบางคนเป็นชาวต่างชาติ

---

## Phase 5 — ทดสอบและเปิดใช้

### ก่อนเปิด

- [ ] รัน `tests/ACCEPTANCE_CRITERIA.md` ให้ผ่านครบ
- [ ] ทดสอบจองพร้อมกัน 2 เครื่อง ต้องไม่จองทับ
- [ ] ทดสอบเพดาน 30 ตัว ต้องกันได้จริง
- [ ] ทดสอบ push ยืนยัน — ยิงซ้ำ 3 ครั้ง ต้องส่งแค่ 1
- [ ] ทดสอบบนมือถือจริง iOS + Android ใน LINE in-app browser
- [ ] ทดสอบพิมพ์กับเครื่อง POS 80 มม. ตัวจริง
- [ ] ตรวจว่า secret ไม่หลุดเข้า client bundle
- [ ] เช็คโควตา push ของแพ็กเกจ OA พอกับจำนวนจองต่อเดือนไหม

### วันเปิด

1. **Publish** channel `Login Cat Hotel` (ตอนนี้เป็น Developing ลูกค้าเข้าไม่ได้)
2. ชี้ทุกอย่างไป Supabase prod
3. เปลี่ยน LIFF Endpoint URL ถ้าย้ายไป custom domain
4. เปิด Rich Menu
5. ปิด Auto-response
6. ทดสอบจองจริง 1 รายการด้วยบัญชีตัวเอง ตั้งแต่ต้นจนจบ

### เกณฑ์ว่าสำเร็จ

- ลูกค้าจองผ่าน LIFF ได้และได้เลขจอง
- ห้องไม่ถูกจองซ้ำ เพดาน 30 ตัวกันได้จริง
- push ยืนยันไม่เกิน 1 ครั้งต่อ event
- พนักงานเห็นรายการและกดยืนยันได้
- พิมพ์เอกสารหน้าห้องได้

> `HANDOFF.md` เตือนไว้: **อย่ารายงานว่า production ready จนกว่าจะผ่าน acceptance test และทดสอบกับ LINE และเครื่องพิมพ์จริง**

---

## แบ่งงาน

| งาน | ใครทำ |
|---|---|
| ตอบ decision Phase 0 | **เจ้าของ** — ไม่มีใครตอบแทนได้ |
| สร้าง Supabase project + เก็บ key | เจ้าของ |
| หน้าเว็บลูกค้า / staff dashboard | codex |
| migration, RLS, API routes, webhook | ตกลงกันว่าใคร |
| Rich Menu, ตั้งค่า OA | เจ้าของ |
| ทดสอบเครื่องพิมพ์และมือถือจริง | เจ้าของ |

---

## ความเสี่ยงที่ต้องจับตา

| ความเสี่ยง | ผลกระทบ | ทางลด |
|---|---|---|
| ปิด Auto-response ก่อน webhook พร้อม | ลูกค้า 228 คนทักมาแล้วเงียบ | ทำเป็นขั้นสุดท้ายเสมอ |
| จองทับกันตอนคนกดพร้อมกัน | ต้องขอโทษลูกค้า เสียชื่อ | บังคับใช้ DB transaction |
| push ซ้ำ | เปลืองโควตา ลูกค้าสับสน | idempotency key ระดับ DB |
| secret หลุดเข้า frontend | ใครก็ส่งข้อความในนาม OA ได้ | ตรวจ bundle ก่อน deploy ทุกครั้ง |
| prefix `PUBLIC_` vs `NEXT_PUBLIC_` | LIFF พังใน production แต่ dev ปกติ | แก้ให้ตรงกันตั้งแต่ Phase 2 |
| โควตา push ไม่พอ | ลูกค้าไม่ได้รับการยืนยัน | เช็คแพ็กเกจก่อนเปิด |
| ใช้ seed dev บน prod | ห้องไม่ตรงความจริง | ยืนยันเลขห้องกับเจ้าของ |

---

## ทำอะไรต่อได้เลยวันนี้

1. **ตอบ Phase 0** — 8 ข้อ ไม่ต้องใช้โค้ด แต่บล็อกทุกอย่าง
2. **สร้าง Supabase dev project** — 10 นาที ทำคู่ขนานกับข้อ 1 ได้
3. **เขียน webhook ระดับพื้นฐาน** — verify signature + ตอบข้อความพร้อมปุ่มจอง ใช้ค่าที่มีครบแล้ว ไม่ต้องรอ Supabase
