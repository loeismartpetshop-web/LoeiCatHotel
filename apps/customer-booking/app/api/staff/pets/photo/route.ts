import { NextResponse } from "next/server";
import { getStaffConfig, isUuid, requireStaffSession, staffAdminRequest, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

const BUCKET = "pet-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

interface PetRow {
  pet_id: string;
  pet_name: string;
  photo_path: string | null;
}

function storageUrl(path: string): string {
  const { url } = getStaffConfig();
  return `${url}/storage/v1/${path}`;
}

async function storageRequest(path: string, init: RequestInit): Promise<Response> {
  const { secret } = getStaffConfig();
  return fetch(storageUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      ...init.headers
    }
  });
}

async function removeObject(objectPath: string | null): Promise<void> {
  if (!objectPath) return;
  try {
    await storageRequest(`object/${BUCKET}/${objectPath}`, { method: "DELETE" });
  } catch {
    // ไฟล์เก่าลบไม่สำเร็จไม่ควรทำให้การอัปโหลดรูปใหม่ล้มเหลว
  }
}

async function loadPet(petId: string): Promise<PetRow | null> {
  const rows = await staffAdminRequest<PetRow[]>(
    `pets?select=pet_id,pet_name,photo_path&pet_id=eq.${encodeURIComponent(petId)}&deleted_at=is.null&limit=1`
  );
  return rows[0] ?? null;
}

function missingPhotoColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("photo_path") && /PGRST204|schema cache|does not exist/i.test(message);
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaffSession(request);
    const petId = new URL(request.url).searchParams.get("petId")?.trim() ?? "";
    if (!isUuid(petId)) {
      return NextResponse.json({ error: "รหัสน้องแมวไม่ถูกต้อง" }, { status: 400 });
    }

    const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const extension = ALLOWED_TYPES[contentType];
    if (!extension) {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP" }, { status: 415 });
    }

    const body = await request.arrayBuffer();
    if (!body.byteLength) {
      return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
    }
    if (body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 5 MB" }, { status: 413 });
    }

    const pet = await loadPet(petId);
    if (!pet) {
      return NextResponse.json({ error: "ไม่พบข้อมูลน้องแมว" }, { status: 404 });
    }

    const objectPath = `${petId}/${Date.now()}.${extension}`;
    const upload = await storageRequest(`object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "true" },
      body
    });
    if (!upload.ok) {
      const detail = await upload.text();
      return NextResponse.json(
        { error: `อัปโหลดรูปไม่สำเร็จ: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const updatedAt = new Date().toISOString();
    await staffAdminRequest(`pets?pet_id=eq.${encodeURIComponent(petId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ photo_path: objectPath, photo_updated_at: updatedAt })
    });

    await removeObject(pet.photo_path);
    await writeAudit({
      entityType: "pet",
      entityId: petId,
      action: "pet_photo_updated",
      actorUserId: staff.userId,
      afterData: { photo_path: objectPath },
      reason: `อัปเดตรูปของ ${pet.pet_name}`
    });

    return NextResponse.json({ ok: true, photoUpdatedAt: updatedAt });
  } catch (error) {
    if (error instanceof Response) return error;
    if (missingPhotoColumn(error)) {
      return NextResponse.json(
        { error: "ยังไม่ได้รัน migration 005_add_pet_photo.sql บน Supabase" },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "บันทึกรูปน้องแมวไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const staff = await requireStaffSession(request);
    const petId = new URL(request.url).searchParams.get("petId")?.trim() ?? "";
    if (!isUuid(petId)) {
      return NextResponse.json({ error: "รหัสน้องแมวไม่ถูกต้อง" }, { status: 400 });
    }

    const pet = await loadPet(petId);
    if (!pet) {
      return NextResponse.json({ error: "ไม่พบข้อมูลน้องแมว" }, { status: 404 });
    }

    await staffAdminRequest(`pets?pet_id=eq.${encodeURIComponent(petId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ photo_path: null, photo_updated_at: null })
    });
    await removeObject(pet.photo_path);
    await writeAudit({
      entityType: "pet",
      entityId: petId,
      action: "pet_photo_removed",
      actorUserId: staff.userId,
      beforeData: { photo_path: pet.photo_path },
      reason: `ลบรูปของ ${pet.pet_name}`
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    if (missingPhotoColumn(error)) {
      return NextResponse.json(
        { error: "ยังไม่ได้รัน migration 005_add_pet_photo.sql บน Supabase" },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "ลบรูปน้องแมวไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
