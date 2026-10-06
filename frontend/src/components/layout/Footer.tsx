import React from "react";
import { ShieldCheck, PhoneCall, ExternalLink, Scale } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/90 py-8 px-4 text-xs text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-sm text-white">DHANOVA FRAUD ENGINE</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <p>
            MPOnline Idea & Innovation Hackathon 2026 • AI Public Services (Theme 5)
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-slate-300">
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <span>National Cyber Crime Portal</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="tel:1930"
            className="flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold transition-colors"
          >
            <PhoneCall className="h-3 w-3" />
            <span>Toll-Free Helpline 1930</span>
          </a>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Scale className="h-3 w-3" />
            <span>RBI 60-Day Hold Protocol</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
