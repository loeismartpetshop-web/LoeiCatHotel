import { NextResponse } from "next/server";
import { isUuid, requireStaffSession, staffAdminRequest, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

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
  updated_at: string;
}

interface BookingInput {
  checkInAt?: string;
  checkOutAt?: string;
  status?: string;
}

const EDITABLE_STATUSES = [
  "draft",
  "held",
  "pending_deposit",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancellation_review"
];

async function getBooking(bookingId: string): Promise<BookingRow> {
  const rows = await staffAdminRequest<BookingRow[]>(
    `bookings?select=booking_id,booking_code,customer_id,status,check_in_at,check_out_at,total_amount,deposit_amount,balance_amount,updated_at&booking_id=eq.${encodeURIComponent(bookingId)}&limit=1`
  );
  if (!rows[0]) throw new Response("booking not found", { status: 404 });
  return rows[0];
}

function parseInput(body: BookingInput) {
  const checkIn = new Date(body.checkInAt ?? "");
  const checkOut = new Date(body.checkOutAt ?? "");
  const status = body.status ?? "";
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    throw new Response("invalid booking dates", { status: 400 });
  }
  if (checkOut <= checkIn) throw new Response("check-out must be after check-in", { status: 400 });
  if (!EDITABLE_STATUSES.includes(status)) throw new Response("invalid booking status", { status: 400 });
  return { checkInAt: checkIn.toISOString(), checkOutAt: checkOut.toISOString(), status };
}

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    const { bookingId } = await context.params;
    if (!isUuid(bookingId)) return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
    const before = await getBooking(bookingId);
    if (["cancelled", "expired"].includes(before.status)) {
      return NextResponse.json({ error: "รายการที่ยกเลิกหรือหมดอายุแล้วไม่สามารถแก้ไขได้" }, { status: 409 });
    }
    const input = parseInput(await request.json() as BookingInput);
    const now = new Date().toISOString();

    await staffAdminRequest(`bookings?booking_id=eq.${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        check_in_at: input.checkInAt,
        check_out_at: input.checkOutAt,
        status: input.status,
        updated_by: staff.userId,
        updated_at: now
      })
    });
    await staffAdminRequest(`booking_room_allocations?booking_id=eq.${encodeURIComponent(bookingId)}&status=eq.active`, {
      method: "PATCH",
      body: JSON.stringify({
        allocated_from: input.checkInAt,
        allocated_until: input.checkOutAt,
        ...(input.status === "checked_out" ? { status: "completed" } : {}),
        updated_by: staff.userId,
        updated_at: now
      })
    });

    if (before.status !== input.status) {
      await staffAdminRequest("booking_status_history", {
        method: "POST",
        body: JSON.stringify({
          booking_id: bookingId,
          previous_status: before.status,
          next_status: input.status,
          reason: "พนักงานแก้ไขสถานะผ่าน Staff Dashboard",
          actor_user_id: staff.userId,
          actor_type: "staff"
        })
      });
    }
    const after = {
      ...before,
      check_in_at: input.checkInAt,
      check_out_at: input.checkOutAt,
      status: input.status,
      updated_at: now
    };
    await writeAudit({
      entityType: "booking",
      entityId: bookingId,
      action: "update",
      actorUserId: staff.userId,
      beforeData: before,
      afterData: after,
      reason: "แก้ไขรายการจองผ่าน Staff Dashboard"
    });
    return NextResponse.json({ ok: true, bookingCode: before.booking_code });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to update booking", error);
    return NextResponse.json({ error: "แก้ไขรายการจองไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    const { bookingId } = await context.params;
    if (!isUuid(bookingId)) return NextResponse.json({ error: "invalid booking id" }, { status: 400 });
    const before = await getBooking(bookingId);
    const body = await request.json().catch(() => ({})) as { permanent?: boolean; confirmation?: string };
    if (body.permanent) {
      if (staff.role !== "owner") {
        return NextResponse.json({ error: "เฉพาะ Owner เท่านั้นที่ลบข้อมูลถาวรได้" }, { status: 403 });
      }
      if (body.confirmation?.trim().toUpperCase() !== before.booking_code.toUpperCase()) {
        return NextResponse.json({ error: "รหัสยืนยันไม่ตรงกับรหัสการจอง" }, { status: 400 });
      }

      await staffAdminRequest(`refund_requests?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`line_message_log?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`daily_care_tasks?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`print_history?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`emergency_consent?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`booking_status_history?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`booking_pets?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`booking_room_allocations?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`payments?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`audit_log?entity_type=eq.booking&entity_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await staffAdminRequest(`bookings?booking_id=eq.${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      await writeAudit({
        entityType: "booking",
        entityId: bookingId,
        action: "purge_test_data",
        actorUserId: staff.userId,
        beforeData: before,
        afterData: null,
        reason: "Owner ลบรายการจองทดสอบถาวรผ่าน Staff Dashboard"
      });
      return NextResponse.json({ ok: true, permanent: true, bookingCode: before.booking_code });
    }

    if (before.status === "checked_out") {
      return NextResponse.json({ error: "รายการที่รับกลับแล้วต้องเก็บเป็นประวัติและไม่สามารถยกเลิกได้" }, { status: 409 });
    }
    if (before.status === "cancelled") return NextResponse.json({ ok: true, bookingCode: before.booking_code });

    const now = new Date().toISOString();
    await staffAdminRequest(`bookings?booking_id=eq.${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", updated_by: staff.userId, updated_at: now })
    });
    await staffAdminRequest(`payments?booking_id=eq.${encodeURIComponent(bookingId)}&status=eq.pending`, {
      method: "PATCH",
      body: JSON.stringify({ status: "voided", updated_at: now })
    });
    await staffAdminRequest(`booking_room_allocations?booking_id=eq.${encodeURIComponent(bookingId)}&status=eq.active`, {
      method: "PATCH",
      body: JSON.stringify({ status: "released", updated_by: staff.userId, updated_at: now })
    });
    await staffAdminRequest("booking_status_history", {
      method: "POST",
      body: JSON.stringify({
        booking_id: bookingId,
        previous_status: before.status,
        next_status: "cancelled",
        reason: "พนักงานยกเลิกรายการจองผ่าน Staff Dashboard",
        actor_user_id: staff.userId,
        actor_type: "staff"
      })
    });
    await writeAudit({
      entityType: "booking",
      entityId: bookingId,
      action: "cancel",
      actorUserId: staff.userId,
      beforeData: before,
      afterData: { ...before, status: "cancelled", updated_at: now },
      reason: "ยกเลิกรายการจองผ่าน Staff Dashboard"
    });
    return NextResponse.json({ ok: true, bookingCode: before.booking_code });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to cancel booking", error);
    return NextResponse.json({ error: "ยกเลิกรายการจองไม่สำเร็จ" }, { status: 500 });
  }
}
