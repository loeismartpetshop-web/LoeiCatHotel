"use client";

import { useRef, useState } from "react";
import styles from "./staff-pet-photo.module.css";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

interface PetPhotoProps {
  petId: string;
  petName: string;
  photoUrl: string | null;
  photoUpdatedAt: string | null;
  accessToken: string;
  onChanged: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}

// ย่อรูปในเครื่องก่อนอัปโหลด เพื่อไม่ให้พนักงานที่ถ่ายจากมือถือส่งไฟล์ 5-10 MB ขึ้นเซิร์ฟเวอร์
async function shrinkImage(file: File): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      element.src = bitmapUrl;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("ย่อรูปไม่สำเร็จ"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function PetPhoto({
  petId,
  petName,
  photoUrl,
  photoUpdatedAt,
  accessToken,
  onChanged,
  onError
}: PetPhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await shrinkImage(file);
      const response = await fetch(`/api/staff/pets/photo?petId=${encodeURIComponent(petId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "image/jpeg"
        },
        body: blob
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: "" })) as { error?: string };
        throw new Error(detail.error || "อัปโหลดรูปไม่สำเร็จ");
      }
      await onChanged(`อัปเดตรูปของ ${petName} แล้ว`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/staff/pets/photo?petId=${encodeURIComponent(petId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: "" })) as { error?: string };
        throw new Error(detail.error || "ลบรูปไม่สำเร็จ");
      }
      await onChanged(`ลบรูปของ ${petName} แล้ว`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.photoCell}>
      <div className={styles.frame}>
        {photoUrl
          ? <img src={photoUrl} alt={`รูปของ ${petName}`} loading="lazy" />
          : <span aria-hidden="true">{petName.trim().charAt(0) || "?"}</span>}
        {busy && <i className={styles.busy}>กำลังบันทึก...</i>}
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {photoUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}
        </button>
        {photoUrl && (
          <button type="button" className={styles.removeButton} disabled={busy} onClick={remove}>
            ลบรูป
          </button>
        )}
      </div>
      {photoUpdatedAt && <small>อัปเดต {formatUpdatedAt(photoUpdatedAt)}</small>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
