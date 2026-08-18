# คู่มือเชื่อมต่อ LINE OA — LOEI CAT HOTEL

Document Type: Setup / Integration Runbook
Version: 1.0
อัปเดต: 5 สิงหาคม 2026

อ่านคู่กับ `docs/07_LINE_OA_AI_SPEC.md` (สเปกฟีเจอร์) — ไฟล์นี้คือ **ขั้นตอนลงมือทำจริง**

---

## 0. สถานะปัจจุบัน

| รายการ | สถานะ |
|---|---|
| LINE OA `@002lffmk` | มีแล้ว |
| Provider `LOEI CAT HOTEL` | **สร้างแล้ว** |
| Messaging API channel `LOEI CAT HOTEL` | **สร้างแล้ว** |
| LINE Login channel `Login Cat Hotel` | **สร้างแล้ว** (สถานะ Developing) |
| LIFF app `หน้าร้าน` (`2010982713-…`) | **สร้างแล้ว** |
| เว็บลูกค้า `https://loeicathotel.vercel.app` | **ออนไลน์แล้ว** |
| LIFF Endpoint URL | **ตั้งแล้ว** |
| ค่าทั้ง 4 เข้า `.env` | **ครบแล้ว** |
| ผูก OA เข้ากับ LINE Login channel | ต้องยืนยัน |
| Bot link feature ใน LIFF | ต้องยืนยัน |
| ตั้งค่า Response settings ใน OA Manager | ยังไม่ได้ทำ |
| Webhook endpoint | **รอ deploy `services/booking-api`** |
| Rich Menu | ยังไม่ได้ทำ |
| Publish `Login Cat Hotel` | ทำก่อนเปิดใช้จริง |

ต้องได้ 4 ค่านี้เข้า `.env` ให้ครบ: `PUBLIC_LINE_LIFF_ID`, `LINE_LOGIN_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`

### อย่าสับสน: Endpoint URL vs Webhook URL

| | LIFF Endpoint URL | Webhook URL |
|---|---|---|
| อยู่ที่ | Login Cat Hotel → LIFF | LOEI CAT HOTEL → Messaging API |
| คืออะไร | หน้าเว็บที่เปิดในแอป LINE | API รับ event จาก LINE |
| ใครเรียก | ลูกค้า (GET) | เซิร์ฟเวอร์ LINE (POST) |
| ต้องตอบ | HTML | `200` + verify signature |
| ค่าปัจจุบัน | `https://loeicathotel.vercel.app/` | **เว้นว่างไว้ก่อน** |

**ห้ามใส่ค่าเดียวกันทั้งสองช่อง** — ถ้าชี้ Webhook ไปที่หน้าเว็บ ข้อความที่ลูกค้าทักมาจะหายไปทั้งหมด

### โครงสร้างที่ใช้

```
Provider: LOEI CAT HOTEL
├── LOEI CAT HOTEL   (Messaging API)  → webhook / push / rich menu
└── Login Cat Hotel  (LINE Login)     → ใส่ LIFF app ได้หลายตัว
```

**Provider เดียวเท่านั้น** — LIFF ไม่ใช่ channel แต่เป็นของที่อยู่ข้างใน LINE Login channel

เหตุผลที่ห้ามแยก provider:

- `userId` เท่ากันเฉพาะภายใน provider เดียวกัน ข้าม provider = คนเดียวกันได้ ID คนละค่า → push ยืนยันการจองไปหาลูกค้าไม่ได้
- ผูก OA เข้ากับ LINE Login channel ข้าม provider **ไม่ได้** (LINE บังคับว่า Messaging API channel ต้องอยู่ provider เดียวกัน)
- ย้าย channel ข้าม provider ทีหลังไม่ได้ ต้องสร้างใหม่หมด

---

## 1. ทำได้เลยตอนนี้ (ไม่ต้องรอ URL)

### 1.1 ผูก OA เข้ากับ LINE Login channel

