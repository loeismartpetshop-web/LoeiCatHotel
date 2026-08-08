"use client";

import {
  calculateDeposit,
  calculateQuote,
  HOTEL_MAXIMUM_PETS,
  type RatePlanCode,
  type RoomType
} from "@loei-cat-hotel/domain";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyTheme,
  LOGO_THEME,
  sanitizeTheme,
  THEME_STORAGE_KEY,
  ThemeSettingsPanel,
  type ThemeSettings
} from "./theme-settings";
import { getLineIdToken } from "./line-client";

type BookingMode = "overnight" | "hourly";
type Step = 1 | 2 | 3 | 4 | 5;

const PAYMENT_ACCOUNT = "KPS004KB000002201754";
const PAYMENT_ACCOUNT_NAME = "บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด";

interface BookingForm {
  mode: BookingMode;
  checkInDate: string;
  checkOutDate: string;
  visitDate: string;
  startTime: string;
  endTime: string;
  petCount: number;
  roomType: Exclude<RoomType, "reserve">;
  ratePlan: RatePlanCode;
  guardianName: string;
  phone: string;
  petNames: string[];
  clinicName: string;
  clinicPhone: string;
  emergencyConsent: boolean;
  careFlags: string[];
  termsAccepted: boolean;
}

const initialForm: BookingForm = {
  mode: "overnight",
  checkInDate: "",
  checkOutDate: "",
  visitDate: "",
  startTime: "09:00",
  endTime: "15:00",
  petCount: 2,
  roomType: "condo",
  ratePlan: "HOTEL_SUPPLIED",
  guardianName: "",
  phone: "",
  petNames: ["", ""],
  clinicName: "",
  clinicPhone: "",
  emergencyConsent: false,
  careFlags: [],
  termsAccepted: false
};

const steps = ["วันเข้าพัก", "ห้องและแพ็กเกจ", "ข้อมูลน้องแมว", "ตรวจสอบ"];

const ratePlans: Array<{ code: RatePlanCode; title: string; detail: string; price: number }> = [
  { code: "HOTEL_SUPPLIED", title: "โรงแรมจัดเตรียมให้", detail: "รวมอาหาร น้ำ และทราย", price: 250 },
  { code: "OWNER_SUPPLIED", title: "นำอาหารและทรายมาเอง", detail: "นำอาหารและทรายเต้าหู้ของน้องมาเอง", price: 150 }
];

const careOptions = [
  { value: "medication", label: "มียาที่ต้องให้" },
  { value: "condition", label: "มีโรคประจำตัวที่ไม่ติดต่อ" },
  { value: "shy", label: "ขี้กลัว ต้องให้เวลาปรับตัว" },
  { value: "none", label: "ไม่มีการดูแลพิเศษ" }
];

function formatBaht(value: number): string {
  return `${value.toLocaleString("th-TH")} บาท`;
}

function countNights(start: string, end: string): number {
  if (!start || !end) return 1;
  const startTime = new Date(`${start}T00:00:00+07:00`).getTime();
  const endTime = new Date(`${end}T00:00:00+07:00`).getTime();
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000));
}

function formatDateRange(form: BookingForm): string {
  const formatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });
  if (form.mode === "hourly") {
    if (!form.visitDate) return "ยังไม่ได้เลือกวัน";
    return `${formatter.format(new Date(`${form.visitDate}T12:00:00+07:00`))} · ${form.startTime}–${form.endTime} น.`;
  }
  if (!form.checkInDate || !form.checkOutDate) return "ยังไม่ได้เลือกวัน";
  return `${formatter.format(new Date(`${form.checkInDate}T12:00:00+07:00`))} – ${formatter.format(new Date(`${form.checkOutDate}T12:00:00+07:00`))}`;
}

