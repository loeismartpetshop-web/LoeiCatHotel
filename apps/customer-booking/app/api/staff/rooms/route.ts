import { NextResponse } from "next/server";
import { requireStaffSession, staffAdminRequest, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

interface RoomInput {
  roomCode?: string;
  displayName?: string;
  roomType?: string;
  minimumPets?: number;
  maximumPets?: number;
  status?: string;
}

interface RoomRow {
  room_id: string;
  room_code: string;
  display_name: string;
  room_type: string;
  minimum_pets: number;
  maximum_pets: number;
  status: string;
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

export async function POST(request: Request) {
  try {
    const staff = await requireStaffSession(request);
    const input = validateRoom(await request.json() as RoomInput);
    const duplicate = await staffAdminRequest<Array<{ room_id: string }>>(
      `rooms?select=room_id&room_code=eq.${encodeURIComponent(input.roomCode)}&limit=1`
    );
    if (duplicate[0]) return NextResponse.json({ error: "รหัสห้องนี้มีอยู่แล้ว" }, { status: 409 });

    const created = await staffAdminRequest<RoomRow[]>("rooms", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        room_code: input.roomCode,
        display_name: input.displayName,
        room_type: input.roomType,
        minimum_pets: input.minimumPets,
        maximum_pets: input.maximumPets,
        status: input.status
      })
    });
    const room = created[0];
    if (!room) throw new Error("Supabase did not return the created room");
    await writeAudit({
      entityType: "room",
      entityId: room.room_id,
      action: "create",
      actorUserId: staff.userId,
      afterData: room,
      reason: "เพิ่มห้องผ่าน Staff Dashboard"
    });
    return NextResponse.json({ ok: true, roomId: room.room_id });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to create room", error);
    return NextResponse.json({ error: "เพิ่มห้องไม่สำเร็จ" }, { status: 500 });
  }
}
