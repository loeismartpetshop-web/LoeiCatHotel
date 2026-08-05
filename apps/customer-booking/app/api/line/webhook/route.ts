import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LineWebhookEvent {
  type?: string;
  replyToken?: string;
  webhookEventId?: string;
  source?: { userId?: string };
  postback?: { data?: string };
}

interface BookingRow {
  booking_id: string;
  booking_code: string;
  customer_id: string;
  status: string;
  total_amount: number;
  customer_notes: string | null;
}

interface CustomerRow { line_user_id: string | null }

function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
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
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 500)}`);
  return (body ? JSON.parse(body) : null) as T;
}

function hasValidSignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("base64"));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function replyText(replyToken: string | undefined, text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!replyToken || !accessToken) return;
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] })
  });
  if (!response.ok) throw new Error(`LINE reply failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

function appendPaymentChoice(notes: string | null): string {
  const marker = "การชำระ: ชำระเต็มจำนวนวันเช็กอิน (ยืนยันผ่าน LINE)";
  if (notes?.includes(marker)) return notes;
  return notes ? `${notes}; ${marker}` : marker;
}

async function handlePaymentConfirmation(event: LineWebhookEvent, bookingCode: string): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const bookings = await supabaseRequest<BookingRow[]>(
    `bookings?select=booking_id,booking_code,customer_id,status,total_amount,customer_notes&booking_code=eq.${encodeURIComponent(bookingCode)}&limit=1`
  );
  const booking = bookings[0];
  if (!booking) {
    await replyText(event.replyToken, `ไม่พบรหัสคำขอ ${bookingCode} กรุณาติดต่อพนักงานค่ะ`);
    return;
  }

  const customers = await supabaseRequest<CustomerRow[]>(
    `customers?select=line_user_id&customer_id=eq.${encodeURIComponent(booking.customer_id)}&limit=1`
  );
  if (customers[0]?.line_user_id !== lineUserId) {
    await replyText(event.replyToken, "บัญชี LINE นี้ไม่ตรงกับผู้ส่งคำขอจอง กรุณาติดต่อพนักงานค่ะ");
    return;
  }

  if (["cancelled", "expired", "checked_out"].includes(booking.status)) {
    await replyText(event.replyToken, `คำขอ ${bookingCode} อยู่ในสถานะที่ยืนยันไม่ได้แล้ว กรุณาติดต่อพนักงานค่ะ`);
    return;
  }

  const alreadyConfirmed = booking.customer_notes?.includes("การชำระ: ชำระเต็มจำนวนวันเช็กอิน (ยืนยันผ่าน LINE)") ?? false;
  if (!alreadyConfirmed) {
    await supabaseRequest(`bookings?booking_id=eq.${encodeURIComponent(booking.booking_id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        deposit_amount: 0,
        balance_amount: booking.total_amount,
        deposit_due_at: null,
        customer_notes: appendPaymentChoice(booking.customer_notes),
        updated_at: new Date().toISOString()
      })
    });
    await supabaseRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        previous_status: booking.status,
        next_status: booking.status,
        reason: "ลูกค้ายืนยันคำขอจองและเลือกชำระเต็มจำนวนวันเช็กอินผ่าน LINE",
        actor_type: "customer"
      })
    });
  }

  const amount = Number(booking.total_amount).toLocaleString("th-TH");
  await replyText(
    event.replyToken,
    alreadyConfirmed
      ? `รับการยืนยันคำขอ ${bookingCode} ไว้แล้วค่ะ รอพนักงานตรวจสอบห้องว่างนะคะ`
      : `รับการยืนยันคำขอ ${bookingCode} แล้วค่ะ เลือกชำระ ${amount} บาทในวันเช็กอิน รอพนักงานตรวจสอบห้องว่างนะคะ`
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!hasValidSignature(body, request.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };
    for (const event of payload.events ?? []) {
      if (event.type !== "postback" || !event.postback?.data) continue;
      const data = new URLSearchParams(event.postback.data);
      if (data.get("action") !== "confirm_pay_checkin") continue;
      const bookingCode = data.get("booking_code")?.trim();
      if (bookingCode) await handlePaymentConfirmation(event, bookingCode);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook processing failed", error);
    return NextResponse.json({ ok: true });
  }
}
