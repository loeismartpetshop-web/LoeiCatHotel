import { calculateDeposit, calculateQuote, type RatePlanCode } from "@loei-cat-hotel/domain";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BookingMode = "overnight" | "hourly";
type RoomType = "villa" | "condo";

interface BookingRequest {
  idempotencyKey: string;
  lineIdToken?: string;
  mode: BookingMode;
  checkInDate?: string;
  checkOutDate?: string;
  visitDate?: string;
  startTime?: string;
  endTime?: string;
  petCount: number;
  roomType: RoomType;
  ratePlan: RatePlanCode;
  guardianName: string;
  phone: string;
  miHomeAppId?: string;
  petNames: string[];
  petPhotos?: string[];
  clinicName?: string;
  clinicPhone?: string;
  emergencyConsent: boolean;
  careFlags: string[];
  termsAccepted: boolean;
}

interface CustomerRow { customer_id: string }
interface PetRow { pet_id: string }
interface BookingRow { booking_id: string; booking_code: string; status: string }
interface LineIdentity { userId: string; displayName: string | null }

class PublicError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new PublicError("ระบบฐานข้อมูลยังตั้งค่าไม่ครบ กรุณาติดต่อโรงแรม", 503);
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}
function isMissingMiHomeColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("mihome_app_id") && /PGRST204|schema cache|does not exist/i.test(message);
}

async function customerRequest<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await supabaseRequest<T>(path, init);
  } catch (error) {
    if (!isMissingMiHomeColumn(error) || typeof init.body !== "string") throw error;
    const payload = JSON.parse(init.body) as Record<string, unknown>;
    delete payload.mihome_app_id;
    console.warn("Supabase mihome_app_id migration is pending; preserving the ID in booking notes");
    return supabaseRequest<T>(path, {
      ...init,
      body: JSON.stringify(payload)
    });
  }
}



function requireText(value: unknown, label: string, maximumLength = 160): string {
  if (typeof value !== "string" || !value.trim()) throw new PublicError(`กรุณากรอก${label}`);
  const clean = value.trim();
  if (clean.length > maximumLength) throw new PublicError(`${label}ยาวเกินกำหนด`);
  return clean;
}

function requireDate(value: unknown, label: string): string {
  const date = requireText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00+07:00`).getTime())) {
    throw new PublicError(`${label}ไม่ถูกต้อง`);
  }
  return date;
}

function requireTime(value: unknown, label: string): string {
  const time = requireText(value, label, 5);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new PublicError(`${label}ไม่ถูกต้อง`);
  return time;
}

function countNights(checkInDate: string, checkOutDate: string): number {
  const start = new Date(`${checkInDate}T00:00:00+07:00`).getTime();
  const end = new Date(`${checkOutDate}T00:00:00+07:00`).getTime();
  const nights = Math.round((end - start) / 86_400_000);
  if (!Number.isInteger(nights) || nights < 1 || nights > 90) throw new PublicError("ช่วงวันเข้าพักไม่ถูกต้อง");
  return nights;
}

function createBookingCode(): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()).replaceAll("-", "");
  return `BK-${date}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

async function verifyLineIdToken(idToken: string | undefined): Promise<LineIdentity | null> {
  if (!idToken) return null;
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new PublicError("ระบบ LINE ยังตั้งค่าไม่ครบ กรุณาติดต่อโรงแรม", 503);

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId })
  });
  const payload = await response.json() as { sub?: string; name?: string; error_description?: string };
  if (!response.ok || !payload.sub?.startsWith("U")) {
    console.warn("LINE ID token verification failed", payload.error_description ?? response.status);
    throw new PublicError("ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาปิดแล้วเปิดหน้าจองจาก LINE OA อีกครั้ง", 401);
  }
  return { userId: payload.sub, displayName: payload.name?.trim() || null };
}

function formatLineDateTime(value: string): string {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric"
  }).format(date);
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date);
  return `${day} · ${time} น.`;
}

function flexDetailRow(label: string, value: string) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: "#8B7B86", flex: 3 },
      { type: "text", text: value, size: "sm", color: "#2C1826", weight: "bold", align: "end", wrap: true, flex: 7 }
    ]
  };
}

