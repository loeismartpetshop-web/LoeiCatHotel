"use client";

import {
  calculateDeposit,
  calculateQuote,
  HOTEL_MAXIMUM_PETS,
  type RatePlanCode,
  type RoomType
} from "@loei-cat-hotel/domain";
import { useMemo, useState } from "react";

type BookingMode = "overnight" | "hourly";
type Step = 1 | 2 | 3 | 4 | 5;

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

function createPrototypeBookingCode(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `DEMO-${stamp}`;
}

export function BookingApp() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [bookingCode, setBookingCode] = useState("");

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
    if (step === 4 && !form.termsAccepted) {
      setError("กรุณายืนยันข้อมูลและรับทราบเงื่อนไขก่อนส่งคำขอ");
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step === 4) {
      setBookingCode(createPrototypeBookingCode());
      setStep(5);
    } else {
      setStep((current) => Math.min(5, current + 1) as Step);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const copyPromptPay = async () => {
    try {
      await navigator.clipboard.writeText("KPS004KB000002201754");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดค้างที่หมายเลขเพื่อคัดลอก");
    }
  };

  const selectedRate = ratePlans.find((plan) => plan.code === form.ratePlan) ?? ratePlans[0]!;

  return (
    <main className="site-shell">
      <section className="brand-panel" aria-label="ข้อมูลโรงแรม">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">L</div>
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
            <div className="brand-mark" aria-hidden="true">L</div>
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
                  {step === 4 && "ตรวจสอบก่อนส่งคำขอ"}
                </h2>
                <p>
                  {step === 1 && "เลือกช่วงเวลาและจำนวนแมว เพื่อเตรียมตรวจห้องว่าง"}
                  {step === 2 && "ราคา Villa และ Condo เท่ากัน เลือกให้เหมาะกับน้องได้เลย"}
                  {step === 3 && "เอกสารวัคซีนและการป้องกันเห็บหมัดส่งภายหลังได้"}
                  {step === 4 && "รายการต้นแบบนี้ยังไม่กันห้องจริงจนกว่าจะเชื่อม Booking API"}
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
                <section className="form-section" aria-label="สรุปการจอง">
                  <div className="summary-card">
                    <div className="summary-top"><span>สรุปคำขอจอง</span><small>ราคาประเมินเบื้องต้น</small></div>
                    <dl>
                      <div><dt>ช่วงเวลา</dt><dd>{formatDateRange(form)}</dd></div>
                      <div><dt>ห้องพัก</dt><dd>{form.roomType === "condo" ? "คอนโด" : "วิลล่า"}</dd></div>
                      <div><dt>น้องแมว</dt><dd>{form.petNames.join(" · ")}</dd></div>
                      <div><dt>แพ็กเกจ</dt><dd>{form.mode === "hourly" ? "ฝากไม่เกิน 6 ชั่วโมง" : selectedRate.title}</dd></div>
                      <div><dt>จำนวน</dt><dd>{form.petCount} ตัว{form.mode === "overnight" ? ` × ${nights} คืน` : ""}</dd></div>
                    </dl>
                    <div className="money-row"><span>ค่าบริการรวม</span><strong>{formatBaht(total)}</strong></div>
                    <div className="money-row deposit-row"><span>มัดจำ 50%</span><strong>{formatBaht(deposit)}</strong></div>
                    <p className="calculation-note">* การนับคืนและห้องว่างจะยืนยันอีกครั้งจาก Booking API ตามกฎที่เจ้าของอนุมัติ</p>
                  </div>

                  <div className="payment-card">
                    <div className="payment-title"><span className="payment-icon">฿</span><div><b>ชำระมัดจำผ่านพร้อมเพย์</b><small>ชำระภายใน 24:00 น. ของวันที่สร้างรายการ</small></div></div>
                    <div className="promptpay-row"><div><span>หมายเลขรับชำระ</span><strong>KPS004KB000002201754</strong></div><button type="button" onClick={copyPromptPay}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button></div>
                    <p>ชื่อบัญชี: บริษัท เลิฟเพ็ท โกลบอลพลัส จำกัด</p>
                    <div className="verification-note">กรุณาตรวจชื่อบัญชีก่อนโอน รหัสรับชำระนี้ต้องได้รับการยืนยันกับธนาคารก่อนเปิดใช้งานจริง</div>
                  </div>

                  <label className="terms-row"><input type="checkbox" checked={form.termsAccepted} onChange={(event) => updateForm("termsAccepted", event.target.checked)} /><span>ยืนยันว่าข้อมูลถูกต้อง และรับทราบว่าคำขอยกเลิกหรือคืนมัดจำต้องให้ทีมงานพิจารณา</span></label>
                </section>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}

              <div className="actions">
                {step > 1 && <button className="button secondary" type="button" onClick={goBack}>ย้อนกลับ</button>}
                <button className="button primary" type="button" onClick={goNext}>
                  {step === 1 && "ตรวจห้องว่าง"}{step === 2 && "ยืนยันห้องและแพ็กเกจ"}{step === 3 && "ตรวจสอบข้อมูล"}{step === 4 && "ส่งคำขอต้นแบบ"}<span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          ) : (
            <section className="success-view" aria-live="polite">
              <div className="success-mark" aria-hidden="true">✓</div>
              <span className="step-kicker">ส่งข้อมูลต้นแบบสำเร็จ</span>
              <h2>ได้รับข้อมูลของน้องแล้วค่ะ</h2>
              <p>ข้อมูลยังไม่ถูกส่งเข้าโรงแรมหรือกันห้องจริง เนื่องจาก Booking API และ Supabase ยังไม่ได้เชื่อมต่อ</p>
              <div className="prototype-code"><span>รหัสอ้างอิงต้นแบบ</span><strong>{bookingCode}</strong></div>
              <div className="next-steps"><b>เมื่อต่อระบบจริง ขั้นตอนถัดไปคือ</b><ol><li>ระบบถือห้องถึง 24:00 น.</li><li>ลูกค้าอัปโหลดหลักฐานมัดจำ 50%</li><li>พนักงานตรวจและยืนยันผ่าน LINE OA 1 ครั้ง</li></ol></div>
              <button className="button primary full" type="button" onClick={() => { setStep(1); setForm(initialForm); setBookingCode(""); }}>เริ่มคำขอใหม่</button>
              <a className="line-link" href="https://line.me/R/ti/p/%40002lffmk">กลับไป LINE OA <span>↗</span></a>
            </section>
          )}
        </div>

        <footer className="privacy-footer">ข้อมูลส่วนตัวและเอกสารสุขภาพจะจัดเก็บแบบจำกัดสิทธิ์เมื่อเชื่อมระบบจริง</footer>
      </section>
    </main>
  );
}
