import { CitizenCheckComponent } from "@/components/upi/CitizenCheckComponent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Citizen UPI Safety Check — Dhanova",
  description: "Check any UPI ID or account ID for mule fraud risk before completing digital payments.",
};

export default function CitizenCheckPage() {
  return <CitizenCheckComponent />;
}
