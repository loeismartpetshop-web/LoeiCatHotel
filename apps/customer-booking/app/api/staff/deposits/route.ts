import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface AuthUser { id?: string }
interface StaffRow {
  auth_user_id: string;
  full_name: string;
  role: "owner" | "front_desk" | string;
  is_active: boolean;
}
interface BookingRow {
  booking_id: string;
  booking_code: string;
  customer_id: string;
  status: string;
  check_in_at: string;
  check_out_at: string;
  total_pets: number;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  created_at: string;
}
interface CustomerRow {
  customer_id: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
}
interface PaymentRow {
  payment_id: string;
  booking_id: string;
  amount: number;
  status: string;
  created_at: string;
}
interface BookingPetRow { booking_id: string; pet_id: string }
interface PetRow { pet_id: string; pet_name: string }

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

function inFilter(values: string[]): string {
  return `in.(${values.join(",")})`;
}

export async function GET(request: Request) {
  try {
    const staff = await requireStaff(request);
    const bookings = await adminRequest<BookingRow[]>(
      "bookings?select=booking_id,booking_code,customer_id,status,check_in_at,check_out_at,total_pets,total_amount,deposit_amount,balance_amount,created_at&status=eq.pending_deposit&order=created_at.desc&limit=100"
    );

    if (!bookings.length) {
      return NextResponse.json({
        staff: { fullName: staff.full_name, role: staff.role },
        pendingDeposits: []
      });
    }

    const bookingIds = bookings.map((booking) => booking.booking_id);
    const customerIds = [...new Set(bookings.map((booking) => booking.customer_id))];
    const [payments, customers, bookingPets] = await Promise.all([
      adminRequest<PaymentRow[]>(
        `payments?select=payment_id,booking_id,amount,status,created_at&booking_id=${inFilter(bookingIds)}&payment_type=eq.deposit&status=eq.pending`
      ),
      adminRequest<CustomerRow[]>(
        `customers?select=customer_id,full_name,phone,line_user_id&customer_id=${inFilter(customerIds)}`
      ),
      adminRequest<BookingPetRow[]>(
        `booking_pets?select=booking_id,pet_id&booking_id=${inFilter(bookingIds)}`
      )
    ]);

    const petIds = [...new Set(bookingPets.map((item) => item.pet_id))];
    const pets = petIds.length
      ? await adminRequest<PetRow[]>(`pets?select=pet_id,pet_name&pet_id=${inFilter(petIds)}`)
      : [];
    const paymentByBooking = new Map(payments.map((payment) => [payment.booking_id, payment]));
    const customerById = new Map(customers.map((customer) => [customer.customer_id, customer]));
    const petById = new Map(pets.map((pet) => [pet.pet_id, pet.pet_name]));
    const petIdsByBooking = new Map<string, string[]>();
    bookingPets.forEach((item) => {
      const current = petIdsByBooking.get(item.booking_id) ?? [];
      current.push(item.pet_id);
      petIdsByBooking.set(item.booking_id, current);
    });

    const pendingDeposits = bookings.flatMap((booking) => {
      const payment = paymentByBooking.get(booking.booking_id);
      if (!payment) return [];
      const customer = customerById.get(booking.customer_id);
      return [{
        bookingId: booking.booking_id,
        bookingCode: booking.booking_code,
        customerName: customer?.full_name ?? "ไม่พบชื่อลูกค้า",
        phone: customer?.phone ?? "–",
        hasLineAccount: Boolean(customer?.line_user_id),
        petNames: (petIdsByBooking.get(booking.booking_id) ?? []).map((petId) => petById.get(petId)).filter(Boolean),
        petCount: booking.total_pets,
        checkInAt: booking.check_in_at,
        checkOutAt: booking.check_out_at,
        totalAmount: Number(booking.total_amount),
        depositAmount: Number(payment.amount),
        balanceAmount: Number(booking.balance_amount),
        notifiedAt: payment.created_at
      }];
    });

    return NextResponse.json({
      staff: { fullName: staff.full_name, role: staff.role },
      pendingDeposits
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Unable to load pending deposits", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดรายการมัดจำได้" }, { status: 500 });
  }
}
