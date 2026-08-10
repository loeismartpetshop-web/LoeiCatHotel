import type { Metadata } from "next";
import { StaffDashboard } from "./staff-dashboard";

export const metadata: Metadata = {
  title: "Staff Dashboard | LOEI CAT HOTEL",
  description: "ระบบหลังบ้านสำหรับตรวจมัดจำและยืนยันการจอง"
};

export default function StaffPage() {
  return <StaffDashboard />;
}