`Login Cat Hotel` → **Basic settings** → **Linked LINE Official Account** → Edit → เลือก `LOEI CAT HOTEL`

ถ้าเลือกได้ = ยืนยันว่า provider ตรงกันจริง ถ้าไม่ขึ้นในลิสต์ แปลว่ามีอะไรผิด ต้องแก้ก่อนทำต่อ

### 1.2 เก็บ secret และ token

Messaging API channel `LOEI CAT HOTEL`:

- แท็บ **Basic settings** → `Channel secret` → `LINE_CHANNEL_SECRET`
- แท็บ **Messaging API** → Issue `Channel access token (long-lived)` → `LINE_CHANNEL_ACCESS_TOKEN`

ทั้งสองค่าเป็น **server-side เท่านั้น** ห้ามเข้า frontend bundle หรือ commit เข้า git

### 1.3 ตั้งค่า OA Manager

https://manager.line.biz/ → `@002lffmk` → Settings → Response settings:

| ตัวเลือก | ตั้งเป็น | เหตุผล |
|---|---|---|
| Auto-response | **ปิด** | ไม่งั้นบอทสำเร็จรูปตอบทับ AI ของเรา |
| Greeting message | เปิด | แก้ข้อความเป็นแนะนำโรงแรม |
| Webhooks | **เปิด** | ต้องเปิดก่อนถึงจะรับ event ได้ |

### 1.4 ตั้ง scope ของ LINE Login

`Login Cat Hotel` → **LINE Login** tab → Scopes: เลือก `profile`, `openid` (ยังไม่ต้อง `email`)

### 1.5 ตัดสินใจแพ็กเกจ OA

เลือกแพ็กเกจตามโควตา push ต่อเดือน — ผูกกับข้อ 6 โดยตรง ถ้าโควตาน้อยต้องระวังไม่ให้มี push เกินที่จำเป็น

---

## 2. รอก่อน (ติด dependency)

| งาน | ติดอะไร |
|---|---|
| สร้าง LIFF app | ต้องมี HTTPS URL ของ `apps/customer-booking` |
| ตั้ง Webhook URL | ต้อง deploy `services/booking-api` ก่อน |
| Publish `Login Cat Hotel` | ทำตอนใกล้เปิดใช้จริง |

**หมายเหตุเรื่องสถานะ Developing:** ตอนนี้ `Login Cat Hotel` เป็น Developing ใช้ได้เฉพาะคนที่เป็น admin/tester ของ channel — ทดสอบได้ปกติ แต่ **ต้องกด Publish ก่อนเปิดให้ลูกค้าจริง** ไม่งั้นลูกค้าเข้า LIFF ไม่ได้

---

## 3. สร้าง LIFF app (เมื่อมี URL แล้ว)

LIFF คือหน้าเว็บจองที่เปิดในแอป LINE — คือ `apps/customer-booking` ของเรา

`Login Cat Hotel` → แท็บ **LIFF** → Add

- LIFF app name: `จองห้องพัก`
- Size: **Full**
- Endpoint URL: URL ของ `apps/customer-booking`
- Scopes: `profile`, `openid`
- Bot link feature: **On (Aggressive)** → เลือก `LOEI CAT HOTEL`

คัดลอก **LIFF ID** → `PUBLIC_LINE_LIFF_ID`

> Endpoint URL ต้องเป็น **HTTPS เท่านั้น** localhost ใช้ไม่ได้ และ **แก้ทีหลังได้ตลอด** — ไม่ต้องรอ URL production ตัวจริงถึงจะสร้าง LIFF ได้

**ข้อควรระวังเรื่อง permanent link:** ถ้า URL ของหน้าที่เปิดอยู่ไม่ได้ขึ้นต้นด้วย Endpoint URL ที่ลงทะเบียนไว้ ฟีเจอร์แชร์ลิงก์ของ LIFF จะพัง — ตอนย้าย domain ต้องอัปเดตค่านี้ด้วยเสมอ

