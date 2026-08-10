import { NextResponse } from "next/server";
import { isUuid, requireStaffSession, staffAdminRequest, writeAudit } from "@/lib/staff-server";

export const runtime = "nodejs";

interface CustomerRow {
  customer_id: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
  created_at: string;
}

interface BookingRow {
  booking_id: string;
  booking_code: string;
}

interface PetRow {
  pet_id: string;
  pet_name: string;
}

async function deleteBookingTree(bookingId: string) {
  const id = encodeURIComponent(bookingId);
  await staffAdminRequest(`refund_requests?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`line_message_log?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`daily_care_tasks?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`print_history?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`emergency_consent?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`booking_status_history?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`booking_pets?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`booking_room_allocations?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`payments?booking_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`audit_log?entity_type=eq.booking&entity_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`bookings?booking_id=eq.${id}`, { method: "DELETE" });
}

export async function DELETE(request: Request, context: { params: Promise<{ customerId: string }> }) {
  try {
    const staff = await requireStaffSession(request);
    if (staff.role !== "owner") {
      return NextResponse.json({ error: "เฉพาะ Owner เท่านั้นที่ลบข้อมูลครอบครัวถาวรได้" }, { status: 403 });
    }

    const { customerId } = await context.params;
    if (!isUuid(customerId)) return NextResponse.json({ error: "invalid customer id" }, { status: 400 });

    const customers = await staffAdminRequest<CustomerRow[]>(
      `customers?select=customer_id,full_name,phone,line_user_id,created_at&customer_id=eq.${encodeURIComponent(customerId)}&limit=1`
    );
    const customer = customers[0];
    if (!customer) return NextResponse.json({ error: "ไม่พบข้อมูลลูกค้า" }, { status: 404 });

    const body = await request.json().catch(() => ({})) as { permanent?: boolean; confirmation?: string };
    if (!body.permanent) return NextResponse.json({ error: "คำขอลบถาวรไม่สมบูรณ์" }, { status: 400 });
    if (body.confirmation?.trim() !== customer.phone.trim()) {
      return NextResponse.json({ error: "เบอร์โทรยืนยันไม่ตรงกับข้อมูลลูกค้า" }, { status: 400 });
    }

    const [bookings, pets] = await Promise.all([
      staffAdminRequest<BookingRow[]>(
        `bookings?select=booking_id,booking_code&customer_id=eq.${encodeURIComponent(customerId)}`
      ),
      staffAdminRequest<PetRow[]>(
        `pets?select=pet_id,pet_name&customer_id=eq.${encodeURIComponent(customerId)}`
      )
    ]);

    for (const booking of bookings) await deleteBookingTree(booking.booking_id);

    await staffAdminRequest(`emergency_consent?customer_id=eq.${encodeURIComponent(customerId)}`, { method: "DELETE" });
    for (const pet of pets) {
      const petId = encodeURIComponent(pet.pet_id);
      await staffAdminRequest(`daily_care_tasks?pet_id=eq.${petId}`, { method: "DELETE" });
      await staffAdminRequest(`audit_log?entity_type=eq.pet&entity_id=eq.${petId}`, { method: "DELETE" });
      await staffAdminRequest(`pets?pet_id=eq.${petId}`, { method: "DELETE" });
    }

    await staffAdminRequest(`audit_log?entity_type=eq.customer&entity_id=eq.${encodeURIComponent(customerId)}`, { method: "DELETE" });
    await staffAdminRequest(`customers?customer_id=eq.${encodeURIComponent(customerId)}`, { method: "DELETE" });
    await writeAudit({
      entityType: "customer",
      entityId: customerId,
      action: "purge_test_family",
      actorUserId: staff.userId,
      beforeData: {
        customer,
        bookings: bookings.map((booking) => booking.booking_code),
        pets: pets.map((pet) => pet.pet_name)
      },
      afterData: null,
      reason: "Owner ลบข้อมูลลูกค้า น้องแมว และรายการจองทดสอบผ่าน Staff Dashboard"
    });

    return NextResponse.json({
      ok: true,
      customerName: customer.full_name,
      deletedBookings: bookings.length,
      deletedPets: pets.length
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to purge test customer family", error);
    return NextResponse.json({ error: "ลบข้อมูลครอบครัวทดสอบไม่สำเร็จ" }, { status: 500 });
  }
}
