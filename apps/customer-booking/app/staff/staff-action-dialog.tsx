"use client";

import dialogStyles from "./staff-action-dialog.module.css";

interface StaffActionDialogProps {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  tone?: "primary" | "danger";
  requiredCode?: string | undefined;
  confirmation?: string;
  error?: string;
  onConfirmationChange?: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StaffActionDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy,
  tone = "primary",
  requiredCode,
  confirmation = "",
  error = "",
  onConfirmationChange,
  onCancel,
  onConfirm
}: StaffActionDialogProps) {
  const codeMatches = !requiredCode
    || confirmation.trim().toUpperCase() === requiredCode.toUpperCase();

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <form
        className={dialogStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-action-title"
        aria-describedby="staff-action-description"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && codeMatches) onConfirm();
        }}
      >
        <header>
          <div className={`${dialogStyles.icon} ${tone === "danger" ? dialogStyles.dangerIcon : ""}`} aria-hidden="true">
            {tone === "danger" ? "!" : "✓"}
          </div>
          <div>
            <span>{eyebrow}</span>
            <h2 id="staff-action-title">{title}</h2>
          </div>
        </header>

        <div className={dialogStyles.body}>
          <p id="staff-action-description">{description}</p>
          {requiredCode && (
            <label>
              <span>พิมพ์รหัส <strong>{requiredCode}</strong> เพื่อยืนยัน</span>
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => onConfirmationChange?.(event.target.value)}
                placeholder={requiredCode}
                autoComplete="off"
                disabled={busy}
              />
              {confirmation && !codeMatches && <small>รหัสยังไม่ตรง กรุณาตรวจอีกครั้ง</small>}
            </label>
          )}
          {error && <div className={dialogStyles.error} role="alert">{error}</div>}
          {busy && (
            <div className={dialogStyles.progress} role="status" aria-live="polite">
              <i aria-hidden="true" />
              <div><strong>{busyLabel}</strong><span>กรุณารอสักครู่และอย่าปิดหน้านี้</span></div>
            </div>
          )}
        </div>

        <footer>
          <button type="button" className={dialogStyles.cancelButton} onClick={onCancel} disabled={busy}>ยกเลิก</button>
          <button
            type="submit"
            className={`${dialogStyles.confirmButton} ${tone === "danger" ? dialogStyles.dangerButton : ""}`}
            disabled={busy || !codeMatches}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