**สถานะ deploy ปัจจุบัน:** `apps/customer-booking` ตั้งค่าไว้สำหรับ **Cloudflare Workers** (`vinext` + `@cloudflare/vite-plugin` + `wrangler`) และมี `.openai/hosting.json` ที่ codex ใช้อยู่ ถ้าจะย้ายไป Vercel ต้องถอด Cloudflare plugin และตั้ง build config ใหม่ — ยังไม่ได้ตัดสินใจ

---

## 4. โค้ดฝั่ง LIFF (customer-booking)

```bash
pnpm --filter customer-booking add @line/liff
```

```ts
// apps/customer-booking/lib/liff.ts
import liff from '@line/liff';

export async function initLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID! });

  // เปิดนอก LINE (เช่น ทดสอบบน desktop) ให้ทำงานต่อได้ ไม่บังคับ login
  if (!liff.isInClient()) return { lineUserId: null, displayName: null };

  if (!liff.isLoggedIn()) {
    liff.login();
    return { lineUserId: null, displayName: null };
  }

  const profile = await liff.getProfile();
  return { lineUserId: profile.userId, displayName: profile.displayName };
}

// ปุ่ม "กลับไป LINE OA" ตาม HANDOFF ข้อ 14 — ฟรี ไม่ต้อง push
export function backToLine() {
  if (liff.isInClient()) liff.closeWindow();
  else window.location.href = 'https://line.me/R/ti/p/@002lffmk';
}
```

**ห้ามเชื่อ `lineUserId` จาก client ตรง ๆ** ตอนสร้าง booking ให้ส่ง `liff.getIDToken()` ไปให้ server verify ที่ `https://api.line.me/oauth2/v2.1/verify` ก่อนผูกกับ record (สอดคล้อง guardrail ใน 07 และ 08)

---

## 5. Webhook (Messaging API → server)

ตั้ง Webhook URL ที่แท็บ Messaging API เช่น `https://api.loeicathotel.com/line/webhook` แล้วกด Verify

ต้อง validate signature ทุก request ไม่งั้นใครก็ยิงปลอมได้:

```ts
// services/booking-api/src/line/webhook.ts
import crypto from 'node:crypto';

export function verifyLineSignature(rawBody: string, signature: string) {
  const expected = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
    .update(rawBody)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

ข้อควรระวัง: ต้องอ่าน **raw body** ก่อน JSON parse ไม่งั้น signature ไม่ตรง และต้องตอบ `200` ภายใน ~1 วินาที — งานหนักให้โยนเข้า queue

Event ที่ต้องรับขั้นต่ำ: `follow` (บันทึก userId), `unfollow` (ทำ opt-out), `message` (route เข้า AI intent ตาม 07), `postback` (ปุ่ม Rich Menu)

---

## 6. Push Message ยืนยันการจอง (1 ครั้งเท่านั้น)

ตาม HANDOFF ข้อ 12 — ส่งเฉพาะตอน **พนักงานกดยืนยัน** และต้องกันซ้ำด้วย idempotency key

```sql
-- database: กันซ้ำระดับ DB ไม่ใช่แค่ระดับโค้ด
create table line_message_log (
  idempotency_key text primary key,   -- เช่น 'booking_confirmed:BK-2026-0001'
  booking_id uuid not null,
  event_type text not null,
  line_user_id text not null,
  sent_at timestamptz not null default now(),
  line_response jsonb
);
```

```ts
async function pushBookingConfirmed(booking) {
  const key = `booking_confirmed:${booking.code}`;
  const { error } = await db.from('line_message_log').insert({
    idempotency_key: key, booking_id: booking.id,
    event_type: 'booking_confirmed', line_user_id: booking.line_user_id,
  });
  if (error?.code === '23505') return; // ส่งไปแล้ว ข้าม

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': crypto.randomUUID(), // กันซ้ำฝั่ง LINE ตอน retry
    },
    body: JSON.stringify({ to: booking.line_user_id, messages: [flexConfirm(booking)] }),
  });
}
```

**เรื่องค่าใช้จ่าย:** Push message มีโควตาตามแพ็กเกจ OA แต่ **Reply message ฟรีไม่จำกัด** — ทุกครั้งที่ลูกค้าทักมา ให้ตอบด้วย reply API (ใช้ `replyToken` อายุ ~1 นาที) อย่าใช้ push

---

## 7. Rich Menu

6 ปุ่มตาม 07 — แนะนำ layout 2×3 ขนาด 2500×1686 px

| ปุ่ม | Action | ค่า |
|---|---|---|
| จองห้องพัก | URI | `https://liff.line.me/{LIFF_ID}` |
| ตรวจสอบการจอง | Postback | `action=booking_status` |
| ส่งเอกสารสุขภาพ | URI | `https://liff.line.me/{LIFF_ID}?to=/health-upload` |
| ราคาและประเภทห้อง | Postback | `action=explain_room` |
| ติดต่อทีมงาน | Postback | `action=speak_to_staff` |
| แผนที่โรงแรม | URI | Google Maps link |

