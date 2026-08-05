"use client";

export interface ThemeSettings {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export const LOGO_THEME: ThemeSettings = {
  primary: "#493943",
  accent: "#f0a8d0",
  background: "#f9edf4",
  surface: "#fffefd",
  text: "#2d242a"
};

export const THEME_STORAGE_KEY = "loei-cat-hotel-theme-v1";

const PRESETS: Array<{ name: string; colors: ThemeSettings }> = [
  { name: "สีโลโก้", colors: LOGO_THEME },
  {
    name: "ชมพูสว่าง",
    colors: { primary: "#713c59", accent: "#f29aca", background: "#fff1f8", surface: "#ffffff", text: "#33242d" }
  },
  {
    name: "เขียวคลาสสิก",
    colors: { primary: "#284a40", accent: "#c9794e", background: "#f6f0e5", surface: "#fffefb", text: "#24322e" }
  }
];

const COLOR_FIELDS: Array<{ key: keyof ThemeSettings; label: string }> = [
  { key: "primary", label: "สีหลัก" },
  { key: "accent", label: "สีเน้น" },
  { key: "background", label: "พื้นหลัง" },
  { key: "surface", label: "พื้นการ์ด" },
  { key: "text", label: "ตัวอักษร" }
];

function normalizeHex(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex, "#000000").slice(1);
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function mix(hex: string, target: "#000000" | "#ffffff", amount: number): string {
  const source = hexToRgb(hex);
  const destination = hexToRgb(target);
  const channels = source.map((value, index) => Math.round(value + (destination[index]! - value) * amount));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function sanitizeTheme(value: Partial<ThemeSettings> | null | undefined): ThemeSettings {
  return {
    primary: normalizeHex(value?.primary ?? "", LOGO_THEME.primary),
    accent: normalizeHex(value?.accent ?? "", LOGO_THEME.accent),
    background: normalizeHex(value?.background ?? "", LOGO_THEME.background),
    surface: normalizeHex(value?.surface ?? "", LOGO_THEME.surface),
    text: normalizeHex(value?.text ?? "", LOGO_THEME.text)
  };
}

export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;
  const primaryRgb = hexToRgb(theme.primary).join(", ");
  const accentRgb = hexToRgb(theme.accent).join(", ");
  const variables: Record<string, string> = {
    "--forest-950": mix(theme.primary, "#000000", 0.48),
    "--forest-900": mix(theme.primary, "#000000", 0.34),
    "--forest-800": theme.primary,
    "--forest-700": mix(theme.primary, "#ffffff", 0.16),
    "--forest-100": mix(theme.primary, "#ffffff", 0.86),
    "--forest-50": mix(theme.primary, "#ffffff", 0.94),
    "--cream-100": theme.background,
    "--cream-50": mix(theme.background, "#ffffff", 0.45),
    "--paper": theme.surface,
    "--terracotta": theme.accent,
    "--terracotta-100": mix(theme.accent, "#ffffff", 0.82),
    "--gold": mix(theme.accent, "#ffffff", 0.18),
    "--ink": theme.text,
    "--muted": mix(theme.text, "#ffffff", 0.38),
    "--line": mix(theme.text, "#ffffff", 0.82),
    "--brand-start": mix(theme.primary, "#000000", 0.52),
    "--brand-mid": mix(theme.primary, "#000000", 0.28),
    "--brand-end": mix(theme.primary, "#ffffff", 0.04),
    "--primary-rgb": primaryRgb,
    "--accent-rgb": accentRgb
  };
  Object.entries(variables).forEach(([key, value]) => root.style.setProperty(key, value));
}

interface ThemeSettingsPanelProps {
  open: boolean;
  value: ThemeSettings;
  onChange: (theme: ThemeSettings) => void;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function ThemeSettingsPanel({ open, value, onChange, onClose, onSave, onReset }: ThemeSettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="theme-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="theme-panel" role="dialog" aria-modal="true" aria-labelledby="theme-title">
        <header className="theme-panel-header">
          <div>
            <span>BACK OFFICE · APPEARANCE</span>
            <h2 id="theme-title">ตั้งค่าธีมหน้าจอง</h2>
          </div>
          <button type="button" className="theme-close" onClick={onClose} aria-label="ปิด">×</button>
        </header>

        <p className="theme-security-note">พรีวิวและบันทึกสำหรับอุปกรณ์นี้ · การเผยแพร่ให้ลูกค้าทุกคนต้องผ่าน Staff Auth</p>

        <div className="theme-presets" aria-label="ชุดสีสำเร็จรูป">
          {PRESETS.map((preset) => (
            <button type="button" key={preset.name} onClick={() => onChange(preset.colors)}>
              <span className="preset-dots" aria-hidden="true">
                <i style={{ background: preset.colors.primary }} />
                <i style={{ background: preset.colors.accent }} />
                <i style={{ background: preset.colors.background }} />
              </span>
              {preset.name}
            </button>
          ))}
        </div>

        <div className="theme-color-grid">
          {COLOR_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <div>
                <input
                  type="color"
                  value={value[field.key]}
                  onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                  aria-label={`${field.label} แบบเลือกสี`}
                />
                <input
                  type="text"
                  value={value[field.key]}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (/^#[0-9a-f]{6}$/i.test(next)) onChange({ ...value, [field.key]: next });
                  }}
                  aria-label={`${field.label} รหัสสี`}
                />
              </div>
            </label>
          ))}
        </div>

        <div className="theme-preview" aria-label="ตัวอย่างธีม">
          <div style={{ background: value.primary }}><span style={{ background: value.accent }} /> LOEI CAT HOTEL</div>
          <section style={{ background: value.background }}><button style={{ background: value.primary, color: value.surface }}>ตัวอย่างปุ่ม</button></section>
        </div>

        <footer className="theme-actions">
          <button type="button" className="button secondary" onClick={onReset}>คืนค่าสีโลโก้</button>
          <button type="button" className="button primary" onClick={onSave}>บันทึกธีม</button>
        </footer>
      </section>
    </div>
  );
}
