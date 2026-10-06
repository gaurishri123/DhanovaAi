"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { OfficerProfile } from "@/types/account";
import { OFFICER_PROFILES } from "@/lib/mockData";

interface OfficerContextType {
  officerId: string;
  activeProfile: OfficerProfile;
  setOfficerId: (id: string) => void;
  availableProfiles: OfficerProfile[];
}

const defaultProfile = OFFICER_PROFILES[0]; // OFF_MP_2026

const OfficerContext = createContext<OfficerContextType>({
  officerId: "OFF_MP_2026",
  activeProfile: defaultProfile,
  setOfficerId: () => {},
  availableProfiles: OFFICER_PROFILES,
});

export const OfficerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [officerId, setOfficerIdState] = useState<string>("OFF_MP_2026");

  useEffect(() => {
    const saved = localStorage.getItem("dhanova_officer_id");
    if (saved) {
      setOfficerIdState(saved);
    }
  }, []);

  const setOfficerId = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;
    setOfficerIdState(cleanId);
    if (typeof window !== "undefined") {
      localStorage.setItem("dhanova_officer_id", cleanId);
    }
  };

  const activeProfile: OfficerProfile =
    OFFICER_PROFILES.find((p) => p.id === officerId) || {
      id: officerId,
      name: `Special Officer (${officerId})`,
      badge: `AUTH-${officerId.slice(-4)}`,
      agency: "Cyber Command Task Force",
      jurisdiction: "Active Investigation Unit",
    };

  return (
    <OfficerContext.Provider
      value={{
        officerId,
        activeProfile,
        setOfficerId,
        availableProfiles: OFFICER_PROFILES,
      }}
    >
      {children}
    </OfficerContext.Provider>
  );
};

export const useOfficer = () => useContext(OfficerContext);
