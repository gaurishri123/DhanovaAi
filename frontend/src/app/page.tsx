import { OfficerDashboardComponent } from "@/components/dashboard/OfficerDashboardComponent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Officer Command Dashboard — Dhanova",
  description: "Real-time AI mule account and fraud ring intelligence command center.",
};

export default function HomePage() {
  return <OfficerDashboardComponent />;
}
