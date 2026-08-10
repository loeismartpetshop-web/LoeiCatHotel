"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import styles from "./staff.module.css";

const SESSION_KEY = "loei-cat-hotel-staff-session-v1";

interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

interface StaffInfo {
  fullName: string;
  role: string;
}

interface PendingDeposit {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  phone: string;
  hasLineAccount: boolean;
  petNames: string[];
  petCount: number;
  checkInAt: string;
  checkOutAt: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  notifiedAt: string;
}

interface DepositResponse {
  staff: StaffInfo;
  pendingDeposits: PendingDeposit[];
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

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "front_desk") return "พนักงานหน้าร้าน";
  return role;
}

export function StaffDashboard() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingTotal = useMemo(
    () => pendingDeposits.reduce((sum, item) => sum + item.depositAmount, 0),
    [pendingDeposits]
  );

  const loadDeposits = async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff/deposits", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        window.sessionStorage.removeItem(SESSION_KEY);
        setAccessToken("");
        setStaff(null);
        throw new Error(response.status === 403
          ? "บัญชีนี้ไม่มีสิทธิ์ตรวจการชำระเงิน"
          : "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
      }
      const payload = await response.json() as DepositResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "โหลดรายการไม่สำเร็จ");
      setStaff(payload.staff);
      setPendingDeposits(payload.pendingDeposits);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/staff/config", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PublicConfig & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "ระบบล็อกอินยังตั้งค่าไม่ครบ");
        if (!active) return;
        setConfig(payload);
        const savedToken = window.sessionStorage.getItem(SESSION_KEY) ?? "";
        if (savedToken) {
          setAccessToken(savedToken);
          await loadDeposits(savedToken);
        } else {
          setLoading(false);
        }
      })
      .catch((configError) => {
        if (!active) return;
        setError(configError instanceof Error ? configError.message : "ระบบล็อกอินยังตั้งค่าไม่ครบ");
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config || authenticating) return;
    setAuthenticating(true);
    setError("");
    try {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: config.supabasePublishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const payload = await response.json() as { access_token?: string; error_description?: string; msg?: string };
      if (!response.ok || !payload.access_token) {
        throw new Error(payload.error_description ?? payload.msg ?? "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
      window.sessionStorage.setItem(SESSION_KEY, payload.access_token);
      setAccessToken(payload.access_token);
      setPassword("");
      await loadDeposits(payload.access_token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setAuthenticating(false);
    }
  };

  const signOut = () => {
    window.sessionStorage.removeItem(SESSION_KEY);
    setAccessToken("");
    setStaff(null);
    setPendingDeposits([]);
    setSuccess("");
    setError("");
  };

  const confirmDeposit = async (item: PendingDeposit) => {
    const approved = window.confirm(
      `ตรวจสลิปใน LINE OA แล้วใช่ไหม?\n\n${item.bookingCode}\nมัดจำ ${formatBaht(item.depositAmount)}\n\nเมื่อยืนยัน ระบบจะส่งบิลใบที่สองให้ลูกค้าทันที`
    );
    if (!approved || confirmingCode || !accessToken) return;

    setConfirmingCode(item.bookingCode);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/staff/deposits/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bookingCode: item.bookingCode })
      });
      const payload = await response.json() as { error?: string; checkinReceiptSent?: boolean };
      if (response.status === 401 || response.status === 403) {
        signOut();
        throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
      }
      if (!response.ok) throw new Error(payload.error ?? "ยืนยันมัดจำไม่สำเร็จ");
      setPendingDeposits((current) => current.filter((deposit) => deposit.bookingCode !== item.bookingCode));
      setSuccess(`ยืนยันมัดจำ ${item.bookingCode} แล้ว และส่งบิลวันเช็กอินเข้า LINE ลูกค้าเรียบร้อย`);
    } catch (confirmationError) {
      setError(confirmationError instanceof Error ? confirmationError.message : "ยืนยันมัดจำไม่สำเร็จ");
    } finally {
      setConfirmingCode("");
    }
  };

  if (!accessToken) {
    return (
      <main className={styles.loginShell}>
        <section className={styles.loginCard}>
          <div className={styles.loginBrand}>
            <Image src="/loeicathotel-logo.webp" alt="โลโก้ LOEI CAT HOTEL" width={84} height={84} priority />
            <div><strong>LOEI CAT HOTEL</strong><span>Staff Dashboard</span></div>
          </div>
          <div className={styles.loginIntro}>
            <span>BACK OFFICE</span>
            <h1>เข้าสู่ระบบพนักงาน</h1>
            <p>เฉพาะ Owner และพนักงานหน้าร้านที่ได้รับสิทธิ์เท่านั้น</p>
          </div>
          {error && <div className={styles.errorBox} role="alert">{error}</div>}
          <form className={styles.loginForm} onSubmit={signIn}>
            <label><span>อีเมลพนักงาน</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label><span>รหัสผ่าน</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button type="submit" disabled={!config || authenticating || loading}>{authenticating ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ Dashboard"}</button>
          </form>
          <small className={styles.loginFoot}>ข้อมูลการเงินถูกตรวจสิทธิ์ผ่าน Supabase Auth ทุกครั้ง</small>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.dashboardShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image src="/loeicathotel-logo.webp" alt="" width={52} height={52} priority />
          <div><strong>LOEI CAT HOTEL</strong><span>ระบบจัดการโรงแรมแมว</span></div>
        </div>
        <nav className={styles.nav} aria-label="เมนูหลัก">
          <button type="button" disabled><span>⌂</span> ภาพรวมวันนี้</button>
          <button type="button" disabled><span>▦</span> ตารางห้อง</button>
          <button type="button" disabled><span>≡</span> รายการจอง</button>
          <button type="button" className={styles.active}><span>฿</span> การชำระเงิน</button>
          <button type="button" disabled><span>♙</span> ลูกค้าและแมว</button>
        </nav>
        <div className={styles.sidebarFoot}><i /> เชื่อมต่อ Supabase และ LINE OA</div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div><span className={styles.eyebrow}>PAYMENT REVIEW</span><h1>ตรวจสอบมัดจำ</h1><p>ตรวจรูปสลิปใน LINE OA ก่อนกดยืนยันทุกครั้ง</p></div>
          <div className={styles.userActions}>
            <div><strong>{staff?.fullName ?? "พนักงาน"}</strong><span>{roleLabel(staff?.role ?? "")}</span></div>
            <button type="button" onClick={() => void loadDeposits(accessToken)} disabled={loading}>รีเฟรช</button>
            <button type="button" onClick={signOut}>ออกจากระบบ</button>
          </div>
        </header>

        {success && <div className={styles.successBox} role="status">✓ {success}</div>}
        {error && <div className={styles.errorBox} role="alert">{error}</div>}

        <section className={styles.stats} aria-label="สรุปรายการรอตรวจ">
          <article><span>รอตรวจสลิป</span><strong>{pendingDeposits.length}</strong><small>รายการ</small></article>
          <article><span>ยอดมัดจำรอตรวจ</span><strong>{formatBaht(pendingTotal)}</strong><small>ตรวจจากภาพใน LINE OA</small></article>
          <article><span>หลังยืนยัน</span><strong>ส่งทันที</strong><small>บิลยอดคงเหลือเข้าหาลูกค้า</small></article>
        </section>

        <section className={styles.reviewPanel}>
          <header>
            <div><span>DEPOSIT QUEUE</span><h2>รายการมัดจำรอตรวจ</h2></div>
            <a href="https://manager.line.biz/" target="_blank" rel="noreferrer">เปิด LINE OA Manager ↗</a>
          </header>

          {loading ? (
            <div className={styles.emptyState}><span className={styles.spinner} /><h3>กำลังโหลดรายการ...</h3></div>
          ) : pendingDeposits.length === 0 ? (
            <div className={styles.emptyState}><div>✓</div><h3>ไม่มีสลิปรอตรวจ</h3><p>รายการใหม่จะขึ้นหลังลูกค้าส่งสลิปและกดยืนยันมัดจำใน LINE</p></div>
          ) : (
            <div className={styles.depositList}>
              {pendingDeposits.map((item) => (
                <article className={styles.depositCard} key={item.bookingId}>
                  <div className={styles.depositHeader}>
                    <div><span>รหัสการจอง</span><strong>{item.bookingCode}</strong></div>
                    <span className={styles.pendingBadge}>รอตรวจสลิป</span>
                  </div>
                  <div className={styles.depositGrid}>
                    <dl>
                      <div><dt>ผู้ปกครอง</dt><dd>{item.customerName}</dd></div>
                      <div><dt>เบอร์โทร</dt><dd>{item.phone}</dd></div>
                      <div><dt>น้องแมว</dt><dd>{item.petNames.length ? item.petNames.join(", ") : `${item.petCount} ตัว`}</dd></div>
                      <div><dt>เข้าพัก</dt><dd>{formatDateTime(item.checkInAt)}</dd></div>
                      <div><dt>รับกลับ</dt><dd>{formatDateTime(item.checkOutAt)}</dd></div>
                    </dl>
                    <div className={styles.amountCard}>
                      <span>ยอดมัดจำที่ต้องตรงกับสลิป</span>
                      <strong>{formatBaht(item.depositAmount)}</strong>
                      <small>ยอดคงเหลือวันเช็กอิน {formatBaht(item.balanceAmount)}</small>
                    </div>
                  </div>
                  {!item.hasLineAccount && <div className={styles.warningBox}>บัญชีลูกค้าไม่มี LINE user ID จึงยังส่งบิลใบที่สองไม่ได้</div>}
                  <footer>
                    <span>ลูกค้าแจ้งเมื่อ {formatDateTime(item.notifiedAt)}</span>
                    <button
                      type="button"
                      disabled={!item.hasLineAccount || Boolean(confirmingCode)}
                      onClick={() => void confirmDeposit(item)}
                    >
                      {confirmingCode === item.bookingCode ? "กำลังยืนยันและส่งบิล..." : "✓ ยืนยันสลิปและส่งบิลใบที่สอง"}
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
