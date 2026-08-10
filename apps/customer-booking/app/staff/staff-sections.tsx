"use client";

import { useMemo, useState } from "react";
import { StaffActionDialog } from "./staff-action-dialog";
import { StaffBulkPurge } from "./staff-bulk-purge";
import styles from "./staff-sections.module.css";

export type DashboardSection = "overview" | "rooms" | "bookings" | "payments" | "customers";

export interface DashboardRoom {
  roomId: string;
  roomCode: string;
  displayName: string;
  roomType: string;
  minimumPets: number;
  maximumPets: number;
  status: string;
  occupancy: string;
  bookingCode: string | null;
  customerName: string | null;
  petCount: number | null;
  occupiedFrom: string | null;
  occupiedUntil: string | null;
}

export interface DashboardBooking {
  bookingId: string;
  bookingCode: string;
  status: string;
  source: string;
  customerName: string;
  phone: string;
  petNames: string[];
  totalPets: number;
  roomType: string | null;
  roomNames: string[];
  checkInAt: string;
  checkOutAt: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  createdAt: string;
}

export interface DashboardCustomer {
  customerId: string;
  fullName: string;
  preferredName: string | null;
  phone: string;
  miHomeAppId: string | null;
  lineDisplayName: string | null;
  hasLineAccount: boolean;
  pets: Array<{
    petId: string;
    petName: string;
    sex: string | null;
    breed: string | null;
    ageText: string | null;
  }>;
  bookingCount: number;
  latestBookingAt: string | null;
  createdAt: string;
}

export interface StaffDashboardData {
  summary: {
    todayCheckIns: number;
    todayCheckOuts: number;
    activeStays: number;
    upcomingBookings: number;
    totalRooms: number;
    occupiedRooms: number;
    unallocatedBookings: number;
    totalCustomers: number;
    totalPets: number;
  };
  rooms: DashboardRoom[];
  bookings: DashboardBooking[];
  customers: DashboardCustomer[];
}

function formatBaht(amount: number): string {
  return `${Number(amount).toLocaleString("th-TH")} บาท`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "แบบร่าง",
    held: "ล็อกห้องชั่วคราว",
    pending_deposit: "รอตรวจมัดจำ",
    confirmed: "ยืนยันแล้ว",
    checked_in: "กำลังเข้าพัก",
    checked_out: "รับกลับแล้ว",
    cancellation_review: "ตรวจสอบยกเลิก",
    cancelled: "ยกเลิก",
    expired: "หมดอายุ"
  };
  return labels[status] ?? status;
}

function roomTypeLabel(roomType: string | null): string {
  if (roomType === "villa") return "ห้องวิลล่า";
  if (roomType === "condo") return "ห้องคอนโด";
  if (roomType === "reserve") return "ห้องสำรอง";
  return "ยังไม่ระบุ";
}

function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return <div className={styles.sectionEmpty}><div>✓</div><h3>{title}</h3><p>{detail}</p></div>;
}

