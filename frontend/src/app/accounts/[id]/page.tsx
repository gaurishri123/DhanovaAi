import { AccountDetailComponent } from "@/components/account/AccountDetailComponent";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Account Dossier: ${id} — Dhanova`,
    description: `Forensic AI mule risk evaluation, SHAP explainability chart, and RBI enforcement options for ${id}.`,
  };
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccountDetailComponent accountId={id} />;
}
