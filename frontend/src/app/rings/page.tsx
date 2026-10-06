import { RingGraphComponent } from "@/components/rings/RingGraphComponent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fraud Ring Graph Intelligence — Dhanova",
  description:
    "Interactive graph visualization of multi-bank mule networks: Fan-out Dispersal, Circular Layering, and Device Farms.",
};

export default function FraudRingsPage() {
  return <RingGraphComponent />;
}