export function OverviewSection({ data }: { data: StaffDashboardData }) {
  const upcoming = data.bookings
    .filter((booking) => ["pending_deposit", "confirmed"].includes(booking.status))
    .filter((booking) => new Date(booking.checkInAt) > new Date())
    .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime())
    .slice(0, 6);

  return (
    <>
      <section className={styles.sectionStats} aria-label="สรุปวันนี้">
        <article><span>เช็กอินวันนี้</span><strong>{data.summary.todayCheckIns}</strong><small>รายการ</small></article>
        <article><span>รับกลับวันนี้</span><strong>{data.summary.todayCheckOuts}</strong><small>รายการ</small></article>
        <article><span>กำลังเข้าพัก</span><strong>{data.summary.activeStays}</strong><small>การจอง</small></article>
        <article><span>รอเข้าพัก</span><strong>{data.summary.upcomingBookings}</strong><small>การจอง</small></article>
      </section>

      <div className={styles.overviewGrid}>
        <section className={styles.contentPanel}>
          <header><div><span>TODAY & UPCOMING</span><h2>คิวเข้าพักถัดไป</h2></div></header>
          {upcoming.length ? (
            <div className={styles.compactList}>
              {upcoming.map((booking) => (
                <article key={booking.bookingId}>
                  <div className={styles.dateChip}><strong>{new Date(booking.checkInAt).getDate()}</strong><span>{new Intl.DateTimeFormat("th-TH", { month: "short", timeZone: "Asia/Bangkok" }).format(new Date(booking.checkInAt))}</span></div>
                  <div><strong>{booking.customerName}</strong><span>{booking.bookingCode} · {booking.petNames.join(", ") || `${booking.totalPets} ตัว`}</span></div>
                  <div className={styles.listTail}><strong>{roomTypeLabel(booking.roomType)}</strong><span>{formatDateTime(booking.checkInAt)}</span></div>
                </article>
              ))}
            </div>
          ) : <EmptyBlock title="ยังไม่มีคิวเข้าพักถัดไป" detail="รายการที่ยืนยันแล้วจะปรากฏที่นี่" />}
        </section>

        <aside className={styles.quickPanel}>
          <span>ROOM & CUSTOMER</span><h2>ภาพรวมระบบ</h2>
          <dl>
            <div><dt>ห้องเปิดใช้งาน</dt><dd>{data.summary.totalRooms}</dd></div>
            <div><dt>ห้องกำลังใช้งาน</dt><dd>{data.summary.occupiedRooms}</dd></div>
            <div className={data.summary.unallocatedBookings ? styles.attention : ""}><dt>การจองที่ยังไม่จัดห้อง</dt><dd>{data.summary.unallocatedBookings}</dd></div>
            <div><dt>ลูกค้าทั้งหมด</dt><dd>{data.summary.totalCustomers}</dd></div>
            <div><dt>น้องแมวทั้งหมด</dt><dd>{data.summary.totalPets}</dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}

export function RoomsSection({ rooms }: { rooms: DashboardRoom[] }) {
  return (
    <section className={styles.contentPanel}>
      <header><div><span>ROOM BOARD</span><h2>สถานะห้องพัก</h2><p>ข้อมูลจากตาราง rooms และ booking_room_allocations</p></div></header>
      {rooms.length ? (
        <div className={styles.roomGrid}>
          {rooms.map((room) => (
            <article className={styles.roomCard} key={room.roomId}>
              <header><div><span>{room.roomCode}</span><h3>{room.displayName}</h3></div><i className={`${styles.roomStatus} ${styles[`room_${room.occupancy}`]}`}>{room.occupancy === "occupied" ? "มีน้องเข้าพัก" : room.occupancy === "upcoming" ? "มีคิวถัดไป" : room.occupancy === "available" ? "ว่าง" : room.occupancy === "maintenance" ? "ปิดซ่อม" : "ปิดใช้งาน"}</i></header>
              <div className={styles.roomMeta}><span>{roomTypeLabel(room.roomType)}</span><span>รองรับ {room.minimumPets}–{room.maximumPets} ตัว</span></div>
              {room.bookingCode ? (
                <dl><div><dt>การจอง</dt><dd>{room.bookingCode}</dd></div><div><dt>ผู้ปกครอง</dt><dd>{room.customerName}</dd></div><div><dt>จำนวน</dt><dd>{room.petCount} ตัว</dd></div><div><dt>{room.occupancy === "upcoming" ? "เริ่ม" : "ถึง"}</dt><dd>{formatDateTime(room.occupancy === "upcoming" ? room.occupiedFrom! : room.occupiedUntil!)}</dd></div></dl>
              ) : <p className={styles.availableText}>พร้อมรับการจัดห้อง</p>}
            </article>
          ))}
        </div>
      ) : <EmptyBlock title="ยังไม่มีข้อมูลห้อง" detail="เพิ่มห้องใน Supabase ตาราง rooms แล้วรายการจะขึ้นอัตโนมัติ" />}
    </section>
  );
}

