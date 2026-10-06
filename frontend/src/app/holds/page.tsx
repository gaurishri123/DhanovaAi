import { HoldManagementComponent } from "@/components/holds/HoldManagementComponent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "RBI 60-Day Hold Management — Dhanova",
  description:
    "Statutory hold enforcement, active 60-day countdown timers, early release orders, and automated hold expiry.",
};

export default function HoldsPage() {
  return <HoldManagementComponent />;
}
