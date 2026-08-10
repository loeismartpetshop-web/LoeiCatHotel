import "server-only";

import { staffAdminRequest } from "./staff-server";

export type PurgeScope = "rooms" | "bookings" | "payments" | "customers";

export interface PurgeResult {
  deletedRooms: number;
  deletedBookings: number;
  deletedPayments: number;
  deletedCustomers: number;
  deletedPets: number;
}

function emptyResult(): PurgeResult {
  return {
    deletedRooms: 0,
    deletedBookings: 0,
    deletedPayments: 0,
    deletedCustomers: 0,
    deletedPets: 0
  };
}

export async function purgeBookingTree(bookingId: string): Promise<number> {
  const id = encodeURIComponent(bookingId);
  const payments = await staffAdminRequest<Array<{ payment_id: string }>>(
    `payments?select=payment_id&booking_id=eq.${id}`
  );
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
  return payments.length;
}

export async function purgeCustomerTree(customerId: string): Promise<Pick<PurgeResult, "deletedBookings" | "deletedPayments" | "deletedPets">> {
  const id = encodeURIComponent(customerId);
  const [bookings, pets] = await Promise.all([
    staffAdminRequest<Array<{ booking_id: string }>>(`bookings?select=booking_id&customer_id=eq.${id}`),
    staffAdminRequest<Array<{ pet_id: string }>>(`pets?select=pet_id&customer_id=eq.${id}`)
  ]);

  let deletedPayments = 0;
  for (const booking of bookings) deletedPayments += await purgeBookingTree(booking.booking_id);

  await staffAdminRequest(`emergency_consent?customer_id=eq.${id}`, { method: "DELETE" });
  for (const pet of pets) {
    const petId = encodeURIComponent(pet.pet_id);
    await staffAdminRequest(`daily_care_tasks?pet_id=eq.${petId}`, { method: "DELETE" });
    await staffAdminRequest(`audit_log?entity_type=eq.pet&entity_id=eq.${petId}`, { method: "DELETE" });
    await staffAdminRequest(`pets?pet_id=eq.${petId}`, { method: "DELETE" });
  }
  await staffAdminRequest(`audit_log?entity_type=eq.customer&entity_id=eq.${id}`, { method: "DELETE" });
  await staffAdminRequest(`customers?customer_id=eq.${id}`, { method: "DELETE" });

  return {
    deletedBookings: bookings.length,
    deletedPayments,
    deletedPets: pets.length
  };
}

export async function purgeScope(scope: PurgeScope): Promise<PurgeResult> {
  const result = emptyResult();

  if (scope === "bookings") {
    const bookings = await staffAdminRequest<Array<{ booking_id: string }>>(
      "bookings?select=booking_id&limit=5000"
    );
    for (const booking of bookings) result.deletedPayments += await purgeBookingTree(booking.booking_id);
    result.deletedBookings = bookings.length;
    return result;
  }

  if (scope === "payments") {
    const payments = await staffAdminRequest<Array<{ payment_id: string }>>(
      "payments?select=payment_id&limit=5000"
    );
    await staffAdminRequest("refund_requests?payment_id=not.is.null", { method: "DELETE" });
    await staffAdminRequest("audit_log?entity_type=eq.payment", { method: "DELETE" });
    await staffAdminRequest("payments?payment_id=not.is.null", { method: "DELETE" });
    result.deletedPayments = payments.length;
    return result;
  }

  if (scope === "rooms") {
    const rooms = await staffAdminRequest<Array<{ room_id: string }>>(
      "rooms?select=room_id&limit=5000"
    );
    await staffAdminRequest("daily_care_tasks?room_id=not.is.null", { method: "DELETE" });
    await staffAdminRequest("print_history?room_id=not.is.null", { method: "DELETE" });
    await staffAdminRequest("booking_room_allocations?room_id=not.is.null", { method: "DELETE" });
    await staffAdminRequest("audit_log?entity_type=eq.room", { method: "DELETE" });
    await staffAdminRequest("rooms?room_id=not.is.null", { method: "DELETE" });
    result.deletedRooms = rooms.length;
    return result;
  }

  const customers = await staffAdminRequest<Array<{ customer_id: string }>>(
    "customers?select=customer_id&limit=5000"
  );
  for (const customer of customers) {
    const deleted = await purgeCustomerTree(customer.customer_id);
    result.deletedBookings += deleted.deletedBookings;
    result.deletedPayments += deleted.deletedPayments;
    result.deletedPets += deleted.deletedPets;
  }
  result.deletedCustomers = customers.length;
  return result;
}