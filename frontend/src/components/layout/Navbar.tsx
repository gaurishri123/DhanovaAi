"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Search,
  UserCheck,
  ChevronDown,
  Clock,
  PhoneCall,
  Activity,
  Network,
  CheckCircle2,
} from "lucide-react";
import { useOfficer } from "@/lib/officerContext";
import { checkBackendHealth } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { officerId, activeProfile, setOfficerId, availableProfiles } = useOfficer();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customIdInput, setCustomIdInput] = useState("");
  const [quickSearchId, setQuickSearchId] = useState("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((res) => {
      if (mounted) {
        setBackendStatus(res ? "online" : "offline");
      }
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      mounted = false;
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchId.trim()) return;
    const clean = quickSearchId.trim().toUpperCase();
    setQuickSearchId("");
    // If officer is on dashboard or rings, route to account details
    router.push(`/accounts/${clean}`);
  };

  const navLinks = [
    { href: "/dashboard", label: "Officer Dashboard", icon: Activity },
    { href: "/upi/check", label: "Citizen UPI Check", icon: ShieldAlert },
    { href: "/rings", label: "Fraud Ring Graph", icon: Network },
    { href: "/holds", label: "Hold Management", icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      {/* Top Advisory Banner */}
      <div className="bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-blue-950/90 border-b border-blue-900/40 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">
              National Cyber Crime Reporting Coordination (Theme 5 — AI Innovation for Public Services)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="tel:1930"
              className="flex items-center gap-1.5 text-red-300 hover:text-red-200 font-semibold bg-red-950/60 border border-red-800/50 px-2.5 py-0.5 rounded-full text-[11px] transition-colors"
            >
              <PhoneCall className="h-3 w-3" />
              <span>Cyber Helpline 1930</span>
            </a>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-slate-400 hidden sm:inline text-[11px]">
              RBI 2026 Digital Payment Defense Standard
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Identity */}
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0 group">
            <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-wider text-white bg-clip-text">
                  DHANOVA
                </span>
                <Badge variant="cyan" size="sm" className="font-mono text-[10px] px-1.5 py-0">
                  v2026.1
                </Badge>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                AI Mule & Fraud Ring Intelligence
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Quick Search + Officer Switcher + Backend Status */}
          <div className="flex items-center gap-3">
            {/* Quick Account Lookup */}
            <form onSubmit={handleQuickSearch} className="hidden lg:block relative">
              <input
                type="text"
                placeholder="Search ACC_..."
                value={quickSearchId}
                onChange={(e) => setQuickSearchId(e.target.value)}
                className="w-32 focus:w-44 transition-all duration-200 h-8 rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 pl-7 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <Search className="absolute left-2 top-2.2 h-3.5 w-3.5 text-slate-500" />
            </form>

            {/* Officer ID Switcher Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors shadow-sm"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <UserCheck className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono font-semibold text-blue-300">{officerId}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="border-b border-slate-800 pb-2 mb-2">
                    <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                      Current Investigation Officer
                    </p>
                    <p className="text-sm font-bold text-white mt-0.5">{activeProfile.name}</p>
                    <p className="text-xs text-blue-400 font-mono">{activeProfile.id} • {activeProfile.badge}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{activeProfile.agency}</p>
                  </div>

                  <div className="space-y-1 mb-3">
                    <p className="text-[10px] uppercase font-semibold text-slate-500 px-1">
                      Switch Duty Profile:
                    </p>
                    {availableProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setOfficerId(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                          p.id === officerId
                            ? "bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/40"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                        </div>
                        {p.id === officerId && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {/* Custom Officer ID Input */}
                  <div className="pt-2 border-t border-slate-800">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customIdInput.trim()) {
                          setOfficerId(customIdInput);
                          setCustomIdInput("");
                          setIsDropdownOpen(false);
                        }
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        placeholder="Custom ID (e.g. OFF_KA_2026)"
                        value={customIdInput}
                        onChange={(e) => setCustomIdInput(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <Button size="sm" type="submit" variant="secondary" className="text-xs h-7">
                        Set
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Backend Proxy Indicator */}
            <div className="hidden sm:flex items-center">
              {backendStatus === "online" ? (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  FastAPI Proxy Live
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Mock Fallback Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
