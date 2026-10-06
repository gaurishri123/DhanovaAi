import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { OfficerProvider } from "@/lib/officerContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dhanova — AI Mule Account & Fraud Ring Intelligence Platform",
  description:
    "Graph-based AI system detecting mule accounts and fraud rings across Indian digital payment networks. Real-time citizen UPI verification, SHAP explainable risk scores, and RBI 2026-compliant 60-day hold enforcement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#070b12] text-slate-100 min-h-screen flex flex-col`}
      >
        <OfficerProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <Footer />
        </OfficerProvider>
      </body>
    </html>
  );
}