ทำได้ 2 ทาง:

- **OA Manager** (ไม่ต้องเขียนโค้ด) — Home → Rich menus → อัปโหลดรูป ลากกรอบ ตั้ง action ทำได้เฉพาะ URI/ข้อความ
- **Messaging API** (`POST /v2/bot/richmenu` → upload image → `/v2/bot/user/all/richmenu/{id}`) — จำเป็นถ้าจะใช้ **postback** หรือสลับเมนูตามสถานะลูกค้า

แนะนำใช้ OA Manager ไปก่อนใน MVP แล้วย้ายมา API ตอน Phase 4

---

## 8. ลำดับที่ควรทำ

1. Provider + Messaging API channel → ได้ secret/token ครบ (30 นาที)
2. Deploy `apps/customer-booking` ขึ้น HTTPS จริง → ได้ Endpoint URL
3. LINE Login channel + LIFF → ได้ LIFF ID
4. ต่อ `liff.init` + ปุ่มกลับ LINE ในหน้าจอง
5. Webhook + signature validation
6. Rich Menu ผ่าน OA Manager
7. Push ยืนยัน + `line_message_log`
8. ทดสอบบนมือถือจริง iOS/Android ใน LINE in-app browser

ข้อ 1–3 ทำได้เลยตอนนี้แบบไม่ต้องรอ Supabase หรือ codex ทำหน้าเว็บเสร็จ (ยกเว้นข้อ 2 ที่ต้องมี URL)

---

## 9. จุดที่พังบ่อย

- Endpoint URL ไม่ใช่ HTTPS → LIFF ไม่ยอมบันทึก
- Messaging API กับ LINE Login อยู่คนละ Provider → ผูก userId ไม่ได้ ย้ายไม่ได้ ต้องสร้างใหม่
- Verify webhook ก่อน deploy server → กด Verify ไม่ผ่าน
- JSON parse ก่อนคำนวณ signature → validate ไม่ผ่านทุกครั้ง
- ลืมปิด Auto-response ใน OA Manager → บอทตอบทับ AI
- `replyToken` หมดอายุแล้วยัง reply → เสียเงินไปใช้ push แทนโดยไม่จำเป็น
- Push ซ้ำเพราะ retry → ต้องมีทั้ง `X-Line-Retry-Key` และ unique key ใน DB
- Token/secret หลุดเข้า frontend bundle → มีแค่ `PUBLIC_LINE_LIFF_ID` เท่านั้นที่เปิดเผยได้

---

## 10. สิ่งที่ยังต้องตัดสินใจ

- แพ็กเกจ LINE OA (โควตา push ต่อเดือน) — ผูกกับข้อ 6
- ใช้ LINE Login อย่างเดียว หรือเพิ่ม OTP เบอร์โทร (ค้างอยู่ใน `10_DECISIONS_REQUIRED.md`)
- ใครถือ LINE account เจ้าของ Provider — ถ้าเป็นบัญชีส่วนตัวพนักงาน จะมีปัญหาตอนคนลาออก
