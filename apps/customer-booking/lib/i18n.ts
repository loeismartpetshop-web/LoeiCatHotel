// คำแปลเก็บเป็น dictionary คงที่ ไม่ได้เรียก AI แปลสด จึงไม่มีค่าใช้จ่ายและคำแปลไม่เปลี่ยนไปมา
// key คือข้อความไทยที่ใช้ในหน้าเว็บ ถ้าไม่มีคำแปลอังกฤษจะ fallback เป็นภาษาไทยเดิม

export type Locale = "th" | "en";

export const LOCALE_STORAGE_KEY = "loei-cat-hotel-locale";
export const SUPPORTED_LOCALES: Locale[] = ["th", "en"];

const EN: Record<string, string> = {
  // แบรนด์และหน้าแรก
  "โรงแรมแมวเมืองเลย": "Loei Cat Hotel",
  "โลโก้ LOEI CAT HOTEL": "LOEI CAT HOTEL logo",
  "ข้อมูลโรงแรม": "Hotel information",
  "พักสบาย ดูแลเหมือนอยู่บ้าน": "A comfortable stay, cared for like home",
  "วันหยุดของคุณ": "Your holiday",
  "คือวันพักผ่อนของน้อง": "is their holiday too",
  "ห้องพักส่วนตัว ดูแลอาหาร น้ำ สุขภาพ และส่งต่อข้อมูลสำคัญถึงพนักงานอย่างเป็นระบบ":
    "Private rooms with food, water and health care, and every important detail handed to our staff.",
  "รับสูงสุดต่อวัน": "cats per day, maximum",
  "เปิดบริการทุกวัน": "Open every day",
  "1 ครอบครัว": "1 family",
  "ต่อหนึ่งห้องพัก": "per room",
  "· โทร 083-917-8794": "· Tel 083-917-8794",
  "จาก LINE OA": "from LINE OA",

  // ขั้นตอน
  "ขั้นตอนการจอง": "Booking steps",
  "ขั้นตอน": "Step",
  "จาก 4": "of 4",
  "วันเข้าพัก": "Check-in",
  "ห้องและแพ็กเกจ": "Room & package",
  "ข้อมูลน้องแมว": "Cat details",
  "ตรวจสอบ": "Review",
  "น้องจะมาพักวันไหนคะ?": "When will your cat be staying?",
  "เลือกห้องและการดูแล": "Choose a room and care options",
  "รู้จักผู้ปกครองและน้องแมว": "About you and your cat",
  "ตรวจสอบและชำระมัดจำ": "Review and pay the deposit",
  "เลือกช่วงเวลาและจำนวนแมว เพื่อเตรียมตรวจห้องว่าง":
    "Pick your dates and the number of cats so we can check availability.",
  "ราคา Villa และ Condo เท่ากัน เลือกให้เหมาะกับน้องได้เลย":
    "Villa and Condo cost the same — pick whichever suits your cat.",
  "เอกสารวัคซีนและการป้องกันเห็บหมัดส่งภายหลังได้":
    "Vaccination and flea-prevention documents can be sent later.",
  "ตรวจข้อมูลและยอดมัดจำ จากนั้นโอนและส่งสลิปผ่าน LINE OA":
    "Check the details and deposit, then transfer and send the slip via LINE OA.",

  // ขั้นตอน 1
  "รูปแบบการเข้าพัก": "Stay type",
  "พักค้างคืน": "Overnight stay",
  "150 หรือ 250 บาท/ตัว/คืน": "THB 150 or 250 per cat per night",
  "ฝากรายชั่วโมง": "Hourly day care",
  "ไม่เกิน 6 ชั่วโมง · 100 บาท/ตัว": "Up to 6 hours · THB 100 per cat",
  "วันรับกลับ": "Pick-up date",
  "วันที่ฝาก": "Drop-off date",
  "เวลาฝาก": "Drop-off time",
  "เวลารับกลับ": "Pick-up time",
  "จำนวนแมว": "Number of cats",
  "สูงสุดรวมทั้งโรงแรม 30 ตัวต่อวัน": "Up to 30 cats in the hotel per day",
  "ลดจำนวนแมว": "Decrease number of cats",
  "เพิ่มจำนวนแมว": "Increase number of cats",
  "ตัว": "cat(s)",
  "ตัว ·": "cat(s) ·",
  "/ ตัว": "/ cat",
  "เลือกวันและจำนวนแมว": "Select dates and number of cats",
  "ระบบจะบันทึกช่วงเวลาที่ต้องการไว้ในคำขอจอง":
    "We will save your requested dates with the booking request.",

  // ขั้นตอน 2
  "ประเภทห้องพัก": "Room type",
  "ห้องเดียวกันสำหรับแมวครอบครัวเดียวกัน": "One room per family of cats",
  "วิลล่า": "Villa",
  "คอนโด": "Condo",
  "ห้องวิลล่า": "Villa room",
  "ห้องคอนโด": "Condo room",
  "ห้องไม้ส่วนตัว · 1–2 ตัว/ห้อง": "Private wooden room · 1–2 cats per room",
  "พื้นที่แนวตั้ง 3 ชั้น · 2–4 ตัว/ห้อง": "Three-level vertical space · 2–4 cats per room",
  "รองรับไม่เกิน 2 ตัวต่อห้อง": "Up to 2 cats per room",
  "แนะนำก่อน": "Recommended",
  "ต้องจัดหลายห้อง": "Needs multiple rooms",
  "ข้อมูลปัจจุบันยังไม่เปิดสำหรับแมว 1 ตัว": "Not available for a single cat at the moment",
  "พนักงานจะช่วยตรวจและจัดห้องให้เหมาะสมผ่าน LINE OA":
    "Our staff will review and arrange suitable rooms via LINE OA.",
  "แพ็กเกจดูแล": "Care package",
  "ราคาต่อแมว 1 ตัว ต่อคืน": "Price per cat per night",
  "โรงแรมจัดเตรียมให้": "Hotel provides everything",
  "รวมอาหาร น้ำ และทราย": "Includes food, water and litter",
  "นำอาหารและทรายมาเอง": "Bring your own food and litter",
  "นำอาหารและทรายเต้าหู้ของน้องมาเอง": "Bring your cat's own food and tofu litter",
  "ยืนยันห้องและแพ็กเกจ": "Confirm room and package",

  // ขั้นตอน 3
  "ข้อมูลผู้ปกครองและแมว": "Owner and cat details",
  "ชื่อผู้ปกครอง *": "Your name *",
  "เช่น คุณกานต์": "e.g. Kan",
  "เบอร์โทรศัพท์ 10 ตัว *": "Phone number, 10 digits *",
  "/10 ตัว": "/10 digits",
  "บัญชี Xiaomi (Mi Home) สำหรับดูกล้อง": "Xiaomi (Mi Home) account for camera access",
  "Xiaomi Account ID เช่น 1234567890 หรืออีเมล/เบอร์ที่ผูกบัญชี":
    "Xiaomi Account ID e.g. 1234567890, or the linked email/phone",
  "ไม่ใช่รหัสของตัวกล้อง แต่เป็นบัญชีผู้รับสิทธิ์ และบัญชีต้องตั้งภูมิภาคเป็นไทยเหมือนกล้องของโรงแรม":
    "This is not the camera's code — it is the account that receives access, and its region must be Thailand, same as the hotel's cameras.",
  "กรอกหากต้องการให้พนักงานแชร์สิทธิ์ดูกล้องห้องพักให้บัญชีนี้ (ไม่บังคับ)":
    "Fill this in if you want staff to share room-camera access with this account (optional).",
  "ตรวจพบรูปแบบ Xiaomi Account ID (ตัวเลข) ใช้แชร์กล้องได้":
    "Looks like a numeric Xiaomi Account ID — this can receive camera access.",
  "ตรวจพบอีเมล ต้องเป็นอีเมลที่ผูกกับบัญชี Xiaomi เท่านั้น":
    "Looks like an email — it must be the email linked to a Xiaomi account.",
  "ตรวจพบเบอร์โทร ต้องเป็นเบอร์ที่ผูกกับบัญชี Xiaomi เท่านั้น":
    "Looks like a phone number — it must be the number linked to a Xiaomi account.",
  "รูปแบบนี้ Mi Home อาจไม่รู้จัก ใช้ Xiaomi Account ID (ตัวเลข) หรืออีเมล/เบอร์ที่ผูกบัญชี":
    "Mi Home may not recognise this format. Use a numeric Xiaomi Account ID, or the linked email/phone.",
  "ชื่อแมวทุกตัว *": "Name of every cat *",
  "ตัวที่": "Cat",
  "ชื่อน้องแมวตัวที่": "Name of cat",
  "การดูแลพิเศษ": "Special care",
  "เลือกได้มากกว่า 1 รายการ": "You can pick more than one",
  "มียาที่ต้องให้": "Needs medication",
  "มีโรคประจำตัวที่ไม่ติดต่อ": "Has a non-contagious condition",
  "ขี้กลัว ต้องให้เวลาปรับตัว": "Timid, needs time to settle in",
  "ไม่มีการดูแลพิเศษ": "No special care needed",
  "สถานพยาบาลประจำ": "Regular clinic",
  "สำหรับกรณีฉุกเฉิน": "For emergencies",
  "ชื่อคลินิก/โรงพยาบาลสัตว์": "Clinic / animal hospital name",
  "กรอกหากมี": "Fill in if you have one",
  "เบอร์ติดต่อ": "Contact number",
  "ไม่มีคลินิกประจำ และอนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือเมื่อเกิดเหตุฉุกเฉิน":
    "I have no regular clinic and allow the hotel to contact a partner clinic in an emergency.",
  "เอกสารสุขภาพส่งภายหลังได้": "Health documents can be sent later",
  "ระบบจะเตือนให้อัปโหลดวัคซีนและการป้องกันเห็บหมัดก่อนเข้าพัก 1 วัน":
    "We will remind you to upload vaccination and flea-prevention records one day before check-in.",

  // ขั้นตอน 4
  "ตรวจสอบข้อมูลก่อนบันทึก": "Review before submitting",
  "ตรวจสอบข้อมูล": "Review details",
  "แก้ไขข้อมูล": "Edit details",
  "แก้วันเข้าพัก": "Edit dates",
  "แก้ห้อง/แพ็กเกจ": "Edit room/package",
  "แก้ข้อมูลลูกค้า": "Edit your details",
  "ระบบจะสร้างรหัสคำขอจอง": "A booking request code will be generated",
  "ผู้ปกครอง": "Owner",
  "เบอร์โทร": "Phone",
  "ช่วงเวลา": "Dates",
  "บัญชี Mi Home": "Mi Home account",
  "ยังไม่ระบุ": "Not provided",
  "ห้องพัก": "Room",
  "น้องแมว": "Cats",
  "แพ็กเกจ": "Package",
  "จำนวน": "Quantity",
  "จำนวน / ห้อง": "Quantity / room",
  "คืน": "night(s)",
  "ฝากไม่เกิน 6 ชั่วโมง": "Day care up to 6 hours",
  "สถานพยาบาล": "Clinic",
  "ให้โรงแรมติดต่อสถานพยาบาลในเครือ": "Hotel may contact a partner clinic",
  "ค่าบริการรวม": "Total",
  "มัดจำ 50%": "Deposit 50%",
  "* ยอดมัดจำนี้จะอยู่ในสถานะรอตรวจสลิปจนกว่าพนักงานจะยืนยันผ่าน LINE OA":
    "* The deposit stays pending until our staff verify your slip via LINE OA.",
  "ชำระมัดจำผ่านพร้อมเพย์": "Pay the deposit via PromptPay",
  "ชำระมัดจำก่อนส่งคำขอ": "Pay the deposit before submitting",
  "ยอดมัดจำ": "Deposit",
  "ยอดมัดจำ 50% ·": "Deposit 50% ·",
  "ยอดที่ต้องโอน": "Amount to transfer",
  "เลขบัญชี/พร้อมเพย์": "Account / PromptPay",
  "ชื่อบัญชี:": "Account name:",
  "คัดลอก": "Copy",
  "คัดลอกแล้ว ✓": "Copied ✓",
  "คัดลอกเลขบัญชี": "Copy account number",
  "ส่งภาพสลิปในแชต LINE แล้วกด “ยืนยันมัดจำ” ในบิล":
    "Send the slip photo in the LINE chat, then tap \"Confirm deposit\" on the bill.",
  "ส่งภาพสลิปในแชต แล้วกดปุ่มยืนยันมัดจำในบิล":
    "Send the slip in the chat, then tap the confirm-deposit button on the bill.",
  "ฉันตรวจสอบยอดมัดจำและเลขบัญชีแล้ว และจะส่งสลิปผ่าน LINE OA หลังส่งคำขอ":
    "I have checked the deposit amount and account number, and will send the slip via LINE OA after submitting.",
  "ยืนยันว่าข้อมูลถูกต้อง และยินยอมให้ LOEI CAT HOTEL จัดเก็บข้อมูลส่วนบุคคลและข้อมูลสุขภาพของสัตว์เพื่อดำเนินคำขอจองและการดูแล":
    "I confirm the details are correct and consent to LOEI CAT HOTEL storing my personal data and my pet's health data to process this booking and provide care.",
  "ระบบจะบันทึกคำขอและยอดมัดจำรอตรวจสอบ":
    "Your request and deposit will be saved as pending verification.",
  "ส่งคำขอและรับบิล": "Submit and get the bill",
  "กำลังส่งคำขอ...": "Submitting...",
  "ย้อนกลับ": "Back",
  "ตรวจห้องว่าง": "Check availability",

  // ขั้นตอน 5
  "รับคำขอจองแล้ว": "Booking request received",
  "โรงแรมแมวเมืองเลยยินดีให้บริการ": "Thank you for choosing Loei Cat Hotel",
  "รหัสคำขอจอง": "Booking request code",
  "หลังส่งคำขอ ระบบจะส่งบิลมัดจำเข้า LINE ให้ส่งภาพสลิปในแชต แล้วกด “ยืนยันมัดจำ” ค่ะ":
    "We have sent the deposit bill to your LINE chat. Send the slip photo there, then tap \"Confirm deposit\".",
  "ส่งบิลมัดจำเข้า LINE แล้ว": "Deposit bill sent to LINE",
  "ยังส่งบิลเข้า LINE ไม่สำเร็จ": "Could not send the bill to LINE yet",
  "เมื่อพนักงานยืนยันสลิป ระบบจะส่งบิลยอดคงเหลือสำหรับวันเช็กอิน":
    "Once staff verify your slip, we will send the remaining balance bill for check-in day.",
  "ใช้รหัสคำขอด้านบนติดต่อพนักงานได้ค่ะ": "Use the code above when contacting our staff.",
  "เตรียมก่อนเข้าพัก": "Before check-in",
  "วัคซีนอย่างน้อย 1 เข็ม · ป้องกันเห็บหมัดประจำเดือน · อาบน้ำทำความสะอาด · เตรียมอาหาร/ทรายหากเลือกนำมาเอง":
    "At least one vaccination · monthly flea prevention · a clean bath · bring food/litter if you chose that option",
  "กลับไปหน้าแชต LINE": "Back to LINE chat",
  "เริ่มคำขอใหม่": "Start a new request",
  "ข้อมูลส่วนตัวและข้อมูลสุขภาพจัดเก็บใน Supabase โดยจำกัดสิทธิ์การเข้าถึง":
    "Personal and health data are stored in Supabase with restricted access.",

  // ข้อความแจ้งเตือน
  "กรุณาเลือกวันเข้าพักและวันรับกลับ": "Please select a check-in and pick-up date.",
  "วันรับกลับต้องอยู่หลังวันเข้าพัก": "The pick-up date must be after the check-in date.",
  "กรุณาเลือกวันที่ฝากน้อง": "Please select the drop-off date.",
  "เวลารับกลับต้องอยู่หลังเวลาฝาก": "The pick-up time must be after the drop-off time.",
  "ฝากเกิน 6 ชั่วโมงจะคิดเป็นราคาค้างคืน กรุณาเลือกแบบค้างคืน":
    "Stays over 6 hours are charged at the overnight rate. Please choose an overnight stay.",
  "การจองมากกว่า 4 ตัวต้องให้พนักงานช่วยจัดหลายห้อง กรุณาติดต่อ LINE OA @002lffmk":
    "Bookings for more than 4 cats need staff to arrange multiple rooms. Please contact LINE OA @002lffmk.",
  "กรุณากรอกชื่อผู้ปกครอง": "Please enter your name.",
  "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 ตัว โดยขึ้นต้นด้วย 0":
    "Please enter a 10-digit phone number starting with 0.",
  "กรุณากรอกชื่อแมวให้ครบทุกตัว": "Please enter a name for every cat.",
  "กรุณาระบุสถานพยาบาลประจำ หรืออนุญาตให้โรงแรมติดต่อสถานพยาบาลในเครือ":
    "Please give a regular clinic, or allow the hotel to contact a partner clinic.",
  "กรุณาตรวจสอบยอดมัดจำและเลขบัญชีก่อนส่งคำขอจอง":
    "Please check the deposit amount and account number before submitting.",
  "กรุณายืนยันข้อมูลและยินยอมให้จัดเก็บข้อมูลเพื่อดำเนินคำขอจอง":
    "Please confirm your details and consent to data storage to continue.",
  "คัดลอกเลขบัญชีอัตโนมัติไม่ได้ กรุณากดค้างที่เลขบัญชีเพื่อคัดลอก":
    "Automatic copying is unavailable. Press and hold the account number to copy it.",
  "บันทึกคำขอไม่สำเร็จ": "Could not save your request.",
  "บันทึกคำขอไม่สำเร็จ กรุณาลองใหม่": "Could not save your request. Please try again.",

  // หน่วยและเวลา
  "บาท": "THB",
  "น.": "",
  "฿": "฿",
  ":": ":",
  "08:30–18:00 น.": "08:30–18:00",
  "12:00–18:00 น.": "12:00–18:00",
  "100 บาท": "THB 100",
  "ภายในวันเดียวกัน": "Same day",
  "ยังไม่ได้เลือกวัน": "No date selected",
  "เลือกภาษา": "Choose language",
  "เพิ่มรูป": "Add photo",
  "เพิ่มรูปน้อง": "Add photo",
  "เปลี่ยนรูป": "Change photo",
  "ลบรูป": "Remove photo",
  "รูปของ": "Photo of",
  "แปลงรูปน้องแมวไม่สำเร็จ กรุณาเลือกไฟล์รูปอื่น": "Could not process that image. Please pick another file.",
  "แนบรูปน้องได้ 1 รูปต่อตัว ช่วยให้พนักงานจำน้องได้ถูกตัว และใช้ช่วยประกาศตามหาหากน้องหาย (ไม่บังคับ)":
    "You can attach one photo per cat. It helps our staff recognise your cat and can be used in a lost-cat notice (optional)."
};

const DICTIONARIES: Record<Locale, Record<string, string>> = { th: {}, en: EN };

export function translate(text: string, locale: Locale): string {
  if (locale === "th") return text;
  const value = DICTIONARIES[locale][text];
  return value === undefined ? text : value;
}

export function dateLocaleTag(locale: Locale): string {
  return locale === "en" ? "en-GB" : "th-TH";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as string[]).includes(value);
}

// ลำดับการเลือกภาษา: ที่ผู้ใช้เคยเลือกไว้ → ภาษาของ browser → ไทย
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "th";
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // localStorage ถูกปิดใน in-app browser บางตัว ให้ข้ามไปดูภาษาของเครื่องต่อ
  }
  const languages = window.navigator.languages ?? [window.navigator.language];
  for (const language of languages) {
    const tag = language?.toLowerCase() ?? "";
    if (tag.startsWith("th")) return "th";
    if (tag.startsWith("en")) return "en";
  }
  return "th";
}
