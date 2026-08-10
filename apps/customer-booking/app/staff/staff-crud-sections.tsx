"use client";

import { useMemo, useState } from "react";
import type { DashboardBooking, DashboardRoom } from "./staff-sections";
import crud from "./staff-crud.module.css";
import styles from "./staff-sections.module.css";

interface ManagerProps {
  accessToken: string;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

interface RoomForm {
  roomId?: string;
  roomCode: string;
  displayName: string;
  roomType: string;
  minimumPets: number;
  maximumPets: number;
  status: string;
}

interface BookingForm {
  bookingId: string;
  bookingCode: string;
  checkInAt: string;
  checkOutAt: string;
  status: string;
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

function formatBaht(amount: number): string {
  return `${Number(amount).toLocaleString("th-TH")} บาท`;
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

function toBangkokInput(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

function bangkokInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

async function errorFromResponse(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function RoomsManager({ rooms, accessToken, onChanged, onError }: ManagerProps & { rooms: DashboardRoom[] }) {
  const [editor, setEditor] = useState<RoomForm | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => setEditor({
    roomCode: "",
    displayName: "",
    roomType: "condo",
    minimumPets: 1,
    maximumPets: 2,
    status: "active"
  });

  const openEdit = (room: DashboardRoom) => setEditor({
    roomId: room.roomId,
    roomCode: room.roomCode,
    displayName: room.displayName,
    roomType: room.roomType,
    minimumPets: room.minimumPets,
    maximumPets: room.maximumPets,
    status: room.status
  });

  const saveRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    onError("");
    try {
      const response = await fetch(editor.roomId ? `/api/staff/rooms/${editor.roomId}` : "/api/staff/rooms", {
        method: editor.roomId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(editor)
      });
      if (!response.ok) throw new Error(await errorFromResponse(response, "บันทึกข้อมูลห้องไม่สำเร็จ"));
      const message = editor.roomId ? `แก้ไขห้อง ${editor.roomCode} แล้ว` : `เพิ่มห้อง ${editor.roomCode} แล้ว`;
      setEditor(null);
      await onChanged(message);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "บันทึกข้อมูลห้องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const archiveRoom = async (room: DashboardRoom) => {
    if (!window.confirm(`ปิดใช้งานห้อง ${room.roomCode} — ${room.displayName} ใช่ไหม?\n\nประวัติเดิมจะยังอยู่และห้องจะหายจากรายการใช้งาน`)) return;
    onError("");
    try {
      const response = await fetch(`/api/staff/rooms/${room.roomId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(await errorFromResponse(response, "ปิดใช้งานห้องไม่สำเร็จ"));
      await onChanged(`ปิดใช้งานห้อง ${room.roomCode} แล้ว`);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "ปิดใช้งานห้องไม่สำเร็จ");
    }
  };

  return (
    <section className={styles.contentPanel}>
      <header><div><span>ROOM BOARD</span><h2>สถานะห้องพัก</h2><p>เพิ่ม แก้ไข หรือปิดใช้งานห้องได้จากหน้านี้</p></div><button className={crud.primaryAction} type="button" onClick={openNew}>＋ เพิ่มห้อง</button></header>
      {rooms.length ? (
        <div className={styles.roomGrid}>
          {rooms.map((room) => (
            <article className={styles.roomCard} key={room.roomId}>
              <header><div><span>{room.roomCode}</span><h3>{room.displayName}</h3></div><i className={`${styles.roomStatus} ${styles[`room_${room.occupancy}`]}`}>{room.occupancy === "occupied" ? "มีน้องเข้าพัก" : room.occupancy === "upcoming" ? "มีคิวถัดไป" : room.occupancy === "available" ? "ว่าง" : room.occupancy === "maintenance" ? "ปิดซ่อม" : "ปิดใช้งาน"}</i></header>
              <div className={styles.roomMeta}><span>{roomTypeLabel(room.roomType)}</span><span>รองรับ {room.minimumPets}–{room.maximumPets} ตัว</span></div>
              {room.bookingCode ? <dl><div><dt>การจอง</dt><dd>{room.bookingCode}</dd></div><div><dt>ผู้ปกครอง</dt><dd>{room.customerName}</dd></div><div><dt>จำนวน</dt><dd>{room.petCount} ตัว</dd></div><div><dt>{room.occupancy === "upcoming" ? "เริ่ม" : "ถึง"}</dt><dd>{formatDateTime(room.occupancy === "upcoming" ? room.occupiedFrom! : room.occupiedUntil!)}</dd></div></dl> : <p className={styles.availableText}>พร้อมรับการจัดห้อง</p>}
              <footer className={crud.cardActions}><button type="button" onClick={() => openEdit(room)}>แก้ไข</button><button type="button" className={crud.dangerText} onClick={() => void archiveRoom(room)}>ปิดใช้งาน</button></footer>
            </article>
          ))}
        </div>
      ) : <div className={styles.sectionEmpty}><div>＋</div><h3>ยังไม่มีข้อมูลห้อง</h3><p>กด “เพิ่มห้อง” เพื่อเริ่มสร้างตารางห้อง</p></div>}

      {editor && (
        <div className={crud.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}>
          <form className={crud.modal} onSubmit={saveRoom} role="dialog" aria-modal="true" aria-label={editor.roomId ? "แก้ไขห้อง" : "เพิ่มห้อง"}>
            <header><div><span>ROOM FORM</span><h3>{editor.roomId ? "แก้ไขข้อมูลห้อง" : "เพิ่มห้องใหม่"}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={saving}>×</button></header>
            <div className={crud.formGrid}>
              <label><span>รหัสห้อง</span><input value={editor.roomCode} onChange={(event) => setEditor({ ...editor, roomCode: event.target.value.toUpperCase() })} placeholder="เช่น C01" required maxLength={30} /></label>
              <label><span>ชื่อแสดง</span><input value={editor.displayName} onChange={(event) => setEditor({ ...editor, displayName: event.target.value })} placeholder="เช่น ห้องคอนโด 01" required maxLength={100} /></label>
              <label><span>ประเภทห้อง</span><select value={editor.roomType} onChange={(event) => setEditor({ ...editor, roomType: event.target.value })}><option value="condo">ห้องคอนโด</option><option value="villa">ห้องวิลล่า</option><option value="reserve">ห้องสำรอง</option></select></label>
              <label><span>สถานะ</span><select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value })}><option value="active">เปิดใช้งาน</option><option value="maintenance">ปิดซ่อม</option><option value="inactive">ปิดใช้งาน</option></select></label>
              <label><span>จำนวนน้อยสุด</span><input type="number" min={1} max={30} value={editor.minimumPets} onChange={(event) => setEditor({ ...editor, minimumPets: Number(event.target.value) })} required /></label>
              <label><span>จำนวนสูงสุด</span><input type="number" min={1} max={30} value={editor.maximumPets} onChange={(event) => setEditor({ ...editor, maximumPets: Number(event.target.value) })} required /></label>
            </div>
            <footer><button type="button" onClick={() => setEditor(null)} disabled={saving}>ยกเลิก</button><button type="submit" className={crud.saveButton} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูลห้อง"}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}

export function BookingsManager({ bookings, accessToken, onChanged, onError }: ManagerProps & { bookings: DashboardBooking[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [editor, setEditor] = useState<BookingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => bookings.filter((booking) => {
    const text = `${booking.bookingCode} ${booking.customerName} ${booking.phone} ${booking.petNames.join(" ")}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (status === "all"
      || (status === "active" && !["cancelled", "expired", "checked_out"].includes(booking.status))
      || booking.status === status);
  }), [bookings, query, status]);

  const openEdit = (booking: DashboardBooking) => setEditor({
    bookingId: booking.bookingId,
    bookingCode: booking.bookingCode,
    checkInAt: toBangkokInput(booking.checkInAt),
    checkOutAt: toBangkokInput(booking.checkOutAt),
    status: booking.status
  });

  const saveBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    onError("");
    try {
      const response = await fetch(`/api/staff/bookings/${editor.bookingId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ checkInAt: bangkokInputToIso(editor.checkInAt), checkOutAt: bangkokInputToIso(editor.checkOutAt), status: editor.status })
      });
      if (!response.ok) throw new Error(await errorFromResponse(response, "แก้ไขรายการจองไม่สำเร็จ"));
      const code = editor.bookingCode;
      setEditor(null);
      await onChanged(`แก้ไขรายการจอง ${code} แล้ว`);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "แก้ไขรายการจองไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async (booking: DashboardBooking) => {
    if (!window.confirm(`ยกเลิกรายการจอง ${booking.bookingCode} ใช่ไหม?\n\nระบบจะไม่ลบประวัติหรือยอดที่ชำระแล้ว แต่จะยกเลิกรายการและปล่อยห้อง`)) return;
    onError("");
    try {
      const response = await fetch(`/api/staff/bookings/${booking.bookingId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(await errorFromResponse(response, "ยกเลิกรายการจองไม่สำเร็จ"));
      await onChanged(`ยกเลิกรายการจอง ${booking.bookingCode} แล้ว`);
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "ยกเลิกรายการจองไม่สำเร็จ");
    }
  };

  return (
    <section className={styles.contentPanel}>
      <header className={styles.panelHeaderWithFilters}><div><span>BOOKING LIST</span><h2>รายการจอง</h2><p>{filtered.length} จาก {bookings.length} รายการ</p></div><div className={styles.filters}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ เบอร์โทร หรือชื่อแมว" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">กำลังดำเนินการ</option><option value="all">ทั้งหมด</option><option value="pending_deposit">รอตรวจมัดจำ</option><option value="confirmed">ยืนยันแล้ว</option><option value="checked_in">กำลังเข้าพัก</option><option value="checked_out">รับกลับแล้ว</option><option value="cancelled">ยกเลิก</option></select><a className={crud.primaryAction} href="/" target="_blank" rel="noreferrer">＋ เพิ่มรายการจอง</a></div></header>
      {filtered.length ? <div className={styles.bookingList}>{filtered.map((booking) => <article key={booking.bookingId}><header><div><span>รหัสการจอง</span><strong>{booking.bookingCode}</strong></div><i className={`${styles.bookingStatus} ${styles[`booking_${booking.status}`]}`}>{statusLabel(booking.status)}</i></header><div className={styles.bookingBody}><dl><div><dt>ผู้ปกครอง</dt><dd>{booking.customerName}</dd></div><div><dt>เบอร์โทร</dt><dd>{booking.phone}</dd></div><div><dt>น้องแมว</dt><dd>{booking.petNames.join(", ") || `${booking.totalPets} ตัว`}</dd></div><div><dt>ห้อง</dt><dd>{booking.roomNames.join(", ") || roomTypeLabel(booking.roomType)}</dd></div></dl><dl><div><dt>เข้าพัก</dt><dd>{formatDateTime(booking.checkInAt)}</dd></div><div><dt>รับกลับ</dt><dd>{formatDateTime(booking.checkOutAt)}</dd></div><div><dt>ค่าบริการรวม</dt><dd>{formatBaht(booking.totalAmount)}</dd></div><div><dt>มัดจำ / คงเหลือ</dt><dd>{formatBaht(booking.depositAmount)} / {formatBaht(booking.balanceAmount)}</dd></div></dl></div><footer className={crud.bookingActions}><button type="button" disabled={["cancelled", "expired"].includes(booking.status)} onClick={() => openEdit(booking)}>แก้ไขวันเวลา/สถานะ</button><button type="button" className={crud.dangerText} disabled={["cancelled", "checked_out"].includes(booking.status)} onClick={() => void cancelBooking(booking)}>ยกเลิกรายการ</button></footer></article>)}</div> : <div className={styles.sectionEmpty}><div>✓</div><h3>ไม่พบรายการจอง</h3><p>ลองเปลี่ยนคำค้นหรือสถานะ</p></div>}

      {editor && <div className={crud.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}><form className={crud.modal} onSubmit={saveBooking} role="dialog" aria-modal="true" aria-label="แก้ไขรายการจอง"><header><div><span>BOOKING EDIT</span><h3>{editor.bookingCode}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={saving}>×</button></header><div className={crud.formGrid}><label><span>วันเวลาเข้าพัก</span><input type="datetime-local" value={editor.checkInAt} onChange={(event) => setEditor({ ...editor, checkInAt: event.target.value })} required /></label><label><span>วันเวลารับกลับ</span><input type="datetime-local" value={editor.checkOutAt} onChange={(event) => setEditor({ ...editor, checkOutAt: event.target.value })} required /></label><label className={crud.fullField}><span>สถานะรายการจอง</span><select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value })}><option value="draft">แบบร่าง</option><option value="held">ล็อกห้องชั่วคราว</option><option value="pending_deposit">รอตรวจมัดจำ</option><option value="confirmed">ยืนยันแล้ว</option><option value="checked_in">กำลังเข้าพัก</option><option value="checked_out">รับกลับแล้ว</option><option value="cancellation_review">ตรวจสอบยกเลิก</option></select></label></div><div className={crud.notice}>การแก้ไขวันเวลาจะปรับช่วงเวลาของห้องที่จัดไว้ให้ตรงกัน และทุกการเปลี่ยนแปลงจะถูกบันทึกใน Audit Log</div><footer><button type="button" onClick={() => setEditor(null)} disabled={saving}>ยกเลิก</button><button type="submit" className={crud.saveButton} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกรายการจอง"}</button></footer></form></div>}
    </section>
  );
}
