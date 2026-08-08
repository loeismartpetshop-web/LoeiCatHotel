import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LineWebhookEvent {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  postback?: { data?: string };
}

interface BookingRow {
  booking_id: string;
  booking_code: string;
  customer_id: string;
  status: string;
  deposit_amount: number;
  balance_amount: number;
  customer_notes: string | null;
}

interface CustomerRow { line_user_id: string | null }
interface PaymentRow { payment_id?: string; status: string }

function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers }
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
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] })
  });
  if (!response.ok) throw new Error(`LINE reply failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

function appendDepositNotice(notes: string | null): string {
  const marker = "ลูกค้าแจ้งโอนมัดจำผ่าน LINE แล้ว รอพนักงานตรวจสลิป";
  if (notes?.includes(marker)) return notes;
  return notes?.trim() ? `${notes}; ${marker}` : marker;
}

async function handleDepositConfirmation(event: LineWebhookEvent, bookingCode: string): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const bookings = await supabaseRequest<BookingRow[]>(
    `bookings?select=booking_id,booking_code,customer_id,status,deposit_amount,customer_notes&booking_code=eq.${encodeURIComponent(bookingCode)}&limit=1`
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
  const payments = await supabaseRequest<PaymentRow[]>(
    `payments?select=status&booking_id=eq.${encodeURIComponent(booking.booking_id)}&payment_type=eq.deposit&limit=1`
  );
  if (payments[0]?.status === "paid" || booking.status === "confirmed") {
    await replyText(event.replyToken, `ยืนยันมัดจำ ${Number(booking.deposit_amount).toLocaleString("th-TH")} บาท สำหรับ ${bookingCode} แล้วค่ะ กรุณาใช้บิลยอดคงเหลือในวันเช็กอิน`);
    return;
  }
  const alreadyNotified = booking.customer_notes?.includes("ลูกค้าแจ้งโอนมัดจำผ่าน LINE แล้ว รอพนักงานตรวจสลิป") ?? false;
  if (!alreadyNotified) {
    await supabaseRequest(`bookings?booking_id=eq.${encodeURIComponent(booking.booking_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pending_deposit", customer_notes: appendDepositNotice(booking.customer_notes), updated_at: new Date().toISOString() })
    });
    await supabaseRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        previous_status: booking.status,
        next_status: "pending_deposit",
        reason: "ลูกค้าส่งสลิปในแชตและกดยืนยันมัดจำ รอพนักงานตรวจสอบ",
        actor_type: "customer"
      })
    });
  }
  await replyText(
    event.replyToken,
    alreadyNotified
      ? `รับแจ้งมัดจำของ ${bookingCode} ไว้แล้วค่ะ ขณะนี้รอพนักงานตรวจสลิป`
      : `รับแจ้งมัดจำ ${Number(booking.deposit_amount).toLocaleString("th-TH")} บาท สำหรับ ${bookingCode} แล้วค่ะ รอพนักงานตรวจสลิป เมื่อยืนยันแล้วระบบจะส่งบิลยอดคงเหลือให้อีกครั้ง`
  );
}

async function handleCheckinConfirmation(event: LineWebhookEvent, bookingCode: string): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const bookings = await supabaseRequest<BookingRow[]>(
    `bookings?select=booking_id,booking_code,customer_id,status,deposit_amount,balance_amount,customer_notes&booking_code=eq.${encodeURIComponent(bookingCode)}&limit=1`
  );
  const booking = bookings[0];
  if (!booking) {
    await replyText(event.replyToken, `ไม่พบรหัสการจอง ${bookingCode} กรุณาติดต่อพนักงานค่ะ`);
    return;
  }
  const customers = await supabaseRequest<CustomerRow[]>(
    `customers?select=line_user_id&customer_id=eq.${encodeURIComponent(booking.customer_id)}&limit=1`
  );
  if (customers[0]?.line_user_id !== lineUserId) {
    await replyText(event.replyToken, "บัญชี LINE นี้ไม่ตรงกับเจ้าของการจอง กรุณาติดต่อพนักงานค่ะ");
    return;
  }
  if (booking.status !== "confirmed") {
    await replyText(event.replyToken, `การจอง ${bookingCode} ยังไม่ผ่านการยืนยันมัดจำ กรุณารอบิลยืนยันจากพนักงานก่อนค่ะ`);
    return;
  }

  const now = new Date().toISOString();
  const balancePayments = await supabaseRequest<PaymentRow[]>(
    `payments?select=payment_id,status&booking_id=eq.${encodeURIComponent(booking.booking_id)}&payment_type=eq.balance&limit=1`
  );
  const balancePayment = balancePayments[0];
  if (balancePayment?.status !== "paid") {
    if (balancePayment?.payment_id) {
      await supabaseRequest(`payments?payment_id=eq.${encodeURIComponent(balancePayment.payment_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", paid_at: now, updated_at: now })
      });
    } else if (Number(booking.balance_amount) > 0) {
      await supabaseRequest("payments", {
        method: "POST",
        body: JSON.stringify({
          booking_id: booking.booking_id,
          payment_type: "balance",
          amount: booking.balance_amount,
          status: "paid",
          payment_method: "pay_at_checkin",
          paid_at: now
        })
      });
    }

    const marker = "ลูกค้ายืนยันชำระยอดคงเหลือวันเช็กอินแล้ว";
    const notes = booking.customer_notes?.includes(marker)
      ? booking.customer_notes
      : booking.customer_notes?.trim() ? `${booking.customer_notes}; ${marker}` : marker;
    await supabaseRequest(`bookings?booking_id=eq.${encodeURIComponent(booking.booking_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ customer_notes: notes, updated_at: now })
    });
    await supabaseRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: booking.booking_id,
        previous_status: booking.status,
        next_status: booking.status,
        reason: `ลูกค้ากดยืนยันชำระยอดคงเหลือ ${Number(booking.balance_amount).toLocaleString("th-TH")} บาทในวันเช็กอิน`,
        actor_type: "customer"
      })
    });
  }

  await replyText(
    event.replyToken,
    `ชำระเรียบร้อยแล้วค่ะ ${Number(booking.balance_amount).toLocaleString("th-TH")} บาท สำหรับ ${bookingCode} ขอบคุณค่ะ`
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
      const action = data.get("action");
      const bookingCode = data.get("booking_code")?.trim();
      if (!bookingCode) continue;
      if (action === "confirm_deposit") await handleDepositConfirmation(event, bookingCode);
      if (action === "confirm_checkin_payment") await handleCheckinConfirmation(event, bookingCode);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook processing failed", error);
    return NextResponse.json({ ok: true });
  }
}
