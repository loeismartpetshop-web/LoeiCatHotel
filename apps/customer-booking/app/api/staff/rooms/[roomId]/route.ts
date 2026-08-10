import { NextResponse } from "next/server";
import { isUuid, requireStaffSession, staffAdminRequest, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

interface RoomRow {
  room_id: string;
  room_code: string;
  display_name: string;
  room_type: string;
  minimum_pets: number;
  maximum_pets: number;
  status: string;
  deleted_at: string | null;
}

interface RoomInput {
  roomCode?: string;
  displayName?: string;
  roomType?: string;
  minimumPets?: number;
  maximumPets?: number;
  status?: string;
}

function validateRoom(body: RoomInput) {
  const roomCode = body.roomCode?.trim().toUpperCase() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const roomType = body.roomType ?? "";
  const minimumPets = Number(body.minimumPets);
  const maximumPets = Number(body.maximumPets);
  const status = body.status ?? "active";
  if (!/^[A-Z0-9_-]{1,30}$/.test(roomCode)) throw new Response("invalid room code", { status: 400 });
  if (!displayName || displayName.length > 100) throw new Response("invalid room name", { status: 400 });
  if (!["villa", "condo", "reserve"].includes(roomType)) throw new Response("invalid room type", { status: 400 });
  if (!Number.isInteger(minimumPets) || minimumPets < 1 || minimumPets > 30) throw new Response("invalid minimum pets", { status: 400 });
  if (!Number.isInteger(maximumPets) || maximumPets < minimumPets || maximumPets > 30) throw new Response("invalid maximum pets", { status: 400 });
  if (!["active", "maintenance", "inactive"].includes(status)) throw new Response("invalid room status", { status: 400 });
  return { roomCode, displayName, roomType, minimumPets, maximumPets, status };
}

async function getRoom(roomId: string): Promise<RoomRow> {
  const rooms = await staffAdminRequest<RoomRow[]>(
    `rooms?select=room_id,room_code,display_name,room_type,minimum_pets,maximum_pets,status,deleted_at&room_id=eq.${encodeURIComponent(roomId)}&limit=1`
  );
  if (!rooms[0] || rooms[0].deleted_at) throw new Response("room not found", { status: 404 });
  return rooms[0];
}

async function hasFutureAllocation(roomId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const rows = await staffAdminRequest<Array<{ booking_room_allocation_id: string }>>(
    `booking_room_allocations?select=booking_room_allocation_id&room_id=eq.${encodeURIComponent(roomId)}&status=eq.active&allocated_until=gt.${encodeURIComponent(now)}&limit=1`
  );
  return Boolean(rows[0]);
}

export async function PATCH(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    const { roomId } = await context.params;
    if (!isUuid(roomId)) return NextResponse.json({ error: "invalid room id" }, { status: 400 });
    const before = await getRoom(roomId);
    const input = validateRoom(await request.json() as RoomInput);

    const duplicate = await staffAdminRequest<Array<{ room_id: string }>>(
      `rooms?select=room_id&room_code=eq.${encodeURIComponent(input.roomCode)}&room_id=neq.${encodeURIComponent(roomId)}&limit=1`
    );
    if (duplicate[0]) return NextResponse.json({ error: "รหัสห้องนี้มีอยู่แล้ว" }, { status: 409 });
    if (input.status !== "active" && await hasFutureAllocation(roomId)) {
      return NextResponse.json({ error: "ห้องนี้ยังมีรายการจัดห้องอยู่ กรุณาปล่อยห้องก่อนเปลี่ยนสถานะ" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const after = {
      ...before,
      room_code: input.roomCode,
      display_name: input.displayName,
      room_type: input.roomType,
      minimum_pets: input.minimumPets,
      maximum_pets: input.maximumPets,
      status: input.status,
      updated_at: now
    };
    await staffAdminRequest(`rooms?room_id=eq.${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        room_code: input.roomCode,
        display_name: input.displayName,
        room_type: input.roomType,
        minimum_pets: input.minimumPets,
        maximum_pets: input.maximumPets,
        status: input.status,
        updated_at: now
      })
    });
    await writeAudit({
      entityType: "room",
      entityId: roomId,
      action: "update",
      actorUserId: staff.userId,
      beforeData: before,
      afterData: after,
      reason: "แก้ไขห้องผ่าน Staff Dashboard"
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to update room", error);
    return NextResponse.json({ error: "แก้ไขห้องไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    const { roomId } = await context.params;
    if (!isUuid(roomId)) return NextResponse.json({ error: "invalid room id" }, { status: 400 });
    const before = await getRoom(roomId);
    const body = await request.json().catch(() => ({})) as { permanent?: boolean; confirmation?: string };
    if (body.permanent) {
      if (staff.role !== "owner") {
        return NextResponse.json({ error: "เฉพาะ Owner เท่านั้นที่ลบข้อมูลถาวรได้" }, { status: 403 });
      }
      if (body.confirmation?.trim().toUpperCase() !== before.room_code.toUpperCase()) {
        return NextResponse.json({ error: "รหัสยืนยันไม่ตรงกับรหัสห้อง" }, { status: 400 });
      }

      await staffAdminRequest(`daily_care_tasks?room_id=eq.${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await staffAdminRequest(`print_history?room_id=eq.${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await staffAdminRequest(`booking_room_allocations?room_id=eq.${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await staffAdminRequest(`audit_log?entity_type=eq.room&entity_id=eq.${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await staffAdminRequest(`rooms?room_id=eq.${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await writeAudit({
        entityType: "room",
        entityId: roomId,
        action: "purge_test_data",
        actorUserId: staff.userId,
        beforeData: before,
        afterData: null,
        reason: "Owner ลบห้องทดสอบถาวรผ่าน Staff Dashboard"
      });
      return NextResponse.json({ ok: true, permanent: true, roomCode: before.room_code });
    }

    if (await hasFutureAllocation(roomId)) {
      return NextResponse.json({ error: "ห้องนี้ยังมีรายการจัดห้องอยู่ จึงยังปิดใช้งานไม่ได้" }, { status: 409 });
    }

    const now = new Date().toISOString();
    await staffAdminRequest(`rooms?room_id=eq.${encodeURIComponent(roomId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "inactive", deleted_at: now, updated_at: now })
    });
    await writeAudit({
      entityType: "room",
      entityId: roomId,
      action: "archive",
      actorUserId: staff.userId,
      beforeData: before,
      afterData: { ...before, status: "inactive", deleted_at: now },
      reason: "ปิดใช้งานห้องผ่าน Staff Dashboard"
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to archive room", error);
    return NextResponse.json({ error: "ปิดใช้งานห้องไม่สำเร็จ" }, { status: 500 });
  }
}
