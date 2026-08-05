import { calculateDeposit, calculateQuote, type RatePlanCode } from "@loei-cat-hotel/domain";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BookingMode = "overnight" | "hourly";
type RoomType = "villa" | "condo";

interface BookingRequest {
  idempotencyKey: string;
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
  petNames: string[];
  clinicName?: string;
  clinicPhone?: string;
  emergencyConsent: boolean;
  careFlags: string[];
  termsAccepted: boolean;
}

interface CustomerRow { customer_id: string }
interface PetRow { pet_id: string }
interface BookingRow { booking_id: string; booking_code: string; status: string }

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

async function removeRows(table: string, column: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await supabaseRequest(`${table}?${column}=in.(${ids.join(",")})`, { method: "DELETE" });
  } catch (error) {
    console.error(`Cleanup failed for ${table}`, error);
  }
}

function validateRequest(input: BookingRequest) {
  if (!input || typeof input !== "object") throw new PublicError("ข้อมูลคำขอไม่ถูกต้อง");
  const idempotencyKey = requireText(input.idempotencyKey, "รหัสคำขอ", 128);
  if (!/^[a-zA-Z0-9-]{16,128}$/.test(idempotencyKey)) throw new PublicError("รหัสคำขอไม่ถูกต้อง");

  const guardianName = requireText(input.guardianName, "ชื่อผู้ปกครอง");
  const phone = requireText(input.phone, "เบอร์โทรศัพท์", 20).replaceAll(/[-\s]/g, "");
  if (!/^0\d{8,9}$/.test(phone)) throw new PublicError("เบอร์โทรศัพท์ไม่ถูกต้อง");
  if (!Number.isInteger(input.petCount) || input.petCount < 1 || input.petCount > 4) {
    throw new PublicError("จำนวนแมวต้องอยู่ระหว่าง 1–4 ตัว");
  }
  if (!Array.isArray(input.petNames) || input.petNames.length !== input.petCount) {
    throw new PublicError("ข้อมูลชื่อแมวไม่ครบ");
  }
  const petNames = input.petNames.map((name) => requireText(name, "ชื่อแมว", 80));
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
    guardianName,
    phone,
    petNames,
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
    const existing = await supabaseRequest<BookingRow[]>(
      `bookings?select=booking_id,booking_code,status&idempotency_key=eq.${encodeURIComponent(input.idempotencyKey)}&limit=1`
    );
    if (existing[0]) {
      return NextResponse.json({ bookingCode: existing[0].booking_code, status: existing[0].status, duplicate: true });
    }

    const customers = await supabaseRequest<CustomerRow[]>("customers", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        full_name: input.guardianName,
        phone: input.phone,
        acquisition_source: "web",
        privacy_consent_at: new Date().toISOString()
      })
    });
    const customer = customers[0];
    if (!customer) throw new Error("Customer insert returned no row");
    created.customerId = customer.customer_id;

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

    const bookingCode = createBookingCode();
    const bookings = await supabaseRequest<BookingRow[]>("bookings", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        booking_code: bookingCode,
        customer_id: customer.customer_id,
        status: "draft",
        source: "web",
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
        customer_notes: `ห้องที่เลือก: ${input.roomType}; การดูแล: ${input.careFlags.join(", ") || "ไม่มี"}`,
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

    await supabaseRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        previous_status: null,
        next_status: "draft",
        reason: "ลูกค้าส่งคำขอผ่านหน้าเว็บ",
        actor_type: "customer"
      })
    });

    return NextResponse.json({ bookingCode: booking.booking_code, status: booking.status }, { status: 201 });
  } catch (error) {
    if (created.bookingId) {
      await removeRows("booking_status_history", "booking_id", [created.bookingId]);
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
