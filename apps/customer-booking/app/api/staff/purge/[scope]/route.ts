import { NextResponse } from "next/server";
import { purgeScope, type PurgeScope } from "@/lib/staff-purge";
import { requireStaffSession, verifyStaffPassword, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

const VALID_SCOPES = new Set<PurgeScope>(["rooms", "bookings", "payments", "customers"]);

export async function DELETE(request: Request, context: { params: Promise<{ scope: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    if (staff.role !== "owner") {
      return NextResponse.json({ error: "เฉพาะ Owner เท่านั้นที่ลบข้อมูลทั้งหมดได้" }, { status: 403 });
    }

    const { scope: rawScope } = await context.params;
    if (!VALID_SCOPES.has(rawScope as PurgeScope)) {
      return NextResponse.json({ error: "ไม่พบหมวดข้อมูลที่ต้องการลบ" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { password?: string };
    if (!body.password?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกรหัสผ่าน Owner" }, { status: 400 });
    }
    if (!await verifyStaffPassword(staff.email, body.password)) {
      return NextResponse.json({ error: "รหัสผ่าน Owner ไม่ถูกต้อง" }, { status: 401 });
    }

    const scope = rawScope as PurgeScope;
    const result = await purgeScope(scope);
    await writeAudit({
      entityType: "system",
      entityId: staff.userId,
      action: `bulk_purge_${scope}`,
      actorUserId: staff.userId,
      beforeData: result,
      afterData: null,
      reason: `Owner ลบข้อมูลทดสอบทั้งหมดในหมวด ${scope} ผ่าน Staff Dashboard`
    });

    return NextResponse.json({ ok: true, scope, ...result });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to bulk purge test data", error);
    return NextResponse.json({ error: "ลบข้อมูลทั้งหมดไม่สำเร็จ กรุณาตรวจสอบรายการที่เชื่อมโยงแล้วลองอีกครั้ง" }, { status: 500 });
  }
}