export function BookingsSection({ bookings }: { bookings: DashboardBooking[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const filtered = useMemo(() => bookings.filter((booking) => {
    const text = `${booking.bookingCode} ${booking.customerName} ${booking.phone} ${booking.petNames.join(" ")}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all"
      || (status === "active" && !["cancelled", "expired", "checked_out"].includes(booking.status))
      || booking.status === status;
    return matchesQuery && matchesStatus;
  }), [bookings, query, status]);

  return (
    <section className={styles.contentPanel}>
      <header className={styles.panelHeaderWithFilters}>
        <div><span>BOOKING LIST</span><h2>รายการจอง</h2><p>{filtered.length} จาก {bookings.length} รายการ</p></div>
        <div className={styles.filters}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ เบอร์โทร หรือชื่อแมว" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">กำลังดำเนินการ</option><option value="all">ทั้งหมด</option><option value="pending_deposit">รอตรวจมัดจำ</option><option value="confirmed">ยืนยันแล้ว</option><option value="checked_in">กำลังเข้าพัก</option><option value="checked_out">รับกลับแล้ว</option><option value="cancelled">ยกเลิก</option></select></div>
      </header>
      {filtered.length ? (
        <div className={styles.bookingList}>
          {filtered.map((booking) => (
            <article key={booking.bookingId}>
              <header><div><span>รหัสการจอง</span><strong>{booking.bookingCode}</strong></div><i className={`${styles.bookingStatus} ${styles[`booking_${booking.status}`]}`}>{statusLabel(booking.status)}</i></header>
              <div className={styles.bookingBody}>
                <dl><div><dt>ผู้ปกครอง</dt><dd>{booking.customerName}</dd></div><div><dt>เบอร์โทร</dt><dd>{booking.phone}</dd></div><div><dt>น้องแมว</dt><dd>{booking.petNames.join(", ") || `${booking.totalPets} ตัว`}</dd></div><div><dt>ห้อง</dt><dd>{booking.roomNames.join(", ") || roomTypeLabel(booking.roomType)}</dd></div></dl>
                <dl><div><dt>เข้าพัก</dt><dd>{formatDateTime(booking.checkInAt)}</dd></div><div><dt>รับกลับ</dt><dd>{formatDateTime(booking.checkOutAt)}</dd></div><div><dt>ค่าบริการรวม</dt><dd>{formatBaht(booking.totalAmount)}</dd></div><div><dt>มัดจำ / คงเหลือ</dt><dd>{formatBaht(booking.depositAmount)} / {formatBaht(booking.balanceAmount)}</dd></div></dl>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyBlock title="ไม่พบรายการจอง" detail="ลองเปลี่ยนคำค้นหรือสถานะ" />}
    </section>
  );
}

interface CustomersSectionProps {
  customers: DashboardCustomer[];
  accessToken: string;
  canPurge: boolean;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

export function CustomersSection({ customers, accessToken, canPurge, onChanged, onError }: CustomersSectionProps) {
  const [query, setQuery] = useState("");
  const [customerToDelete, setCustomerToDelete] = useState<DashboardCustomer | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const filtered = useMemo(() => customers.filter((customer) =>
    `${customer.fullName} ${customer.preferredName ?? ""} ${customer.phone} ${customer.miHomeAppId ?? ""} ${customer.lineDisplayName ?? ""} ${customer.pets.map((pet) => pet.petName).join(" ")}`
      .toLowerCase().includes(query.trim().toLowerCase())
  ), [customers, query]);

  const openDelete = (customer: DashboardCustomer) => {
    setCustomerToDelete(customer);
    setConfirmation("");
    setDeleteError("");
    onError("");
  };

  const closeDelete = () => {
    if (deleting) return;
    setCustomerToDelete(null);
    setConfirmation("");
    setDeleteError("");
  };

  const deleteCustomerFamily = async () => {
    if (!customerToDelete || deleting) return;
    if (confirmation.trim() !== customerToDelete.phone.trim()) {
      setDeleteError("เบอร์โทรไม่ตรง จึงยังไม่ได้ลบข้อมูล");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    onError("");
    try {
      const response = await fetch(`/api/staff/customers/${customerToDelete.customerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permanent: true, confirmation })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "ลบข้อมูลครอบครัวทดสอบไม่สำเร็จ");
      }
      const name = customerToDelete.fullName;
      setCustomerToDelete(null);
      setConfirmation("");
      await onChanged(`ลบข้อมูลทดสอบของ ${name} พร้อมน้องแมวและรายการจองที่เกี่ยวข้องแล้ว`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "ลบข้อมูลครอบครัวทดสอบไม่สำเร็จ";
      setDeleteError(message);
      onError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={styles.contentPanel}>
      <header className={styles.panelHeaderWithFilters}>
        <div><span>CUSTOMER & PET</span><h2>ลูกค้าและน้องแมว</h2><p>{filtered.length} จาก {customers.length} ครอบครัว</p></div>
        <div className={styles.filters}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร Mi Home ID, LINE หรือชื่อแมว" />
          {canPurge && <StaffBulkPurge scope="customers" title="ลบลูกค้าและน้องแมวทั้งหมด" description="ลูกค้าและน้องแมวทั้งหมด รวมถึงรายการจอง การชำระเงิน และข้อมูลที่เชื่อมโยงทั้งหมดจะถูกลบถาวร ห้องพักจะยังอยู่ ข้อมูลกู้คืนไม่ได้" accessToken={accessToken} onChanged={onChanged} onError={onError} />}
        </div>
      </header>
      {filtered.length ? (
        <div className={styles.customerList}>
          {filtered.map((customer) => (
            <article className={styles.customerCard} key={customer.customerId}>
              <header><div className={styles.avatar}>{customer.fullName.trim().charAt(0) || "L"}</div><div><h3>{customer.fullName}</h3><span>{customer.preferredName ? `ชื่อเรียก ${customer.preferredName}` : customer.phone}</span></div><i className={customer.hasLineAccount ? styles.lineOn : styles.lineOff}>{customer.hasLineAccount ? "LINE ✓" : "ไม่มี LINE"}</i></header>
              <div className={styles.customerBody}>
                <dl className={styles.customerDetails}>
                  <div><dt>เบอร์โทร</dt><dd>{customer.phone}</dd></div>
                  <div><dt>Mi Home ID</dt><dd>{customer.miHomeAppId || "ยังไม่ระบุ"}</dd></div>
                  <div><dt>ชื่อ LINE</dt><dd>{customer.lineDisplayName || (customer.hasLineAccount ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ")}</dd></div>
                  <div><dt>จำนวนการจอง</dt><dd>{customer.bookingCount} ครั้ง</dd></div>
                  <div><dt>การจองล่าสุด</dt><dd>{customer.latestBookingAt ? formatDateTime(customer.latestBookingAt) : "ยังไม่มี"}</dd></div>
                </dl>
                <section className={styles.petList}>
                  <header><span>ข้อมูลน้องแมว</span><strong>{customer.pets.length} ตัว</strong></header>
                  {customer.pets.length ? customer.pets.map((pet) => (
                    <article key={pet.petId}>
                      <div><strong>{pet.petName}</strong><span>{pet.breed || "ยังไม่ระบุสายพันธุ์"}</span></div>
                      <dl><div><dt>เพศ</dt><dd>{pet.sex || "ไม่ระบุ"}</dd></div><div><dt>อายุ</dt><dd>{pet.ageText || "ไม่ระบุ"}</dd></div></dl>
                    </article>
                  )) : <em>ยังไม่มีข้อมูลน้องแมว</em>}
                </section>
              </div>
              {canPurge && <footer className={styles.customerActions}><span>สำหรับล้างข้อมูลช่วงทดสอบเท่านั้น</span><button type="button" onClick={() => openDelete(customer)}>ลบข้อมูลครอบครัวทดสอบ</button></footer>}
            </article>
          ))}
        </div>
      ) : <EmptyBlock title="ไม่พบข้อมูลลูกค้า" detail="ลองเปลี่ยนคำค้น" />}
      {customerToDelete && (
        <StaffActionDialog
          eyebrow="DELETE TEST FAMILY"
          title={`ลบข้อมูลของ ${customerToDelete.fullName}`}
          description={`ระบบจะลบลูกค้า น้องแมว ${customerToDelete.pets.length} ตัว และรายการจอง ${customerToDelete.bookingCount} รายการ รวมถึงการชำระเงินและข้อมูลที่เกี่ยวข้องทั้งหมด ข้อมูลจะกู้คืนไม่ได้`}
          confirmLabel="ลบข้อมูลครอบครัวถาวร"
          busyLabel="กำลังลบข้อมูลจาก Supabase..."
          busy={deleting}
          tone="danger"
          requiredCode={customerToDelete.phone}
          confirmation={confirmation}
          error={deleteError}
          onConfirmationChange={setConfirmation}
          onCancel={closeDelete}
          onConfirm={() => void deleteCustomerFamily()}
        />
      )}
    </section>
  );
}