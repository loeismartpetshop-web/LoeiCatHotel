import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface AuthUser { id?: string }
interface StaffRow { auth_user_id: string; full_name: string; role: string; is_active: boolean }
interface RoomRow {
  room_id: string;
  room_code: string;
  display_name: string;
  room_type: string;
  minimum_pets: number;
  maximum_pets: number;
  status: string;
}
interface BookingRow {
  booking_id: string;
  booking_code: string;
  customer_id: string;
  status: string;
  source: string;
  check_in_at: string;
  check_out_at: string;
  total_pets: number;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  customer_notes: string | null;
  created_at: string;
}
interface CustomerRow {
  customer_id: string;
  full_name: string;
  preferred_name: string | null;
  phone: string;
  mihome_app_id: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  created_at: string;
}
interface PetRow {
  pet_id: string;
  customer_id: string;
  pet_name: string;
  sex: string | null;
  breed: string | null;
  age_text: string | null;
  photo_path: string | null;
  photo_updated_at: string | null;
}
interface BookingPetRow { booking_id: string; pet_id: string }
interface AllocationRow {
  booking_room_allocation_id: string;
  booking_id: string;
  room_id: string;
  allocated_from: string;
  allocated_until: string;
  pet_count: number;
  status: string;
}

function getConfig() {
  const url = process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !publishable) throw new Error("Supabase environment variables are missing");
  return { url: url.replace(/\/$/, ""), secret, publishable };
}

async function adminRequest<T>(path: string): Promise<T> {
  const { url, secret } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

function isMissingMiHomeColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("mihome_app_id") && /PGRST204|schema cache|does not exist/i.test(message);
}

async function loadCustomers(): Promise<CustomerRow[]> {
  try {
    return await adminRequest<CustomerRow[]>(
      "customers?select=customer_id,full_name,preferred_name,phone,mihome_app_id,line_user_id,line_display_name,created_at&deleted_at=is.null&order=created_at.desc&limit=300"
    );
  } catch (error) {
    if (!isMissingMiHomeColumn(error)) throw error;
    const customers = await adminRequest<Array<Omit<CustomerRow, "mihome_app_id">>>(
      "customers?select=customer_id,full_name,preferred_name,phone,line_user_id,line_display_name,created_at&deleted_at=is.null&order=created_at.desc&limit=300"
    );
    return customers.map((customer) => ({ ...customer, mihome_app_id: null }));
  }
}
function isMissingPetPhotoColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("photo_path") && /PGRST204|schema cache|does not exist/i.test(message);
}

async function loadPets(): Promise<PetRow[]> {
  try {
    return await adminRequest<PetRow[]>(
      "pets?select=pet_id,customer_id,pet_name,sex,breed,age_text,photo_path,photo_updated_at&deleted_at=is.null&order=created_at.desc&limit=1000"
    );
  } catch (error) {
    if (!isMissingPetPhotoColumn(error)) throw error;
    const pets = await adminRequest<Array<Omit<PetRow, "photo_path" | "photo_updated_at">>>(
      "pets?select=pet_id,customer_id,pet_name,sex,breed,age_text&deleted_at=is.null&order=created_at.desc&limit=1000"
    );
    return pets.map((pet) => ({ ...pet, photo_path: null, photo_updated_at: null }));
  }
}

// รูปน้องแมวอยู่ใน private bucket จึงต้องแปลงเป็น signed URL อายุสั้นก่อนส่งให้หน้าเว็บ
async function signPetPhotos(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return signed;
  try {
    const { url, secret } = getConfig();
    const response = await fetch(`${url}/storage/v1/object/sign/pet-photos`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expiresIn: 900, paths: unique })
    });
    if (!response.ok) return signed;
    const rows = await response.json() as Array<{ path?: string; signedURL?: string; error?: string | null }>;
    for (const row of rows) {
      if (row.path && row.signedURL && !row.error) {
        signed.set(row.path, `${url}/storage/v1${row.signedURL}`);
      }
    }
  } catch {
    // ถ้าเซ็น URL ไม่สำเร็จให้แดชบอร์ดยังใช้งานได้ตามปกติ เพียงแต่ไม่มีรูป
  }
  return signed;
}

