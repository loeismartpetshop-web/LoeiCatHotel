import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface AuthUser { id?: string }
interface StaffRow { auth_user_id: string; role: string; is_active: boolean }
interface BookingRow {
  booking_id: string;
  booking_code: string;
  customer_id: string;
  status: string;
  check_in_at: string;
  check_out_at: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
}
interface CustomerRow { full_name: string; phone: string; line_user_id: string | null }
interface PaymentRow { payment_id: string; amount: number; status: string }
interface MessageLogRow { idempotency_key: string }

function getConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !publishable) throw new Error("Supabase environment variables are missing");
  return { url: url.replace(/\/$/, ""), secret, publishable };
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init.headers }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function requireStaff(request: Request): Promise<string> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response("unauthorized", { status: 401 });
  const { url, publishable } = getConfig();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!userResponse.ok) throw new Response("unauthorized", { status: 401 });
  const user = await userResponse.json() as AuthUser;
  if (!user.id) throw new Response("unauthorized", { status: 401 });
  const staff = await adminRequest<StaffRow[]>(
    `staff_profiles?select=auth_user_id,role,is_active&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`
  );
  if (!staff[0] || !["owner", "front_desk"].includes(staff[0].role)) {
    throw new Response("forbidden", { status: 403 });
  }
  return user.id;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}

function detailRow(label: string, value: string) {
  return { type: "box", layout: "horizontal", spacing: "md", contents: [
    { type: "text", text: label, size: "sm", color: "#8B7B86", flex: 3 },
    { type: "text", text: value, size: "sm", color: "#2C1826", weight: "bold", align: "end", wrap: true, flex: 7 }
  ] };
}

async function pushCheckinReceipt(booking: BookingRow, customer: CustomerRow, paymentId: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken || !customer.line_user_id) throw new Error("LINE customer or access token is missing");
  const balance = Number(booking.balance_amount).toLocaleString("th-TH");


  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Line-Retry-Key": paymentId
    },
    body: JSON.stringify({
      to: customer.line_user_id,
      messages: [{
        type: "flex",
        altText: `ยืนยันมัดจำแล้ว ${booking.booking_code} · คงเหลือ ${balance} บาท`,
        contents: {
          type: "bubble",
          size: "mega",
          header: { type: "box", layout: "vertical", backgroundColor: "#F9EDF4", paddingAll: "16px", contents: [
            { type: "text", text: "LOEI CAT HOTEL", weight: "bold", color: "#493943", size: "lg" },
            { type: "text", text: "ยืนยันมัดจำแล้ว ✓", color: "#493943", size: "sm", margin: "xs" }
          ] },
          body: { type: "box", layout: "vertical", paddingAll: "16px", spacing: "md", contents: [
            { type: "text", text: booking.booking_code, weight: "bold", size: "xl", color: "#493943", align: "center" },
            detailRow("ผู้ปกครอง", customer.full_name),
            detailRow("เบอร์โทร", customer.phone),
            detailRow("เข้าพัก", formatDate(booking.check_in_at)),
            detailRow("รับกลับ", formatDate(booking.check_out_at)),
            { type: "separator", color: "#E8DEE5" },
            { type: "box", layout: "vertical", paddingAll: "14px", cornerRadius: "md", backgroundColor: "#F9EDF4", contents: [
              { type: "text", text: "ชำระวันเช็กอิน", size: "sm", color: "#493943", align: "center" },
              { type: "text", text: `${balance} บาท`, size: "xl", weight: "bold", color: "#493943", margin: "xs", align: "center" }
            ] },
            { type: "text", text: "เก็บบิลนี้ไว้ และกดปุ่มด้านล่างเมื่อมาถึงโรงแรมในวันเช็กอิน", size: "sm", color: "#8B7B86", wrap: true }
          ] },
          footer: { type: "box", layout: "vertical", paddingAll: "16px", contents: [
            { type: "button", style: "primary", color: "#493943", height: "sm", action: {
              type: "postback", label: "ชำระวันเช็กอิน",
              data: `action=confirm_checkin_payment&booking_code=${encodeURIComponent(booking.booking_code)}`,
              displayText: `มาถึงแล้ว ยืนยันชำระยอดคงเหลือ ${booking.booking_code}`
            } }
          ] }
        }
      }]
    })
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`LINE push failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
}

export async function POST(request: Request) {
  try {
    const staffUserId = await requireStaff(request);
    const body = await request.json() as { bookingCode?: string };
    const bookingCode = body.bookingCode?.trim();
    if (!bookingCode || !/^BK-[A-Z0-9-]+$/i.test(bookingCode)) {
      return NextResponse.json({ error: "invalid booking code" }, { status: 400 });
    }
    const bookings = await adminRequest<BookingRow[]>(
      `bookings?select=booking_id,booking_code,customer_id,status,check_in_at,check_out_at,total_amount,deposit_amount,balance_amount&booking_code=eq.${encodeURIComponent(bookingCode)}&limit=1`
    );
    const booking = bookings[0];
    if (!booking) return NextResponse.json({ error: "booking not found" }, { status: 404 });
    const customers = await adminRequest<CustomerRow[]>(
      `customers?select=full_name,phone,line_user_id&customer_id=eq.${encodeURIComponent(booking.customer_id)}&limit=1`
    );
    const customer = customers[0];
    if (!customer?.line_user_id) return NextResponse.json({ error: "customer LINE not found" }, { status: 409 });
    const payments = await adminRequest<PaymentRow[]>(
      `payments?select=payment_id,amount,status&booking_id=eq.${encodeURIComponent(booking.booking_id)}&payment_type=eq.deposit&limit=1`
    );
    const payment = payments[0];
    if (!payment) return NextResponse.json({ error: "deposit payment not found" }, { status: 404 });
    const alreadyPaid = payment.status === "paid";
    const now = new Date().toISOString();
    if (!alreadyPaid) {
      if (payment.status !== "pending") return NextResponse.json({ error: `payment is ${payment.status}` }, { status: 409 });
      await adminRequest(`payments?payment_id=eq.${encodeURIComponent(payment.payment_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", paid_at: now, verified_by: staffUserId, verified_at: now, updated_at: now })
      });
      await adminRequest(`bookings?booking_id=eq.${encodeURIComponent(booking.booking_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed", updated_by: staffUserId, updated_at: now })
      });
      await adminRequest("booking_status_history", {
        method: "POST",
        body: JSON.stringify({
          booking_id: booking.booking_id,
          previous_status: booking.status,
          next_status: "confirmed",
          reason: `พนักงานตรวจและยืนยันสลิปมัดจำ ${Number(payment.amount).toLocaleString("th-TH")} บาท`,
          actor_user_id: staffUserId,
          actor_type: "staff"
        })
      });
    }
    const idempotencyKey = `deposit_confirmed:${booking.booking_code}`;
    const logs = await adminRequest<MessageLogRow[]>(
      `line_message_log?select=idempotency_key&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    );
    if (!logs[0]) {
      await pushCheckinReceipt(booking, customer, payment.payment_id);
      await adminRequest("line_message_log", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          booking_id: booking.booking_id,
          event_type: "deposit_confirmed",
          line_user_id: customer.line_user_id
        })
      });
    }
    return NextResponse.json({ ok: true, bookingCode: booking.booking_code, depositStatus: "paid", checkinReceiptSent: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Staff deposit confirmation failed", error);
    return NextResponse.json({ error: "confirmation failed" }, { status: 500 });
  }
}