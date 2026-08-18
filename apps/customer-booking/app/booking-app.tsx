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
import { closeLineWindow, getLineIdToken } from "./line-client";
import { dateLocaleTag, detectLocale, LOCALE_STORAGE_KEY, translate, type Locale } from "@/lib/i18n";

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
  miHomeAppId: string;
  petNames: string[];
  petPhotos: string[];
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
  miHomeAppId: "",
  petNames: ["", ""],
  petPhotos: ["", ""],
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

const PET_PHOTO_MAX_EDGE = 1024;
const PET_PHOTO_QUALITY = 0.75;

// แปลงรูปที่ลูกค้าเลือก (JPG/JPEG/PNG/HEIC ที่เบราว์เซอร์อ่านได้) เป็น WebP เพื่อลดขนาดก่อนส่งขึ้นเซิร์ฟเวอร์
// ถ้าเบราว์เซอร์เก่าไม่รองรับการเข้ารหัส WebP จะ fallback เป็น JPEG ให้อัตโนมัติ
async function toWebpDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      element.src = objectUrl;
    });
    const scale = Math.min(1, PET_PHOTO_MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์นี้แปลงรูปไม่ได้");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", PET_PHOTO_QUALITY);
    if (webp.startsWith("data:image/webp")) return webp;
    return canvas.toDataURL("image/jpeg", PET_PHOTO_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatBaht(value: number, locale: Locale): string {
  return `${value.toLocaleString(dateLocaleTag(locale))} ${translate("บาท", locale)}`;
}
function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function sanitizeMiHomeInput(value: string): string {
  return value.replace(/[\s\u200b-\u200d\ufeff]/g, "").slice(0, 120);
}

type MiHomeAccountKind = "empty" | "account_id" | "email" | "phone" | "unknown";

function detectMiHomeAccountKind(value: string): MiHomeAccountKind {
  const trimmed = sanitizeMiHomeInput(value);
  if (!trimmed) return "empty";
  if (/^\d{6,16}$/.test(trimmed)) return "account_id";
  if (/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(trimmed)) return "email";
  if (/^\+?\d{9,15}$/.test(trimmed)) return "phone";
  return "unknown";
}

const MI_HOME_HINTS: Record<MiHomeAccountKind, string> = {
  empty: "กรอกหากต้องการให้พนักงานแชร์สิทธิ์ดูกล้องห้องพักให้บัญชีนี้ (ไม่บังคับ)",
  account_id: "ตรวจพบรูปแบบ Xiaomi Account ID (ตัวเลข) ใช้แชร์กล้องได้",
  email: "ตรวจพบอีเมล ต้องเป็นอีเมลที่ผูกกับบัญชี Xiaomi เท่านั้น",
  phone: "ตรวจพบเบอร์โทร ต้องเป็นเบอร์ที่ผูกกับบัญชี Xiaomi เท่านั้น",
  unknown: "รูปแบบนี้ Mi Home อาจไม่รู้จัก ใช้ Xiaomi Account ID (ตัวเลข) หรืออีเมล/เบอร์ที่ผูกบัญชี"
};


function countNights(start: string, end: string): number {
  if (!start || !end) return 1;
  const startTime = new Date(`${start}T00:00:00+07:00`).getTime();
  const endTime = new Date(`${end}T00:00:00+07:00`).getTime();
  return Math.max(1, Math.round((endTime - startTime) / 86_400_000));
}

function formatDateRange(form: BookingForm, locale: Locale): string {
  const formatter = new Intl.DateTimeFormat(dateLocaleTag(locale), { day: "numeric", month: "short", year: "numeric" });
  if (form.mode === "hourly") {
    if (!form.visitDate) return translate("ยังไม่ได้เลือกวัน", locale);
    return `${formatter.format(new Date(`${form.visitDate}T12:00:00+07:00`))} · ${form.startTime}–${form.endTime} ${translate("น.", locale)}`;
  }
  if (!form.checkInDate || !form.checkOutDate) return translate("ยังไม่ได้เลือกวัน", locale);
  return `${formatter.format(new Date(`${form.checkInDate}T12:00:00+07:00`))} – ${formatter.format(new Date(`${form.checkOutDate}T12:00:00+07:00`))}`;
}

function formatReceiptDate(value: string, locale: Locale): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(dateLocaleTag(locale), { day: "numeric", month: "short", year: "numeric" })
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
  const [locale, setLocale] = useState<Locale>("th");
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

  // ตรวจภาษาจากเครื่อง/เบราว์เซอร์ครั้งเดียวหลัง mount เพื่อไม่ให้ HTML ที่ render จากเซิร์ฟเวอร์ไม่ตรงกับฝั่ง client
  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
    document.documentElement.lang = detected;
  }, []);

  useEffect(() => {
    void getLineIdToken()
      .then((token) => { lineIdToken.current = token; })
      .catch((lineError) => { console.warn("LIFF initialization failed", lineError); });
  }, []);

  const t = (text: string) => translate(text, locale);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // เขียน localStorage ไม่ได้ก็ยังใช้ภาษาที่เลือกได้ในรอบนี้
    }
  };

  const localeSwitch = (
    <div className="locale-switch" role="group" aria-label={t("เลือกภาษา")}>
      <button type="button" className={locale === "th" ? "selected" : ""} onClick={() => changeLocale("th")}>ไทย</button>
      <button type="button" className={locale === "en" ? "selected" : ""} onClick={() => changeLocale("en")}>EN</button>
    </div>
  );

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

  const returnToLineChat = async () => {
    try {
      if (await closeLineWindow()) return;
    } catch (lineError) {
      console.warn("Unable to close LIFF window", lineError);
    }
    window.location.href = "https://line.me/R/oaMessage/%40002lffmk";
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
      const petPhotos = Array.from({ length: count }, (_, index) => current.petPhotos[index] ?? "");
      let roomType = current.roomType;
      if (count === 1) roomType = "villa";
      if (count > 2) roomType = "condo";
      return { ...current, petCount: count, petNames, petPhotos, roomType };
    });
    setError("");
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (form.mode === "overnight") {
        if (!form.checkInDate || !form.checkOutDate) {
          setError(t("กรุณาเลือกวันเข้าพักและวันรับกลับ"));
          return false;
        }
        if (form.checkOutDate <= form.checkInDate) {
          setError(t("วันรับกลับต้องอยู่หลังวันเข้าพัก"));
          return false;
        }
      } else {
        if (!form.visitDate) {
          setError(t("กรุณาเลือกวันที่ฝากน้อง"));
          return false;
        }
        const [startHour = 0, startMinute = 0] = form.startTime.split(":").map(Number);
        const [endHour = 0, endMinute = 0] = form.endTime.split(":").map(Number);
        const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
        if (duration <= 0) {
          setError(t("เวลารับกลับต้องอยู่หลังเวลาฝาก"));
          return false;
        }
        if (duration > 360) {
          setError(t("ฝากเกิน 6 ชั่วโมงจะคิดเป็นราคาค้างคืน กรุณาเลือกแบบค้างคืน"));
          return false;
        }
      }
    }
    if (step === 2 && form.petCount > 4) {
      setError(t("การจองมากกว่า 4 ตัวต้องให้พนักงานช่วยจัดหลายห้อง กรุณาติดต่อ LINE OA @002lffmk"));
      return false;
    }
    if (step === 3) {
      if (!form.guardianName.trim()) {
        setError(t("กรุณากรอกชื่อผู้ปกครอง"));
        return false;
      }
      if (!/^0\d{9}$/.test(form.phone)) {
        setError(t("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 ตัว โดยขึ้นต้นด้วย 0"));
        return false;
      }
      if (form.petNames.some((name) => !name.trim())) {
        setError(t("กรุณากรอกชื่อแมวให้ครบทุกตัว"));
        return false;
      }
      if (!form.clinicName.trim() && !form.emergencyConsent) {
        setError(t("กรุณาระบุสถานพยาบาลประจำ หรืออนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือ"));
        return false;
      }
    }
    if (step === 4) {
      if (!paymentAcknowledged) {
        setError(t("กรุณาตรวจสอบยอดมัดจำและเลขบัญชีก่อนส่งคำขอจอง"));
        return false;
      }
      if (!form.termsAccepted) {
        setError(t("กรุณายืนยันข้อมูลและยินยอมให้จัดเก็บข้อมูลเพื่อดำเนินคำขอจอง"));
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
      if (!response.ok || !result.bookingCode) throw new Error(result.error ?? t("บันทึกคำขอไม่สำเร็จ"));
      setBookingCode(result.bookingCode);
      setLineMessageSent(Boolean(result.lineMessageSent));
      setStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setStep((current) => Math.max(1, current - 1) as Step);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setPetPhoto = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await toWebpDataUrl(file);
      setForm((current) => {
        const petPhotos = [...current.petPhotos];
        petPhotos[index] = dataUrl;
        return { ...current, petPhotos };
      });
      setError("");
    } catch {
      setError(t("แปลงรูปน้องแมวไม่สำเร็จ กรุณาเลือกไฟล์รูปอื่น"));
    }
  };

  const clearPetPhoto = (index: number) => {
    setForm((current) => {
      const petPhotos = [...current.petPhotos];
      petPhotos[index] = "";
      return { ...current, petPhotos };
    });
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
      setError(t("คัดลอกเลขบัญชีอัตโนมัติไม่ได้ กรุณากดค้างที่เลขบัญชีเพื่อคัดลอก"));
    }
  };

  const selectedRate = ratePlans.find((plan) => plan.code === form.ratePlan) ?? ratePlans[0]!;

  return (
    <main className="site-shell">
      <section className="brand-panel" aria-label={t("ข้อมูลโรงแรม")}>
        <div className="brand-lockup">
          <button type="button" className="brand-logo-trigger" onClick={handleLogoTap} aria-label={t("โลโก้ LOEI CAT HOTEL")}>
            <Image className="brand-mark" src="/loeicathotel-logo.webp" alt="" width={96} height={96} priority />
          </button>
          <div><strong>LOEI CAT HOTEL</strong><span>{t("โรงแรมแมวเมืองเลย")}</span></div>
        </div>
        {localeSwitch}
        <div className="brand-copy">
          <p className="eyebrow">{t("พักสบาย ดูแลเหมือนอยู่บ้าน")}</p>
          <h1>{t("วันหยุดของคุณ")}<br />{t("คือวันพักผ่อนของน้อง")}</h1>
          <p>{t("ห้องพักส่วนตัว ดูแลอาหาร น้ำ สุขภาพ และส่งต่อข้อมูลสำคัญถึงพนักงานอย่างเป็นระบบ")}</p>
        </div>
        <div className="trust-grid">
          <div><strong>30</strong><span>{t("รับสูงสุดต่อวัน")}</span></div>
          <div><strong>08:30–18:00</strong><span>{t("เปิดบริการทุกวัน")}</span></div>
          <div><strong>{t("1 ครอบครัว")}</strong><span>{t("ต่อหนึ่งห้องพัก")}</span></div>
        </div>
        <div className="contact-note">LINE OA <b>@002lffmk</b> {t("· โทร 083-917-8794")}</div>
      </section>

      <section className="booking-panel">
        <header className="mobile-header">
          <div className="brand-lockup compact">
            <button type="button" className="brand-logo-trigger" onClick={handleLogoTap} aria-label={t("โลโก้ LOEI CAT HOTEL")}>
              <Image className="brand-mark" src="/loeicathotel-logo.webp" alt="" width={96} height={96} priority />
            </button>
            <div><strong>LOEI CAT HOTEL</strong><span>{t("โรงแรมแมวเมืองเลย")}</span></div>
          </div>
          <div className="mobile-header-actions">{localeSwitch}<span className="line-badge">{t("จาก LINE OA")}</span></div>
        </header>

        <div className="booking-card">
          {step < 5 ? (
            <>
              <nav className="stepper" aria-label={t("ขั้นตอนการจอง")}>
                {steps.map((label, index) => {
                  const stepNumber = index + 1;
                  return (
                    <div className={`stepper-item ${stepNumber <= step ? "active" : ""}`} key={label}>
                      <span>{stepNumber < step ? "✓" : stepNumber}</span>
                      <small>{t(label)}</small>
                    </div>
                  );
                })}
              </nav>

              <div className="step-heading">
                <span className="step-kicker">{t("ขั้นตอน")} {step} {t("จาก 4")}</span>
                <h2>
                  {step === 1 && t("น้องจะมาพักวันไหนคะ?")}
                  {step === 2 && t("เลือกห้องและการดูแล")}
                  {step === 3 && t("รู้จักผู้ปกครองและน้องแมว")}
                  {step === 4 && t("ตรวจสอบและชำระมัดจำ")}
                </h2>
                <p>
                  {step === 1 && t("เลือกช่วงเวลาและจำนวนแมว เพื่อเตรียมตรวจห้องว่าง")}
                  {step === 2 && t("ราคา Villa และ Condo เท่ากัน เลือกให้เหมาะกับน้องได้เลย")}
                  {step === 3 && t("เอกสารวัคซีนและการป้องกันเห็บหมัดส่งภายหลังได้")}
                  {step === 4 && t("ตรวจข้อมูลและยอดมัดจำ จากนั้นโอนและส่งสลิปผ่าน LINE OA")}
                </p>
              </div>

              {step === 1 && (
                <section className="form-section" aria-label={t("วันเข้าพัก")}>
                  <div className="segmented-control" role="group" aria-label={t("รูปแบบการเข้าพัก")}>
                    <button className={form.mode === "overnight" ? "selected" : ""} type="button" onClick={() => updateForm("mode", "overnight")}>
                      <span>{t("พักค้างคืน")}</span><small>{t("150 หรือ 250 บาท/ตัว/คืน")}</small>
                    </button>
                    <button className={form.mode === "hourly" ? "selected" : ""} type="button" onClick={() => updateForm("mode", "hourly")}>
                      <span>{t("ฝากรายชั่วโมง")}</span><small>{t("ไม่เกิน 6 ชั่วโมง · 100 บาท/ตัว")}</small>
                    </button>
                  </div>

                  {form.mode === "overnight" ? (
                    <div className="field-grid two-columns">
                      <label className="field-label"><span>{t("วันเข้าพัก")}</span><input type="date" value={form.checkInDate} onChange={(event) => updateForm("checkInDate", event.target.value)} /></label>
                      <label className="field-label"><span>{t("วันรับกลับ")}</span><input type="date" value={form.checkOutDate} min={form.checkInDate} onChange={(event) => updateForm("checkOutDate", event.target.value)} /></label>
                    </div>
                  ) : (
                    <div className="field-grid three-columns">
                      <label className="field-label date-field"><span>{t("วันที่ฝาก")}</span><input type="date" value={form.visitDate} onChange={(event) => updateForm("visitDate", event.target.value)} /></label>
                      <label className="field-label"><span>{t("เวลาฝาก")}</span><input type="time" value={form.startTime} min="08:30" max="18:00" onChange={(event) => updateForm("startTime", event.target.value)} /></label>
                      <label className="field-label"><span>{t("เวลารับกลับ")}</span><input type="time" value={form.endTime} min="08:30" max="20:00" onChange={(event) => updateForm("endTime", event.target.value)} /></label>
                    </div>
                  )}

                  <div className="counter-block">
                    <div><span className="field-title">{t("จำนวนแมว")}</span><small>{t("สูงสุดรวมทั้งโรงแรม 30 ตัวต่อวัน")}</small></div>
                    <div className="counter">
                      <button type="button" aria-label={t("ลดจำนวนแมว")} onClick={() => changePetCount(form.petCount - 1)}>−</button>
                      <output aria-live="polite"><b>{form.petCount}</b><span>{t("ตัว")}</span></output>
                      <button type="button" aria-label={t("เพิ่มจำนวนแมว")} onClick={() => changePetCount(form.petCount + 1)}>+</button>
                    </div>
                  </div>

                  <div className="availability-note"><span className="status-dot" /><div><b>{t("เลือกวันและจำนวนแมว")}</b><small>{t("ระบบจะบันทึกช่วงเวลาที่ต้องการไว้ในคำขอจอง")}</small></div></div>
                </section>
              )}

              {step === 2 && (
                <section className="form-section" aria-label={t("ห้องและแพ็กเกจ")}>
                  <div className="field-title-row"><span className="field-title">{t("ประเภทห้องพัก")}</span><small>{t("ห้องเดียวกันสำหรับแมวครอบครัวเดียวกัน")}</small></div>
                  <div className="room-grid">
                    <button type="button" className={`selection-card ${form.roomType === "condo" ? "selected" : ""}`} disabled={form.petCount === 1} onClick={() => updateForm("roomType", "condo")}>
                      <span className="recommend-chip">{t("แนะนำก่อน")}</span><span className="room-icon" aria-hidden="true">▤</span><strong>{t("ห้องคอนโด")}</strong><small>{t("พื้นที่แนวตั้ง 3 ชั้น · 2–4 ตัว/ห้อง")}</small>{form.petCount === 1 && <em>{t("ข้อมูลปัจจุบันยังไม่เปิดสำหรับแมว 1 ตัว")}</em>}
                    </button>
                    <button type="button" className={`selection-card ${form.roomType === "villa" ? "selected" : ""}`} disabled={form.petCount > 2} onClick={() => updateForm("roomType", "villa")}>
                      <span className="room-icon" aria-hidden="true">⌂</span><strong>{t("ห้องวิลล่า")}</strong><small>{t("ห้องไม้ส่วนตัว · 1–2 ตัว/ห้อง")}</small>{form.petCount > 2 && <em>{t("รองรับไม่เกิน 2 ตัวต่อห้อง")}</em>}
                    </button>
                  </div>
                  {form.petCount > 4 && <div className="warning-note"><b>{t("ต้องจัดหลายห้อง")}</b><span>{t("พนักงานจะช่วยตรวจและจัดห้องให้เหมาะสมผ่าน LINE OA")}</span></div>}

                  {form.mode === "overnight" ? (
                    <>
                      <div className="field-title-row space-top"><span className="field-title">{t("แพ็กเกจดูแล")}</span><small>{t("ราคาต่อแมว 1 ตัว ต่อคืน")}</small></div>
                      <div className="rate-list">
                        {ratePlans.map((plan) => (
                          <button type="button" className={`rate-card ${form.ratePlan === plan.code ? "selected" : ""}`} key={plan.code} onClick={() => updateForm("ratePlan", plan.code)}>
                            <span className="radio-dot" /><span className="rate-copy"><strong>{t(plan.title)}</strong><small>{t(plan.detail)}</small></span><span className="rate-price"><b>{plan.price}</b><small>{t("บาท")}</small></span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : <div className="hourly-rate"><span>{t("ฝากไม่เกิน 6 ชั่วโมง")}</span><strong>{t("100 บาท")} <small>{t("/ ตัว")}</small></strong></div>}
                </section>
              )}

              {step === 3 && (
                <section className="form-section" aria-label={t("ข้อมูลผู้ปกครองและแมว")}>
                  <div className="field-grid two-columns">
                    <label className="field-label"><span>{t("ชื่อผู้ปกครอง *")}</span><input value={form.guardianName} placeholder={t("เช่น คุณกานต์")} onChange={(event) => updateForm("guardianName", event.target.value)} /></label>
                    <label className="field-label"><span>{t("เบอร์โทรศัพท์ 10 ตัว *")}</span><input type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} pattern="0[0-9]{9}" value={form.phone} placeholder="08XXXXXXXX" onChange={(event) => updateForm("phone", sanitizePhoneInput(event.target.value))} /><small className="field-hint">{form.phone.length}{t("/10 ตัว")}</small></label>
                    <label className="field-label full-width-field"><span>{t("บัญชี Xiaomi (Mi Home) สำหรับดูกล้อง")}</span><input value={form.miHomeAppId} maxLength={120} inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder={t("Xiaomi Account ID เช่น 1234567890 หรืออีเมล/เบอร์ที่ผูกบัญชี")} onChange={(event) => updateForm("miHomeAppId", sanitizeMiHomeInput(event.target.value))} /><small className="field-hint">{t(MI_HOME_HINTS[detectMiHomeAccountKind(form.miHomeAppId)])}</small><small className="field-hint">{t("ไม่ใช่รหัสของตัวกล้อง แต่เป็นบัญชีผู้รับสิทธิ์ และบัญชีต้องตั้งภูมิภาคเป็นไทยเหมือนกล้องของโรงแรม")}</small></label>
                  </div>

                  <div className="pet-name-card">
                    <div className="field-title-row"><span className="field-title">{t("ชื่อแมวทุกตัว *")}</span><small>{form.petCount} {t("ตัว")}</small></div>
                    <p className="pet-photo-hint">{t("แนบรูปน้องได้ 1 รูปต่อตัว ช่วยให้พนักงานจำน้องได้ถูกตัว และใช้ช่วยประกาศตามหาหากน้องหาย (ไม่บังคับ)")}</p>
                    <div className="pet-name-grid">
                      {form.petNames.map((name, index) => (
                        <div className="pet-name-row" key={index}>
                          <label className="field-label"><span>{t("ตัวที่")} {index + 1}</span><input value={name} placeholder={`${t("ชื่อน้องแมวตัวที่")} ${index + 1}`} onChange={(event) => { const petNames = [...form.petNames]; petNames[index] = event.target.value; updateForm("petNames", petNames); }} /></label>
                          <div className="pet-photo-picker">
                            <div className="pet-photo-frame">
                              {form.petPhotos[index]
                                ? <img src={form.petPhotos[index]} alt={`${t("รูปของ")} ${name || `${t("ตัวที่")} ${index + 1}`}`} />
                                : <span aria-hidden="true">🐾</span>}
                            </div>
                            <label className="pet-photo-button">
                              <span>{form.petPhotos[index] ? t("เปลี่ยนรูป") : t("เพิ่มรูปน้อง")}</span>
                              <input type="file" accept="image/*" hidden onChange={(event) => { void setPetPhoto(index, event.target.files?.[0] ?? null); event.target.value = ""; }} />
                            </label>
                            {form.petPhotos[index] && <button type="button" className="pet-photo-clear" onClick={() => clearPetPhoto(index)}>{t("ลบรูป")}</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="field-title-row space-top"><span className="field-title">{t("การดูแลพิเศษ")}</span><small>{t("เลือกได้มากกว่า 1 รายการ")}</small></div>
                  <div className="check-grid">
                    {careOptions.map((option) => (
                      <label className={form.careFlags.includes(option.value) ? "checked" : ""} key={option.value}><input type="checkbox" checked={form.careFlags.includes(option.value)} onChange={() => toggleCareFlag(option.value)} /><span>{t(option.label)}</span></label>
                    ))}
                  </div>

                  <div className="clinic-card">
                    <div className="field-title-row"><span className="field-title">{t("สถานพยาบาลประจำ")}</span><small>{t("สำหรับกรณีฉุกเฉิน")}</small></div>
                    <div className="field-grid two-columns">
                      <label className="field-label"><span>{t("ชื่อคลินิก/โรงพยาบาลสัตว์")}</span><input value={form.clinicName} placeholder={t("กรอกหากมี")} onChange={(event) => updateForm("clinicName", event.target.value)} /></label>
                      <label className="field-label"><span>{t("เบอร์ติดต่อ")}</span><input type="tel" inputMode="tel" value={form.clinicPhone} placeholder={t("กรอกหากมี")} onChange={(event) => updateForm("clinicPhone", event.target.value)} /></label>
                    </div>
                    <label className="consent-row"><input type="checkbox" checked={form.emergencyConsent} onChange={(event) => updateForm("emergencyConsent", event.target.checked)} /><span>{t("ไม่มีคลินิกประจำ และอนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือเมื่อเกิดเหตุฉุกเฉิน")}</span></label>
                  </div>

                  <div className="document-note"><span aria-hidden="true">▣</span><div><b>{t("เอกสารสุขภาพส่งภายหลังได้")}</b><small>{t("ระบบจะเตือนให้อัปโหลดวัคซีนและการป้องกันเห็บหมัดก่อนเข้าพัก 1 วัน")}</small></div></div>
                </section>
              )}

              {step === 4 && (
                <section className="form-section" aria-label={t("ตรวจสอบข้อมูลก่อนบันทึก")}>
                  <div className="review-edit-actions" aria-label={t("แก้ไขข้อมูล")}>
                    <button type="button" onClick={() => setStep(1)}>{t("แก้วันเข้าพัก")}</button>
                    <button type="button" onClick={() => setStep(2)}>{t("แก้ห้อง/แพ็กเกจ")}</button>
                    <button type="button" onClick={() => setStep(3)}>{t("แก้ข้อมูลลูกค้า")}</button>
                  </div>

                  <div className="summary-card">
                    <div className="summary-top"><span>{t("ตรวจสอบข้อมูลก่อนบันทึก")}</span><small>{t("ระบบจะสร้างรหัสคำขอจอง")}</small></div>
                    <dl>
                      <div><dt>{t("ผู้ปกครอง")}</dt><dd>{form.guardianName}</dd></div>
                      <div><dt>{t("เบอร์โทร")}</dt><dd>{form.phone}</dd></div>
                      <div><dt>{t("ช่วงเวลา")}</dt><dd>{formatDateRange(form, locale)}</dd></div>
                      <div><dt>{t("บัญชี Mi Home")}</dt><dd>{form.miHomeAppId.trim() || t("ยังไม่ระบุ")}</dd></div>
                      <div><dt>{t("ห้องพัก")}</dt><dd>{form.roomType === "condo" ? t("คอนโด") : t("วิลล่า")}</dd></div>
                      <div><dt>{t("น้องแมว")}</dt><dd>{form.petNames.join(" · ")}</dd></div>
                      <div><dt>{t("แพ็กเกจ")}</dt><dd>{form.mode === "hourly" ? t("ฝากไม่เกิน 6 ชั่วโมง") : selectedRate.title}</dd></div>
                      <div><dt>{t("จำนวน")}</dt><dd>{form.petCount} {t("ตัว")}{form.mode === "overnight" ? ` × ${nights} ${t("คืน")}` : ""}</dd></div>
                      <div><dt>{t("สถานพยาบาล")}</dt><dd>{form.clinicName || t("ให้โรงแรมติดต่อสถานพยาบาลในเครือ")}</dd></div>
                    </dl>
                    <div className="money-row"><span>{t("ค่าบริการรวม")}</span><strong>{formatBaht(total, locale)}</strong></div>
                    <div className="money-row deposit-row"><span>{t("มัดจำ 50%")}</span><strong>{formatBaht(deposit, locale)}</strong></div>
                    <p className="calculation-note">{t("* ยอดมัดจำนี้จะอยู่ในสถานะรอตรวจสลิปจนกว่าพนักงานจะยืนยันผ่าน LINE OA")}</p>
                  </div>

                  <div className="payment-card review-payment-card">
                    <div className="payment-title"><span className="payment-icon">{t("฿")}</span><div><b>{t("ชำระมัดจำก่อนส่งคำขอ")}</b><small>{t("ยอดมัดจำ 50% ·")} {formatBaht(deposit, locale)}</small></div></div>
                    <div className="payment-amount-row"><span>{t("ยอดที่ต้องโอน")}</span><strong>{formatBaht(deposit, locale)}</strong></div>
                    <div className="promptpay-row"><div><span>{t("เลขบัญชี/พร้อมเพย์")}</span><strong>{PAYMENT_ACCOUNT}</strong></div><button type="button" onClick={copyPaymentAccount}>{copied ? t("คัดลอกแล้ว ✓") : t("คัดลอก")}</button></div>
                    <p>{t("ชื่อบัญชี:")} {PAYMENT_ACCOUNT_NAME}</p>
                    <div className="verification-note">{t("หลังส่งคำขอ ระบบจะส่งบิลมัดจำเข้า LINE ให้ส่งภาพสลิปในแชต แล้วกด “ยืนยันมัดจำ” ค่ะ")}</div>
                  </div>

                  <label className="terms-row payment-confirm"><input type="checkbox" checked={paymentAcknowledged} onChange={(event) => { setPaymentAcknowledged(event.target.checked); setError(""); }} /><span>{t("ฉันตรวจสอบยอดมัดจำและเลขบัญชีแล้ว และจะส่งสลิปผ่าน LINE OA หลังส่งคำขอ")}</span></label>
                  <label className="terms-row consent-confirm"><input type="checkbox" checked={form.termsAccepted} onChange={(event) => updateForm("termsAccepted", event.target.checked)} /><span>{t("ยืนยันว่าข้อมูลถูกต้อง และยินยอมให้ LOEI CAT HOTEL จัดเก็บข้อมูลส่วนบุคคลและข้อมูลสุขภาพของสัตว์เพื่อดำเนินคำขอจองและการดูแล")}</span></label>
                  <div className="review-save-note"><span aria-hidden="true">✓</span><p><b>{t("ระบบจะบันทึกคำขอและยอดมัดจำรอตรวจสอบ")}</b><small>{t("เมื่อพนักงานยืนยันสลิป ระบบจะส่งบิลยอดคงเหลือสำหรับวันเช็กอิน")}</small></p></div>
                </section>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}

              <div className="actions">
                {step > 1 && <button className="button secondary" type="button" onClick={goBack} disabled={submitting}>{t("ย้อนกลับ")}</button>}
                <button className="button primary" type="button" onClick={goNext} disabled={submitting} aria-busy={submitting}>
                  {step === 1 && t("ตรวจห้องว่าง")}{step === 2 && t("ยืนยันห้องและแพ็กเกจ")}{step === 3 && t("ตรวจสอบข้อมูล")}{step === 4 && (submitting ? t("กำลังส่งคำขอ...") : t("ส่งคำขอและรับบิล"))}{!submitting && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </>
          ) : (
            <section className="success-view" aria-live="polite">
              <article className="receipt-card">
                <header className="receipt-brand"><strong>LOEI CAT HOTEL</strong><small>{t("โรงแรมแมวเมืองเลยยินดีให้บริการ")}</small></header>
                <div className="receipt-check" aria-hidden="true">✓</div>
                <h2>{t("รับคำขอจองแล้ว")}</h2>
                <p className="receipt-subtitle">{t("ส่งภาพสลิปในแชต LINE แล้วกด “ยืนยันมัดจำ” ในบิล")}</p>
                <div className="receipt-code"><span>{t("รหัสคำขอจอง")}</span><strong>{bookingCode}</strong></div>

                <dl className="receipt-summary">
                  <div><dt>{t("ผู้ปกครอง")}</dt><dd>{form.guardianName}</dd></div>
                  <div><dt>{t("เบอร์โทร")}</dt><dd>{form.phone}</dd></div>
                  <div><dt>{t("น้องแมว")}</dt><dd>{form.petNames.join(", ")}</dd></div>
                  {form.miHomeAppId.trim() && <div><dt>{t("บัญชี Mi Home")}</dt><dd>{form.miHomeAppId.trim()}</dd></div>}
                  <div><dt>{t("จำนวน / ห้อง")}</dt><dd>{form.petCount} {t("ตัว ·")} {form.roomType === "condo" ? t("ห้องคอนโด") : t("ห้องวิลล่า")}</dd></div>
                  <div><dt>{t("แพ็กเกจ")}</dt><dd>{form.mode === "hourly" ? t("ฝากไม่เกิน 6 ชั่วโมง") : selectedRate.title}</dd></div>
                </dl>

                <div className="receipt-dates">
                  <div><span>{form.mode === "hourly" ? t("วันที่ฝาก") : t("วันเข้าพัก")}</span><strong>{formatReceiptDate(form.mode === "hourly" ? form.visitDate : form.checkInDate, locale)}</strong><small>{form.mode === "hourly" ? `${form.startTime} ${t("น.")}` : t("08:30–18:00 น.")}</small></div>
                  <div><span>{form.mode === "hourly" ? t("เวลารับกลับ") : t("วันรับกลับ")}</span><strong>{form.mode === "hourly" ? `${form.endTime} ${t("น.")}` : formatReceiptDate(form.checkOutDate, locale)}</strong><small>{form.mode === "hourly" ? t("ภายในวันเดียวกัน") : t("12:00–18:00 น.")}</small></div>
                </div>

                <div className="receipt-payments">
                  <div><span>{t("ยอดมัดจำ")}</span><strong>{formatBaht(deposit, locale)}</strong></div>
                </div>

                <div className="receipt-account">
                  <span>{t("ชำระมัดจำผ่านพร้อมเพย์")}</span>
                  <strong>{PAYMENT_ACCOUNT}</strong>
                  <small>{t("ชื่อบัญชี:")} {PAYMENT_ACCOUNT_NAME}</small>
                  <button type="button" onClick={copyPaymentAccount}>{copied ? t("คัดลอกแล้ว ✓") : t("คัดลอกเลขบัญชี")}</button>
                </div>

                <div className="receipt-prep"><b>{t("เตรียมก่อนเข้าพัก")}</b><p>{t("วัคซีนอย่างน้อย 1 เข็ม · ป้องกันเห็บหมัดประจำเดือน · อาบน้ำทำความสะอาด · เตรียมอาหาร/ทรายหากเลือกนำมาเอง")}</p></div>
              </article>

              <div className={`line-confirmation-card ${lineMessageSent ? "sent" : "missing"}`}>
                <span className="line-confirmation-dot" aria-hidden="true">{lineMessageSent ? "✓" : "!"}</span>
                <div><b>{lineMessageSent ? t("ส่งบิลมัดจำเข้า LINE แล้ว") : t("ยังส่งบิลเข้า LINE ไม่สำเร็จ")}</b><small>{lineMessageSent ? t("ส่งภาพสลิปในแชต แล้วกดปุ่มยืนยันมัดจำในบิล") : t("ใช้รหัสคำขอด้านบนติดต่อพนักงานได้ค่ะ")}</small></div>
              </div>

              <button className="button primary full receipt-line-button" type="button" onClick={() => { void returnToLineChat(); }}>{t("กลับไปหน้าแชต LINE")}</button>
              <button className="button secondary full receipt-new-button" type="button" onClick={() => { setStep(1); setForm(initialForm); setBookingCode(""); setLineMessageSent(null); setPaymentAcknowledged(false); setCopied(false); requestId.current = null; }}>{t("เริ่มคำขอใหม่")}</button>
            </section>
          )}
        </div>

        <footer className="privacy-footer">{t("ข้อมูลส่วนตัวและข้อมูลสุขภาพจัดเก็บใน Supabase โดยจำกัดสิทธิ์การเข้าถึง")}</footer>
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
