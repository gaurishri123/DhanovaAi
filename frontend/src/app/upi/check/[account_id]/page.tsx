import { CitizenCheckComponent } from "@/components/upi/CitizenCheckComponent";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ account_id: string }>;
}): Promise<Metadata> {
  const { account_id } = await params;
  return {
    title: `UPI Check for ${account_id} — Dhanova`,
    description: `Real-time AI mule risk assessment and safety analysis for account ${account_id}`,
  };
}

export default async function CitizenCheckAccountPage({
  params,
}: {
  params: Promise<{ account_id: string }>;
}) {
  const { account_id } = await params;
  return <CitizenCheckComponent initialAccountId={account_id} />;
}