async function requireStaff(request: Request): Promise<StaffRow> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response("unauthorized", { status: 401 });

  const { url, publishable } = getConfig();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    cache: "no-store",
    headers: { apikey: publishable, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) throw new Response("unauthorized", { status: 401 });

  const user = await userResponse.json() as AuthUser;
  if (!user.id) throw new Response("unauthorized", { status: 401 });
  const staff = await adminRequest<StaffRow[]>(
    `staff_profiles?select=auth_user_id,full_name,role,is_active&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`
  );
  if (!staff[0] || !["owner", "front_desk"].includes(staff[0].role)) {
    throw new Response("forbidden", { status: 403 });
  }
  return staff[0];
}

function dateKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function roomTypeFromNotes(notes: string | null): string | null {
  const match = notes?.match(/ห้องที่เลือก:\s*(villa|condo)/i);
  return match?.[1]?.toLowerCase() ?? null;
}
function miHomeIdFromNotes(notes: string | null): string | null {
  const match = notes?.match(/Mi Home ID:\s*([^;]+)/i);
  return match?.[1]?.trim() && match[1].trim() !== "ไม่ระบุ" ? match[1].trim() : null;
}


export async function GET(request: Request) {
  try {
    const staff = await requireStaff(request);
    const [rooms, bookings, customers, pets, bookingPets, allocations] = await Promise.all([
      adminRequest<RoomRow[]>(
        "rooms?select=room_id,room_code,display_name,room_type,minimum_pets,maximum_pets,status&deleted_at=is.null&order=recommendation_order.asc,room_code.asc&limit=300"
      ),
      adminRequest<BookingRow[]>(
        "bookings?select=booking_id,booking_code,customer_id,status,source,check_in_at,check_out_at,total_pets,total_amount,deposit_amount,balance_amount,customer_notes,created_at&order=created_at.desc&limit=300"
      ),
      loadCustomers(),
      loadPets(),
      adminRequest<BookingPetRow[]>("booking_pets?select=booking_id,pet_id&limit=2000"),
      adminRequest<AllocationRow[]>(
        "booking_room_allocations?select=booking_room_allocation_id,booking_id,room_id,allocated_from,allocated_until,pet_count,status&order=allocated_from.asc&limit=2000"
      )
    ]);

    const now = new Date();
    const today = dateKey(now);
    const inactiveStatuses = new Set(["cancelled", "expired"]);
    const customerById = new Map(customers.map((customer) => [customer.customer_id, customer]));
    const petById = new Map(pets.map((pet) => [pet.pet_id, pet]));
    const bookingById = new Map(bookings.map((booking) => [booking.booking_id, booking]));
    const petIdsByBooking = new Map<string, string[]>();
    bookingPets.forEach((item) => {
      const list = petIdsByBooking.get(item.booking_id) ?? [];
      list.push(item.pet_id);
      petIdsByBooking.set(item.booking_id, list);
    });

    const allocationsByRoom = new Map<string, AllocationRow[]>();
    allocations.forEach((allocation) => {
      const list = allocationsByRoom.get(allocation.room_id) ?? [];
      list.push(allocation);
      allocationsByRoom.set(allocation.room_id, list);
    });

    const dashboardRooms = rooms.map((room) => {
      const activeAllocations = (allocationsByRoom.get(room.room_id) ?? [])
        .filter((allocation) => allocation.status === "active" && new Date(allocation.allocated_until) > now)
        .filter((allocation) => {
          const booking = bookingById.get(allocation.booking_id);
          return booking && !inactiveStatuses.has(booking.status);
        });
      const current = activeAllocations.find((allocation) => new Date(allocation.allocated_from) <= now);
      const next = activeAllocations.find((allocation) => new Date(allocation.allocated_from) > now);
      const selected = current ?? next;
      const booking = selected ? bookingById.get(selected.booking_id) : undefined;
      const customer = booking ? customerById.get(booking.customer_id) : undefined;
      const occupancy = room.status !== "active"
        ? room.status
        : current ? "occupied" : next ? "upcoming" : "available";
      return {
        roomId: room.room_id,
        roomCode: room.room_code,
        displayName: room.display_name,
        roomType: room.room_type,
        minimumPets: room.minimum_pets,
        maximumPets: room.maximum_pets,
        status: room.status,
        occupancy,
        bookingCode: booking?.booking_code ?? null,
        customerName: customer?.full_name ?? null,
        petCount: selected?.pet_count ?? null,
        occupiedFrom: selected?.allocated_from ?? null,
        occupiedUntil: selected?.allocated_until ?? null
      };
    });

    const dashboardBookings = bookings.map((booking) => {
      const customer = customerById.get(booking.customer_id);
      const bookingPetNames = (petIdsByBooking.get(booking.booking_id) ?? [])
        .map((petId) => petById.get(petId)?.pet_name)
        .filter((name): name is string => Boolean(name));
      const roomNames = allocations
        .filter((allocation) => allocation.booking_id === booking.booking_id && allocation.status === "active")
        .map((allocation) => rooms.find((room) => room.room_id === allocation.room_id)?.display_name)
        .filter((name): name is string => Boolean(name));
      return {
        bookingId: booking.booking_id,
        bookingCode: booking.booking_code,
        status: booking.status,
        source: booking.source,
        customerName: customer?.full_name ?? "ไม่พบชื่อลูกค้า",
        phone: customer?.phone ?? "–",
        petNames: bookingPetNames,
        totalPets: booking.total_pets,
        roomType: roomTypeFromNotes(booking.customer_notes),
        roomNames,
        checkInAt: booking.check_in_at,
        checkOutAt: booking.check_out_at,
        totalAmount: Number(booking.total_amount),
        depositAmount: Number(booking.deposit_amount),
        balanceAmount: Number(booking.balance_amount),
        createdAt: booking.created_at
      };
    });

    const petPhotoUrls = await signPetPhotos(pets.map((pet) => pet.photo_path ?? ""));

    const dashboardCustomers = customers.map((customer) => {
      const customerPets = pets.filter((pet) => pet.customer_id === customer.customer_id);
      const customerBookings = bookings.filter((booking) => booking.customer_id === customer.customer_id);
      return {
        customerId: customer.customer_id,
        fullName: customer.full_name,
        preferredName: customer.preferred_name,
        phone: customer.phone,
        miHomeAppId: customer.mihome_app_id || miHomeIdFromNotes(customerBookings[0]?.customer_notes ?? null),
        lineDisplayName: customer.line_display_name,
        hasLineAccount: Boolean(customer.line_user_id),
        pets: customerPets.map((pet) => ({
          petId: pet.pet_id,
          petName: pet.pet_name,
          sex: pet.sex,
          breed: pet.breed,
          ageText: pet.age_text,
          photoUrl: pet.photo_path ? petPhotoUrls.get(pet.photo_path) ?? null : null,
          photoUpdatedAt: pet.photo_updated_at
        })),
        bookingCount: customerBookings.length,
        latestBookingAt: customerBookings[0]?.created_at ?? null,
        createdAt: customer.created_at
      };
    });

    const activeBookings = bookings.filter((booking) => !inactiveStatuses.has(booking.status));
    const occupiedRooms = dashboardRooms.filter((room) => room.occupancy === "occupied").length;
    const unallocatedBookings = activeBookings.filter((booking) =>
      ["confirmed", "checked_in"].includes(booking.status)
      && !allocations.some((allocation) => allocation.booking_id === booking.booking_id && allocation.status === "active")
    ).length;

    return NextResponse.json({
      staff: { fullName: staff.full_name, role: staff.role },
      summary: {
        todayCheckIns: activeBookings.filter((booking) => dateKey(booking.check_in_at) === today).length,
        todayCheckOuts: activeBookings.filter((booking) => dateKey(booking.check_out_at) === today).length,
        activeStays: bookings.filter((booking) => booking.status === "checked_in").length,
        upcomingBookings: activeBookings.filter((booking) =>
          ["pending_deposit", "confirmed"].includes(booking.status) && new Date(booking.check_in_at) > now
        ).length,
        totalRooms: rooms.filter((room) => room.status !== "inactive").length,
        occupiedRooms,
        unallocatedBookings,
        totalCustomers: customers.length,
        totalPets: pets.length
      },
      rooms: dashboardRooms,
      bookings: dashboardBookings,
      customers: dashboardCustomers
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to load staff dashboard", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูล Dashboard ได้" }, { status: 500 });
  }
}
