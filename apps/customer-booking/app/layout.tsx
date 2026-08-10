import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "จองห้องพัก | LOEI CAT HOTEL",
    description: "ตรวจห้องว่างและส่งคำขอจองโรงแรมแมวเมืองเลยผ่าน LINE OA",
    applicationName: "LOEI CAT HOTEL Booking",
    icons: {
      icon: [{ url: "/loeicathotel-logo.webp", type: "image/webp" }],
      shortcut: "/loeicathotel-logo.webp",
      apple: "/loeicathotel-logo.webp"
    },
    formatDetection: { telephone: false },
    openGraph: {
      title: "จองห้องพัก — LOEI CAT HOTEL",
      description: "พื้นที่พักผ่อนที่อบอุ่น ปลอดภัย และใส่ใจสำหรับน้องแมว",
      locale: "th_TH",
      type: "website",
      images: [{ url: new URL("/og.png", baseUrl).toString(), width: 1736, height: 907 }]
    },
    twitter: {
      card: "summary_large_image",
      title: "จองห้องพัก — LOEI CAT HOTEL",
      description: "พื้นที่พักผ่อนที่อบอุ่น ปลอดภัย และใส่ใจสำหรับน้องแมว",
      images: [new URL("/og.png", baseUrl).toString()]
    }
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
