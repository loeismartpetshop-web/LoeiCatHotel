"use client";

import { useState } from "react";
import type { PurgeScope } from "@/lib/staff-purge";
import { StaffActionDialog } from "./staff-action-dialog";
import styles from "./staff-bulk-purge.module.css";

interface StaffBulkPurgeProps {
  scope: PurgeScope;
  title: string;
  description: string;
  accessToken: string;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

export function StaffBulkPurge({ scope, title, description, accessToken, onChanged, onError }: StaffBulkPurgeProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setLocalError("");
  };

  const purge = async () => {
    if (busy || !password.trim()) return;
    setBusy(true);
    setLocalError("");
    onError("");
    try {
      const response = await fetch(`/api/staff/purge/${scope}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "ลบข้อมูลทั้งหมดไม่สำเร็จ");
      setOpen(false);
      setPassword("");
      await onChanged(`${title}เรียบร้อยแล้ว`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "ลบข้อมูลทั้งหมดไม่สำเร็จ";
      setLocalError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={styles.bulkButton} type="button" onClick={() => { setOpen(true); setLocalError(""); onError(""); }}>
        ลบข้อมูลทั้งหมด
      </button>
      {open && (
        <StaffActionDialog
          eyebrow="BULK TEST DATA DELETE"
          title={title}
          description={description}
          confirmLabel="ยืนยันลบข้อมูลทั้งหมด"
          busyLabel="กำลังลบข้อมูลจาก Supabase..."
          busy={busy}
          tone="danger"
          requireConfirmation
          confirmationLabel="รหัสผ่าน Owner"
          confirmationPlaceholder="กรอกรหัสผ่านบัญชีปัจจุบัน"
          confirmationType="password"
          confirmation={password}
          error={localError}
          onConfirmationChange={setPassword}
          onCancel={close}
          onConfirm={() => void purge()}
        />
      )}
    </>
  );
}