async function sendLineBookingReceipt(
  lineUserId: string,
  bookingId: string,
  bookingCode: string,
  input: ReturnType<typeof validateRequest>
): Promise<boolean> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) return false;

  const deposit = input.depositAmount.toLocaleString("th-TH");

  const room = input.roomType === "condo" ? "ห้องคอนโด" : "ห้องวิลล่า";
  const packageName = input.ratePlan === "HOTEL_SUPPLIED"
    ? "โรงแรมจัดเตรียมให้"
    : input.ratePlan === "OWNER_SUPPLIED" ? "นำอาหารและทรายมาเอง" : "ฝากรายชั่วโมง";


  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": bookingId
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{
        type: "flex",
        altText: `ใบรับคำขอจอง ${bookingCode} · มัดจำ ${deposit} บาท`,
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F8C8E8",
            paddingAll: "16px",
            contents: [
              { type: "text", text: "LOEI CAT HOTEL", weight: "bold", color: "#3D1632", size: "lg" },
              { type: "text", text: "ใบรับคำขอจอง · รอตรวจสอบ", color: "#6E365C", size: "sm", margin: "xs" }
            ]
          },
          body: {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            spacing: "md",
            contents: [
              { type: "text", text: "รับคำขอจองแล้ว ✓", weight: "bold", size: "lg", color: "#2C1826", align: "center" },
              { type: "text", text: bookingCode, weight: "bold", size: "xl", color: "#7B315F", align: "center" },
              { type: "separator", color: "#E8DEE5", margin: "sm" },
              flexDetailRow("ผู้ปกครอง", input.guardianName),
              flexDetailRow("เบอร์โทร", input.phone),
              flexDetailRow("น้องแมว", input.petNames.join(", ")),
              flexDetailRow("จำนวน / ห้อง", `${input.petNames.length} ตัว · ${room}`),
              flexDetailRow("แพ็กเกจ", packageName),
              { type: "separator", color: "#E8DEE5", margin: "sm" },
              flexDetailRow("เข้าพัก", formatLineDateTime(input.checkInAt)),
              flexDetailRow("รับกลับ", formatLineDateTime(input.checkOutAt)),
              {
                type: "box", layout: "vertical", paddingAll: "14px", cornerRadius: "md", backgroundColor: "#F4E4EE", margin: "md",
                contents: [
                  { type: "text", text: "ยอดมัดจำ", size: "sm", color: "#7B315F", align: "center" },
                  { type: "text", text: `${deposit} บาท`, size: "xl", weight: "bold", color: "#7B315F", margin: "xs", align: "center" }
                ]
              },
              {
                type: "box", layout: "vertical", paddingAll: "12px", cornerRadius: "md", backgroundColor: "#F3F7F4", spacing: "xs",
                contents: [
                  { type: "text", text: "ชำระมัดจำผ่านพร้อมเพย์", size: "sm", weight: "bold", color: "#315B4B" },
                  { type: "text", text: "KPS004KB000002201754", size: "md", weight: "bold", color: "#173C30", wrap: true },
                  { type: "text", text: "บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด", size: "xs", color: "#61776E", wrap: true }
                ]
              },
              { type: "text", text: "โอนมัดจำแล้ว ส่งภาพสลิปในแชตนี้ จากนั้นกดปุ่มยืนยันมัดจำด้านล่าง", size: "sm", color: "#8B7B86", wrap: true }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            spacing: "sm",
            contents: [
              { type: "button", style: "primary", color: "#7B315F", height: "sm", action: {
                type: "postback", label: "ยืนยันมัดจำ",
                data: `action=confirm_deposit&booking_code=${encodeURIComponent(bookingCode)}`,
                displayText: `แจ้งโอนมัดจำ ${bookingCode} แล้ว`
              } }
            ]
          }
        }
      }]
    })
  });
  if (response.ok || response.status === 409) return true;
  console.error("LINE receipt push failed", response.status, (await response.text()).slice(0, 500));
  return false;
}
async function removeRows(table: string, column: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await supabaseRequest(`${table}?${column}=in.(${ids.join(",")})`, { method: "DELETE" });
  } catch (error) {
    console.error(`Cleanup failed for ${table}`, error);
  }
}

const PET_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PET_PHOTO_MIME_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png"
};

interface PetPhotoUpload {
  contentType: string;
  extension: string;
  bytes: ArrayBuffer;
}