function formatReceiptDate(value: string): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00+07:00`));
}

export function BookingApp() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [paymentAcknowledged, setPaymentAcknowledged] = useState(false);
  const [bookingCode, setBookingCode] = useState("");
  const [lineMessageSent, setLineMessageSent] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef<string | null>(null);
  const lineIdToken = useRef<string | null>(null);
  const [theme, setTheme] = useState<ThemeSettings>(LOGO_THEME);
  const [themeOpen, setThemeOpen] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) setTheme(sanitizeTheme(JSON.parse(saved) as Partial<ThemeSettings>));
    } catch {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void getLineIdToken()
      .then((token) => { lineIdToken.current = token; })
      .catch((lineError) => { console.warn("LIFF initialization failed", lineError); });
  }, []);

  const handleLogoTap = () => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) window.clearTimeout(logoTapTimer.current);
    if (logoTapCount.current >= 3) {
      logoTapCount.current = 0;
      setThemeOpen(true);
      return;
    }
    logoTapTimer.current = window.setTimeout(() => { logoTapCount.current = 0; }, 850);
  };

  const saveTheme = () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    setThemeOpen(false);
  };

  const resetTheme = () => {
    setTheme(LOGO_THEME);
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  };

  const nights = form.mode === "hourly" ? 1 : countNights(form.checkInDate, form.checkOutDate);
  const activeRate: RatePlanCode = form.mode === "hourly" ? "HOURLY" : form.ratePlan;
  const total = useMemo(
    () => calculateQuote({ ratePlan: activeRate, petCount: form.petCount, nights }),
    [activeRate, form.petCount, nights]
  );
  const deposit = calculateDeposit(total);

  const updateForm = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const changePetCount = (nextCount: number) => {
    const count = Math.min(HOTEL_MAXIMUM_PETS, Math.max(1, nextCount));
    setForm((current) => {
      const petNames = Array.from({ length: count }, (_, index) => current.petNames[index] ?? "");
      let roomType = current.roomType;
      if (count === 1) roomType = "villa";
      if (count > 2) roomType = "condo";
      return { ...current, petCount: count, petNames, roomType };
    });
    setError("");
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (form.mode === "overnight") {
        if (!form.checkInDate || !form.checkOutDate) {
          setError("กรุณาเลือกวันเข้าพักและวันรับกลับ");
          return false;
        }
        if (form.checkOutDate <= form.checkInDate) {
          setError("วันรับกลับต้องอยู่หลังวันเข้าพัก");
          return false;
        }
      } else {
        if (!form.visitDate) {
          setError("กรุณาเลือกวันที่ฝากน้อง");
          return false;
        }
        const [startHour = 0, startMinute = 0] = form.startTime.split(":").map(Number);
        const [endHour = 0, endMinute = 0] = form.endTime.split(":").map(Number);
        const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
        if (duration <= 0) {
          setError("เวลารับกลับต้องอยู่หลังเวลาฝาก");
          return false;
        }
        if (duration > 360) {
          setError("ฝากเกิน 6 ชั่วโมงจะคิดเป็นราคาค้างคืน กรุณาเลือกแบบค้างคืน");
          return false;
        }
      }
    }
    if (step === 2 && form.petCount > 4) {
      setError("การจองมากกว่า 4 ตัวต้องให้พนักงานช่วยจัดหลายห้อง กรุณาติดต่อ LINE OA @002lffmk");
      return false;
    }
    if (step === 3) {
      if (!form.guardianName.trim()) {
        setError("กรุณากรอกชื่อผู้ปกครอง");
        return false;
      }
      if (!/^0\d{8,9}$/.test(form.phone.replaceAll(/[-\s]/g, ""))) {
        setError("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");
        return false;
      }
      if (form.petNames.some((name) => !name.trim())) {
        setError("กรุณากรอกชื่อแมวให้ครบทุกตัว");
        return false;
      }
      if (!form.clinicName.trim() && !form.emergencyConsent) {
        setError("กรุณาระบุสถานพยาบาลประจำ หรืออนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือ");
        return false;
      }
    }
    if (step === 4) {
      if (!paymentAcknowledged) {
        setError("กรุณาตรวจสอบยอดมัดจำและเลขบัญชีก่อนส่งคำขอจอง");
        return false;
      }
      if (!form.termsAccepted) {
        setError("กรุณายืนยันข้อมูลและยินยอมให้จัดเก็บข้อมูลเพื่อดำเนินคำขอจอง");
        return false;
      }
    }
    return true;
  };

  const goNext = async () => {
    if (!validateStep() || submitting) return;
    if (step !== 4) {
      setStep((current) => Math.min(5, current + 1) as Step);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    setError("");
    requestId.current ??= window.crypto.randomUUID();
    try {
      if (!lineIdToken.current) {
        try {
          lineIdToken.current = await getLineIdToken();
        } catch (lineError) {
          console.warn("Unable to obtain LINE ID token", lineError);
        }
      }
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ratePlan: activeRate,
          idempotencyKey: requestId.current,
          lineIdToken: lineIdToken.current ?? undefined
        })
      });
      const result = await response.json() as { bookingCode?: string; lineMessageSent?: boolean; error?: string };
      if (!response.ok || !result.bookingCode) throw new Error(result.error ?? "บันทึกคำขอไม่สำเร็จ");
      setBookingCode(result.bookingCode);
      setLineMessageSent(Boolean(result.lineMessageSent));
      setStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setStep((current) => Math.max(1, current - 1) as Step);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleCareFlag = (value: string) => {
    setForm((current) => {
      if (value === "none") return { ...current, careFlags: ["none"] };
      const withoutNone = current.careFlags.filter((item) => item !== "none");
      return {
        ...current,
        careFlags: withoutNone.includes(value)
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value]
      };
    });
  };


  const copyPaymentAccount = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_ACCOUNT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("คัดลอกเลขบัญชีอัตโนมัติไม่ได้ กรุณากดค้างที่เลขบัญชีเพื่อคัดลอก");
    }
  };

  const selectedRate = ratePlans.find((plan) => plan.code === form.ratePlan) ?? ratePlans[0]!;

  return (
    <main className="site-shell">
      <section className="brand-panel" aria-label="ข้อมูลโรงแรม">
        <div className="brand-lockup">
          <button type="button" className="brand-logo-trigger" onClick={handleLogoTap} aria-label="โลโก้ LOEI CAT HOTEL">
            <Image className="brand-mark" src="/loeicathotel-logo.webp" alt="" width={96} height={96} priority />
          </button>
          <div><strong>LOEI CAT HOTEL</strong><span>โรงแรมแมวเมืองเลย</span></div>
        </div>
        <div className="brand-copy">
          <p className="eyebrow">พักสบาย ดูแลเหมือนอยู่บ้าน</p>
          <h1>วันหยุดของคุณ<br />คือวันพักผ่อนของน้อง</h1>
          <p>ห้องพักส่วนตัว ดูแลอาหาร น้ำ สุขภาพ และส่งต่อข้อมูลสำคัญถึงพนักงานอย่างเป็นระบบ</p>
        </div>
        <div className="trust-grid">
          <div><strong>30</strong><span>รับสูงสุดต่อวัน</span></div>
          <div><strong>08:30–18:00</strong><span>เปิดบริการทุกวัน</span></div>
          <div><strong>1 ครอบครัว</strong><span>ต่อหนึ่งห้องพัก</span></div>
        </div>
        <div className="contact-note">LINE OA <b>@002lffmk</b> · โทร 083-917-8794</div>
      </section>

      <section className="booking-panel">
        <header className="mobile-header">
          <div className="brand-lockup compact">
            <button type="button" className="brand-logo-trigger" onClick={handleLogoTap} aria-label="โลโก้ LOEI CAT HOTEL">
              <Image className="brand-mark" src="/loeicathotel-logo.webp" alt="" width={96} height={96} priority />
            </button>
            <div><strong>LOEI CAT HOTEL</strong><span>โรงแรมแมวเมืองเลย</span></div>
          </div>
          <span className="line-badge">จาก LINE OA</span>
        </header>

        <div className="booking-card">
          {step < 5 ? (
            <>
              <nav className="stepper" aria-label="ขั้นตอนการจอง">
                {steps.map((label, index) => {
                  const stepNumber = index + 1;
                  return (
                    <div className={`stepper-item ${stepNumber <= step ? "active" : ""}`} key={label}>
                      <span>{stepNumber < step ? "✓" : stepNumber}</span>
                      <small>{label}</small>
                    </div>
                  );
                })}
              </nav>

              <div className="step-heading">
                <span className="step-kicker">ขั้นตอน {step} จาก 4</span>
                <h2>
                  {step === 1 && "น้องจะมาพักวันไหนคะ?"}
                  {step === 2 && "เลือกห้องและการดูแล"}
                  {step === 3 && "รู้จักผู้ปกครองและน้องแมว"}
                  {step === 4 && "ตรวจสอบและชำระมัดจำ"}
                </h2>
                <p>
                  {step === 1 && "เลือกช่วงเวลาและจำนวนแมว เพื่อเตรียมตรวจห้องว่าง"}
                  {step === 2 && "ราคา Villa และ Condo เท่ากัน เลือกให้เหมาะกับน้องได้เลย"}
                  {step === 3 && "เอกสารวัคซีนและการป้องกันเห็บหมัดส่งภายหลังได้"}
                  {step === 4 && "ตรวจข้อมูลและยอดมัดจำ จากนั้นโอนและส่งสลิปผ่าน LINE OA"}
                </p>
              </div>

              {step === 1 && (
                <section className="form-section" aria-label="วันเข้าพัก">
                  <div className="segmented-control" role="group" aria-label="รูปแบบการเข้าพัก">
                    <button className={form.mode === "overnight" ? "selected" : ""} type="button" onClick={() => updateForm("mode", "overnight")}>
                      <span>พักค้างคืน</span><small>150 หรือ 250 บาท/ตัว/คืน</small>
                    </button>
                    <button className={form.mode === "hourly" ? "selected" : ""} type="button" onClick={() => updateForm("mode", "hourly")}>
                      <span>ฝากรายชั่วโมง</span><small>ไม่เกิน 6 ชั่วโมง · 100 บาท/ตัว</small>
                    </button>
                  </div>

                  {form.mode === "overnight" ? (
                    <div className="field-grid two-columns">
                      <label className="field-label"><span>วันเข้าพัก</span><input type="date" value={form.checkInDate} onChange={(event) => updateForm("checkInDate", event.target.value)} /></label>
                      <label className="field-label"><span>วันรับกลับ</span><input type="date" value={form.checkOutDate} min={form.checkInDate} onChange={(event) => updateForm("checkOutDate", event.target.value)} /></label>
                    </div>
                  ) : (
                    <div className="field-grid three-columns">
                      <label className="field-label date-field"><span>วันที่ฝาก</span><input type="date" value={form.visitDate} onChange={(event) => updateForm("visitDate", event.target.value)} /></label>
                      <label className="field-label"><span>เวลาฝาก</span><input type="time" value={form.startTime} min="08:30" max="18:00" onChange={(event) => updateForm("startTime", event.target.value)} /></label>
                      <label className="field-label"><span>เวลารับกลับ</span><input type="time" value={form.endTime} min="08:30" max="20:00" onChange={(event) => updateForm("endTime", event.target.value)} /></label>
                    </div>
                  )}

                  <div className="counter-block">
                    <div><span className="field-title">จำนวนแมว</span><small>สูงสุดรวมทั้งโรงแรม 30 ตัวต่อวัน</small></div>
                    <div className="counter">
                      <button type="button" aria-label="ลดจำนวนแมว" onClick={() => changePetCount(form.petCount - 1)}>−</button>
                      <output aria-live="polite"><b>{form.petCount}</b><span>ตัว</span></output>
                      <button type="button" aria-label="เพิ่มจำนวนแมว" onClick={() => changePetCount(form.petCount + 1)}>+</button>
                    </div>
                  </div>

                  <div className="availability-note"><span className="status-dot" /><div><b>พร้อมตรวจห้องว่าง</b><small>จำนวนห้องว่างจริงจะยืนยันจากระบบกลางในขั้นเชื่อม API</small></div></div>
                </section>
              )}

              {step === 2 && (
                <section className="form-section" aria-label="ห้องและแพ็กเกจ">
                  <div className="field-title-row"><span className="field-title">ประเภทห้องพัก</span><small>ห้องเดียวกันสำหรับแมวครอบครัวเดียวกัน</small></div>
                  <div className="room-grid">
                    <button type="button" className={`selection-card ${form.roomType === "condo" ? "selected" : ""}`} disabled={form.petCount === 1} onClick={() => updateForm("roomType", "condo")}>
                      <span className="recommend-chip">แนะนำก่อน</span><span className="room-icon" aria-hidden="true">▤</span><strong>ห้องคอนโด</strong><small>พื้นที่แนวตั้ง 3 ชั้น · 2–4 ตัว/ห้อง</small>{form.petCount === 1 && <em>ข้อมูลปัจจุบันยังไม่เปิดสำหรับแมว 1 ตัว</em>}
                    </button>
                    <button type="button" className={`selection-card ${form.roomType === "villa" ? "selected" : ""}`} disabled={form.petCount > 2} onClick={() => updateForm("roomType", "villa")}>
                      <span className="room-icon" aria-hidden="true">⌂</span><strong>ห้องวิลล่า</strong><small>ห้องไม้ส่วนตัว · 1–2 ตัว/ห้อง</small>{form.petCount > 2 && <em>รองรับไม่เกิน 2 ตัวต่อห้อง</em>}
                    </button>
                  </div>
                  {form.petCount > 4 && <div className="warning-note"><b>ต้องจัดหลายห้อง</b><span>พนักงานจะช่วยตรวจและจัดห้องให้เหมาะสมผ่าน LINE OA</span></div>}

                  {form.mode === "overnight" ? (
                    <>
                      <div className="field-title-row space-top"><span className="field-title">แพ็กเกจดูแล</span><small>ราคาต่อแมว 1 ตัว ต่อคืน</small></div>
                      <div className="rate-list">
                        {ratePlans.map((plan) => (
                          <button type="button" className={`rate-card ${form.ratePlan === plan.code ? "selected" : ""}`} key={plan.code} onClick={() => updateForm("ratePlan", plan.code)}>
                            <span className="radio-dot" /><span className="rate-copy"><strong>{plan.title}</strong><small>{plan.detail}</small></span><span className="rate-price"><b>{plan.price}</b><small>บาท</small></span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : <div className="hourly-rate"><span>ฝากไม่เกิน 6 ชั่วโมง</span><strong>100 บาท <small>/ ตัว</small></strong></div>}
                </section>
              )}

              {step === 3 && (
                <section className="form-section" aria-label="ข้อมูลผู้ปกครองและแมว">
                  <div className="field-grid two-columns">
                    <label className="field-label"><span>ชื่อผู้ปกครอง *</span><input value={form.guardianName} placeholder="เช่น คุณกานต์" onChange={(event) => updateForm("guardianName", event.target.value)} /></label>
                    <label className="field-label"><span>เบอร์โทรศัพท์ *</span><input type="tel" inputMode="tel" value={form.phone} placeholder="08X-XXX-XXXX" onChange={(event) => updateForm("phone", event.target.value)} /></label>
                  </div>

                  <div className="pet-name-card">
                    <div className="field-title-row"><span className="field-title">ชื่อแมวทุกตัว *</span><small>{form.petCount} ตัว</small></div>
                    <div className="pet-name-grid">
                      {form.petNames.map((name, index) => (
                        <label className="field-label" key={index}><span>ตัวที่ {index + 1}</span><input value={name} placeholder={`ชื่อน้องแมวตัวที่ ${index + 1}`} onChange={(event) => { const petNames = [...form.petNames]; petNames[index] = event.target.value; updateForm("petNames", petNames); }} /></label>
                      ))}
                    </div>
                  </div>

                  <div className="field-title-row space-top"><span className="field-title">การดูแลพิเศษ</span><small>เลือกได้มากกว่า 1 รายการ</small></div>
                  <div className="check-grid">
                    {careOptions.map((option) => (
                      <label className={form.careFlags.includes(option.value) ? "checked" : ""} key={option.value}><input type="checkbox" checked={form.careFlags.includes(option.value)} onChange={() => toggleCareFlag(option.value)} /><span>{option.label}</span></label>
                    ))}
                  </div>

                  <div className="clinic-card">
                    <div className="field-title-row"><span className="field-title">สถานพยาบาลประจำ</span><small>สำหรับกรณีฉุกเฉิน</small></div>
                    <div className="field-grid two-columns">
                      <label className="field-label"><span>ชื่อคลินิก/โรงพยาบาลสัตว์</span><input value={form.clinicName} placeholder="กรอกหากมี" onChange={(event) => updateForm("clinicName", event.target.value)} /></label>
                      <label className="field-label"><span>เบอร์ติดต่อ</span><input type="tel" inputMode="tel" value={form.clinicPhone} placeholder="กรอกหากมี" onChange={(event) => updateForm("clinicPhone", event.target.value)} /></label>
                    </div>
                    <label className="consent-row"><input type="checkbox" checked={form.emergencyConsent} onChange={(event) => updateForm("emergencyConsent", event.target.checked)} /><span>ไม่มีคลินิกประจำ และอนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือเมื่อเกิดเหตุฉุกเฉิน</span></label>
                  </div>

                  <div className="document-note"><span aria-hidden="true">▣</span><div><b>เอกสารสุขภาพส่งภายหลังได้</b><small>ระบบจะเตือนให้อัปโหลดวัคซีนและการป้องกันเห็บหมัดก่อนเข้าพัก 1 วัน</small></div></div>
                </section>
              )}

              {step === 4 && (
                <section className="form-section" aria-label="ตรวจสอบข้อมูลก่อนบันทึก">
                  <div className="review-edit-actions" aria-label="แก้ไขข้อมูล">
                    <button type="button" onClick={() => setStep(1)}>แก้วันเข้าพัก</button>
                    <button type="button" onClick={() => setStep(2)}>แก้ห้อง/แพ็กเกจ</button>
                    <button type="button" onClick={() => setStep(3)}>แก้ข้อมูลลูกค้า</button>
                  </div>

                  <div className="summary-card">
                    <div className="summary-top"><span>ตรวจสอบข้อมูลก่อนบันทึก</span><small>ระบบจะสร้างรหัสคำขอจอง</small></div>
                    <dl>
                      <div><dt>ผู้ปกครอง</dt><dd>{form.guardianName}</dd></div>
                      <div><dt>เบอร์โทร</dt><dd>{form.phone}</dd></div>
                      <div><dt>ช่วงเวลา</dt><dd>{formatDateRange(form)}</dd></div>
                      <div><dt>ห้องพัก</dt><dd>{form.roomType === "condo" ? "คอนโด" : "วิลล่า"}</dd></div>
                      <div><dt>น้องแมว</dt><dd>{form.petNames.join(" · ")}</dd></div>
                      <div><dt>แพ็กเกจ</dt><dd>{form.mode === "hourly" ? "ฝากไม่เกิน 6 ชั่วโมง" : selectedRate.title}</dd></div>
                      <div><dt>จำนวน</dt><dd>{form.petCount} ตัว{form.mode === "overnight" ? ` × ${nights} คืน` : ""}</dd></div>
                      <div><dt>สถานพยาบาล</dt><dd>{form.clinicName || "ให้โรงแรมติดต่อสถานพยาบาลในเครือ"}</dd></div>
                    </dl>
                    <div className="money-row"><span>ค่าบริการรวม</span><strong>{formatBaht(total)}</strong></div>
                    <div className="money-row deposit-row"><span>มัดจำ 50%</span><strong>{formatBaht(deposit)}</strong></div>
                    <p className="calculation-note">* คำขอจะบันทึกเป็นฉบับรอตรวจสอบ ยังไม่ถือว่าได้รับการยืนยันห้องพักจนกว่าพนักงานจะแจ้งผ่าน LINE OA</p>
                  </div>

                  <div className="payment-card review-payment-card">
                    <div className="payment-title"><span className="payment-icon">฿</span><div><b>ชำระมัดจำก่อนส่งคำขอ</b><small>ยอดมัดจำ 50% · {formatBaht(deposit)}</small></div></div>
                    <div className="payment-amount-row"><span>ยอดที่ต้องโอน</span><strong>{formatBaht(deposit)}</strong></div>
                    <div className="promptpay-row"><div><span>เลขบัญชี/พร้อมเพย์</span><strong>{PAYMENT_ACCOUNT}</strong></div><button type="button" onClick={copyPaymentAccount}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button></div>
                    <p>ชื่อบัญชี: {PAYMENT_ACCOUNT_NAME}</p>
                    <div className="verification-note">หลังโอนแล้วกดส่งคำขอ ระบบจะส่งบิลเข้า LINE จากนั้นส่งภาพสลิปให้พนักงานตรวจสอบค่ะ</div>
                  </div>

                  <label className="terms-row payment-confirm"><input type="checkbox" checked={paymentAcknowledged} onChange={(event) => { setPaymentAcknowledged(event.target.checked); setError(""); }} /><span>ฉันตรวจสอบยอดมัดจำและเลขบัญชีแล้ว และจะส่งสลิปผ่าน LINE OA หลังส่งคำขอ</span></label>
                  <label className="terms-row consent-confirm"><input type="checkbox" checked={form.termsAccepted} onChange={(event) => updateForm("termsAccepted", event.target.checked)} /><span>ยืนยันว่าข้อมูลถูกต้อง และยินยอมให้ LOEI CAT HOTEL จัดเก็บข้อมูลส่วนบุคคลและข้อมูลสุขภาพของสัตว์เพื่อดำเนินคำขอจองและการดูแล</span></label>
                  <div className="review-save-note"><span aria-hidden="true">✓</span><p><b>ระบบจะบันทึกคำขอและรายการมัดจำรอตรวจสอบ</b><small>พนักงานจะตรวจสลิปและห้องว่างก่อนยืนยันการจองผ่าน LINE OA</small></p></div>
                </section>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}

              <div className="actions">
                {step > 1 && <button className="button secondary" type="button" onClick={goBack} disabled={submitting}>ย้อนกลับ</button>}
                <button className="button primary" type="button" onClick={goNext} disabled={submitting} aria-busy={submitting}>
                  {step === 1 && "ตรวจห้องว่าง"}{step === 2 && "ยืนยันห้องและแพ็กเกจ"}{step === 3 && "ตรวจสอบข้อมูล"}{step === 4 && (submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอและรับบิล")}{!submitting && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </>
          ) : (
            <section className="success-view" aria-live="polite">
              <article className="receipt-card">
                <header className="receipt-brand"><strong>LOEI CAT HOTEL</strong><small>โรงแรมแมวเมืองเลยยินดีให้บริการ</small></header>
                <div className="receipt-check" aria-hidden="true">✓</div>
                <h2>รับคำขอจองแล้ว</h2>
                <p className="receipt-subtitle">ใช้หน้าจอนี้และบิลใน LINE ส่งสลิปให้พนักงาน</p>
                <div className="receipt-code"><span>รหัสคำขอจอง</span><strong>{bookingCode}</strong></div>

                <dl className="receipt-summary">
                  <div><dt>ผู้ปกครอง</dt><dd>{form.guardianName}</dd></div>
                  <div><dt>เบอร์โทร</dt><dd>{form.phone}</dd></div>
                  <div><dt>น้องแมว</dt><dd>{form.petNames.join(", ")}</dd></div>
                  <div><dt>จำนวน / ห้อง</dt><dd>{form.petCount} ตัว · {form.roomType === "condo" ? "ห้องคอนโด" : "ห้องวิลล่า"}</dd></div>
                  <div><dt>แพ็กเกจ</dt><dd>{form.mode === "hourly" ? "ฝากไม่เกิน 6 ชั่วโมง" : selectedRate.title}</dd></div>
                </dl>

                <div className="receipt-dates">
                  <div><span>{form.mode === "hourly" ? "วันที่ฝาก" : "วันเข้าพัก"}</span><strong>{formatReceiptDate(form.mode === "hourly" ? form.visitDate : form.checkInDate)}</strong><small>{form.mode === "hourly" ? `${form.startTime} น.` : "08:30–18:00 น."}</small></div>
                  <div><span>{form.mode === "hourly" ? "เวลารับกลับ" : "วันรับกลับ"}</span><strong>{form.mode === "hourly" ? `${form.endTime} น.` : formatReceiptDate(form.checkOutDate)}</strong><small>{form.mode === "hourly" ? "ภายในวันเดียวกัน" : "12:00–18:00 น."}</small></div>
                </div>

                <div className="receipt-payments">
                  <div><span>มัดจำรอตรวจสอบ</span><strong>{formatBaht(deposit)}</strong></div>
                  <div><span>ชำระวันเช็กอิน</span><strong>{formatBaht(total - deposit)}</strong></div>
                </div>

                <div className="receipt-account">
                  <span>ชำระมัดจำผ่านพร้อมเพย์</span>
                  <strong>{PAYMENT_ACCOUNT}</strong>
                  <small>ชื่อบัญชี: {PAYMENT_ACCOUNT_NAME}</small>
                  <button type="button" onClick={copyPaymentAccount}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกเลขบัญชี"}</button>
                </div>

                <div className="receipt-prep"><b>เตรียมก่อนเข้าพัก</b><p>วัคซีนอย่างน้อย 1 เข็ม · ป้องกันเห็บหมัดประจำเดือน · อาบน้ำทำความสะอาด · เตรียมอาหาร/ทรายหากเลือกนำมาเอง</p></div>
              </article>

              <div className={`line-confirmation-card ${lineMessageSent ? "sent" : "missing"}`}>
                <span className="line-confirmation-dot" aria-hidden="true">{lineMessageSent ? "✓" : "!"}</span>
                <div><b>{lineMessageSent ? "ส่งบิลเข้า LINE แล้ว" : "ยังส่งบิลเข้า LINE ไม่สำเร็จ"}</b><small>{lineMessageSent ? "เปิดแชตเพื่อส่งสลิปให้พนักงานตรวจสอบ" : "ใช้รหัสคำขอด้านบนติดต่อพนักงานได้ค่ะ"}</small></div>
              </div>

              <a className="button primary full receipt-line-button" href={`https://line.me/R/oaMessage/%40002lffmk/?${encodeURIComponent(`ส่งสลิปมัดจำ รหัส ${bookingCode}`)}`}>ส่งสลิปมัดจำใน LINE OA</a>
              <button className="button secondary full receipt-new-button" type="button" onClick={() => { setStep(1); setForm(initialForm); setBookingCode(""); setLineMessageSent(null); setPaymentAcknowledged(false); setCopied(false); requestId.current = null; }}>เริ่มคำขอใหม่</button>
            </section>
          )}
        </div>

        <footer className="privacy-footer">ข้อมูลส่วนตัวและข้อมูลสุขภาพจัดเก็บใน Supabase โดยจำกัดสิทธิ์การเข้าถึง</footer>
      </section>

      <ThemeSettingsPanel
        open={themeOpen}
        value={theme}
        onChange={setTheme}
        onClose={() => setThemeOpen(false)}
        onSave={saveTheme}
        onReset={resetTheme}
      />
    </main>
  );
}