// รูปน้องแมวส่งมาเป็น data URL จากหน้าจอง (แปลงเป็น WebP ในเครื่องลูกค้าแล้ว)
// ตรวจชนิดไฟล์และขนาดที่นี่อีกชั้น เพราะ client ปลอมค่าได้
function sanitizePetPhoto(value: unknown): PetPhotoUpload | null {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return null;
  const match = value.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const contentType = match[1]!;
  const extension = PET_PHOTO_MIME_EXTENSIONS[contentType];
  if (!extension) return null;
  const buffer = Buffer.from(match[2]!, "base64");
  if (!buffer.byteLength || buffer.byteLength > PET_PHOTO_MAX_BYTES) return null;
  // คัดลอกเป็น ArrayBuffer ตรงๆ เพื่อให้ส่งเป็น body ของ fetch ได้ตามชนิดที่ TypeScript ต้องการ
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  return { contentType, extension, bytes };
}

async function savePetPhoto(petId: string, photo: PetPhotoUpload): Promise<void> {
  const { url, key } = getSupabaseConfig();
  const objectPath = `${petId}/${Date.now()}.${photo.extension}`;
  const upload = await fetch(`${url}/storage/v1/object/pet-photos/${objectPath}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": photo.contentType,
      "x-upsert": "true"
    },
    body: photo.bytes
  });
  if (!upload.ok) throw new Error(`Storage ${upload.status}: ${(await upload.text()).slice(0, 200)}`);
  await supabaseRequest(`pets?pet_id=eq.${encodeURIComponent(petId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ photo_path: objectPath, photo_updated_at: new Date().toISOString() })
  });
}

function validateRequest(input: BookingRequest) {
  if (!input || typeof input !== "object") throw new PublicError("ข้อมูลคำขอไม่ถูกต้อง");
  const idempotencyKey = requireText(input.idempotencyKey, "รหัสคำขอ", 128);
  if (!/^[a-zA-Z0-9-]{16,128}$/.test(idempotencyKey)) throw new PublicError("รหัสคำขอไม่ถูกต้อง");

  const guardianName = requireText(input.guardianName, "ชื่อผู้ปกครอง");
  const phone = requireText(input.phone, "เบอร์โทรศัพท์", 10);
  if (!/^0\d{9}$/.test(phone)) throw new PublicError("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 ตัวและขึ้นต้นด้วย 0");
  const miHomeAppId = typeof input.miHomeAppId === "string" ? input.miHomeAppId.trim().slice(0, 120) : "";
  if (!Number.isInteger(input.petCount) || input.petCount < 1 || input.petCount > 4) {
    throw new PublicError("จำนวนแมวต้องอยู่ระหว่าง 1–4 ตัว");
  }
  if (!Array.isArray(input.petNames) || input.petNames.length !== input.petCount) {
    throw new PublicError("ข้อมูลชื่อแมวไม่ครบ");
  }
  const petNames = input.petNames.map((name) => requireText(name, "ชื่อแมว", 80));
  const petPhotos = Array.isArray(input.petPhotos)
    ? petNames.map((_, index) => sanitizePetPhoto(input.petPhotos?.[index]))
    : petNames.map(() => null);
  if (input.roomType !== "villa" && input.roomType !== "condo") throw new PublicError("ประเภทห้องไม่ถูกต้อง");
  if (input.mode !== "overnight" && input.mode !== "hourly") throw new PublicError("รูปแบบการเข้าพักไม่ถูกต้อง");
  if (!input.termsAccepted) throw new PublicError("กรุณายินยอมให้จัดเก็บข้อมูลเพื่อดำเนินคำขอจอง");

  let checkInAt: string;
  let checkOutAt: string;
  let nights = 1;
  let ratePlan: RatePlanCode;
  if (input.mode === "hourly") {
    const visitDate = requireDate(input.visitDate, "วันที่ฝาก");
    const startTime = requireTime(input.startTime, "เวลาเริ่ม");
    const endTime = requireTime(input.endTime, "เวลารับกลับ");
    checkInAt = new Date(`${visitDate}T${startTime}:00+07:00`).toISOString();
    checkOutAt = new Date(`${visitDate}T${endTime}:00+07:00`).toISOString();
    const durationMinutes = (new Date(checkOutAt).getTime() - new Date(checkInAt).getTime()) / 60_000;
    if (durationMinutes <= 0 || durationMinutes > 360) throw new PublicError("ฝากรายชั่วโมงต้องมากกว่า 0 และไม่เกิน 6 ชั่วโมง");
    ratePlan = "HOURLY";
  } else {
    const checkInDate = requireDate(input.checkInDate, "วันเข้าพัก");
    const checkOutDate = requireDate(input.checkOutDate, "วันรับกลับ");
    nights = countNights(checkInDate, checkOutDate);
    checkInAt = new Date(`${checkInDate}T08:30:00+07:00`).toISOString();
    checkOutAt = new Date(`${checkOutDate}T12:00:00+07:00`).toISOString();
    if (input.ratePlan !== "HOTEL_SUPPLIED" && input.ratePlan !== "OWNER_SUPPLIED") {
      throw new PublicError("แพ็กเกจไม่ถูกต้อง");
    }
    ratePlan = input.ratePlan;
  }

  const unitPrice = ratePlan === "HOURLY" ? 100 : ratePlan === "HOTEL_SUPPLIED" ? 250 : 150;
  const quantity = input.petCount * (ratePlan === "HOURLY" ? 1 : nights);
  const totalAmount = calculateQuote({ ratePlan, petCount: input.petCount, nights });
  const depositAmount = calculateDeposit(totalAmount);
  const careFlags = Array.isArray(input.careFlags)
    ? input.careFlags.filter((flag): flag is string => typeof flag === "string").slice(0, 12)
    : [];

  return {
    idempotencyKey,
    lineIdToken: typeof input.lineIdToken === "string" ? input.lineIdToken.slice(0, 4096) : undefined,
    guardianName,
    phone,
    miHomeAppId,
    petNames,
    petPhotos,
    roomType: input.roomType,
    checkInAt,
    checkOutAt,
    nights,
    ratePlan,
    unitPrice,
    quantity,
    totalAmount,
    depositAmount,
    clinicName: typeof input.clinicName === "string" ? input.clinicName.trim().slice(0, 160) : "",
    clinicPhone: typeof input.clinicPhone === "string" ? input.clinicPhone.trim().slice(0, 30) : "",
    emergencyConsent: Boolean(input.emergencyConsent),
    careFlags
  };
}

export async function GET() {
  try {
    await supabaseRequest<BookingRow[]>("bookings?select=booking_id&limit=0");
    return NextResponse.json({ ready: true });
  } catch (error) {
    console.error("Supabase health check failed", error);
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const created = { customerId: "", petIds: [] as string[], bookingId: "" };
  try {
    const input = validateRequest(await request.json() as BookingRequest);
    const lineIdentity = await verifyLineIdToken(input.lineIdToken);
    const existing = await supabaseRequest<BookingRow[]>(
      `bookings?select=booking_id,booking_code,status&idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&limit=1`
    );
    if (existing[0]) {
      return NextResponse.json({ bookingCode: existing[0].booking_code, status: existing[0].status, duplicate: true });
    }

    let customer: CustomerRow | undefined;
    if (lineIdentity) {
      const returningCustomers = await supabaseRequest<CustomerRow[]>(
        `customers?select=customer_id&line_user_id=eq.${encodeURIComponent(lineIdentity.userId)}&limit=1`
      );
      customer = returningCustomers[0];
      if (customer) {
        await customerRequest(`customers?customer_id=eq.${encodeURIComponent(customer.customer_id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            full_name: input.guardianName,
            phone: input.phone,
            mihome_app_id: input.miHomeAppId || null,
            line_display_name: lineIdentity.displayName,
            updated_at: new Date().toISOString()
          })
        });
      }
    }

    if (!customer) {
      const customers = await customerRequest<CustomerRow[]>("customers", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          full_name: input.guardianName,
          phone: input.phone,
          mihome_app_id: input.miHomeAppId || null,
          line_user_id: lineIdentity?.userId ?? null,
          line_display_name: lineIdentity?.displayName ?? null,
          acquisition_source: lineIdentity ? "line_oa" : "web",
          privacy_consent_at: new Date().toISOString()
        })
      });
      customer = customers[0];
      if (!customer) throw new Error("Customer insert returned no row");
      created.customerId = customer.customer_id;
    }

    const pets = await supabaseRequest<PetRow[]>("pets", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(input.petNames.map((petName) => ({
        customer_id: customer.customer_id,
        pet_name: petName,
        veterinarian_name: input.clinicName || null,
        veterinarian_phone: input.clinicPhone || null,
        care_notes: input.careFlags.length ? input.careFlags.join(", ") : null
      })))
    });
    if (pets.length !== input.petNames.length) throw new Error("Pet insert count mismatch");
    created.petIds = pets.map((pet) => pet.pet_id);

    // รูปน้องแมวเป็นข้อมูลเสริม ถ้าอัปโหลดไม่สำเร็จต้องไม่ทำให้การจองล้ม
    await Promise.all(pets.map(async (pet, index) => {
      const photo = input.petPhotos[index];
      if (!photo) return;
      try {
        await savePetPhoto(pet.pet_id, photo);
      } catch (photoError) {
        console.warn("Unable to save pet photo", pet.pet_id, photoError);
      }
    }));

    const bookingCode = createBookingCode();
    const bookings = await supabaseRequest<BookingRow[]>("bookings", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        booking_code: bookingCode,
        customer_id: customer.customer_id,
        status: "draft",
        source: lineIdentity ? "line_oa" : "web",
        check_in_at: input.checkInAt,
        check_out_at: input.checkOutAt,
        total_pets: input.petNames.length,
        rate_plan_code_snapshot: input.ratePlan,
        unit_price_snapshot: input.unitPrice,
        quantity_snapshot: input.quantity,
        total_amount: input.totalAmount,
        deposit_amount: input.depositAmount,
        balance_amount: input.totalAmount - input.depositAmount,
        deposit_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customer_notes: `ห้องที่เลือก: ${input.roomType}; การดูแล: ${input.careFlags.join(", ") || "ไม่มี"}; Mi Home ID: ${input.miHomeAppId || "ไม่ระบุ"}; การชำระ: มัดจำ 50% รอตรวจสอบสลิป`,
        idempotency_key: input.idempotencyKey
      })
    });
    const booking = bookings[0];
    if (!booking) throw new Error("Booking insert returned no row");
    created.bookingId = booking.booking_id;

    await supabaseRequest("booking_pets", {
      method: "POST",
      body: JSON.stringify(pets.map((pet) => ({
        booking_id: booking.booking_id,
        pet_id: pet.pet_id,
        care_notes_snapshot: input.careFlags.join(", ") || null
      })))
    });

    await supabaseRequest("emergency_consent", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        customer_id: customer.customer_id,
        has_regular_clinic: Boolean(input.clinicName),
        clinic_name: input.clinicName || null,
        clinic_phone: input.clinicPhone || null,
        allow_partner_clinic: input.emergencyConsent,
        consent_text_version: "booking-web-v1"
      })
    });

    await supabaseRequest("payments", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        payment_type: "deposit",
        amount: input.depositAmount,
        status: "pending",
        payment_method: "promptpay"
      })
    });

    await supabaseRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        previous_status: null,
        next_status: "draft",
        reason: "ลูกค้าส่งคำขอและได้รับข้อมูลชำระมัดจำผ่านหน้าเว็บ",
        actor_type: "customer"
      })
    });

    let lineMessageSent = false;
    if (lineIdentity) {
      try {
        lineMessageSent = await sendLineBookingReceipt(
          lineIdentity.userId,
          booking.booking_id,
          booking.booking_code,
          input
        );
      } catch (lineError) {
        console.error("Unable to send LINE confirmation button", lineError);
      }
    }

    return NextResponse.json({
      bookingCode: booking.booking_code,
      status: booking.status,
      lineConnected: Boolean(lineIdentity),
      lineMessageSent
    }, { status: 201 });
  } catch (error) {
    if (created.bookingId) {
      await removeRows("booking_status_history", "booking_id", [created.bookingId]);
      await removeRows("payments", "booking_id", [created.bookingId]);
      await removeRows("emergency_consent", "booking_id", [created.bookingId]);
      await removeRows("booking_pets", "booking_id", [created.bookingId]);
      await removeRows("bookings", "booking_id", [created.bookingId]);
    }
    await removeRows("pets", "pet_id", created.petIds);
    if (created.customerId) await removeRows("customers", "customer_id", [created.customerId]);

    if (error instanceof PublicError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Booking creation failed", error);
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่หรือติดต่อ LINE OA" }, { status: 500 });
  }
}
