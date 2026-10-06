import {
  Account,
  FraudRing,
  HoldActionResponse,
  RiskScoreResponse,
  Transaction,
  RiskBand,
} from "@/types/account";
import {
  MOCK_ACCOUNTS,
  MOCK_HOLDS,
  MOCK_RINGS,
  MOCK_RISK_SCORES,
  MOCK_TRANSACTIONS,
} from "./mockData";

// In-memory / browser-synced stores so officer actions persist during the session
let localAccounts: Account[] = [...MOCK_ACCOUNTS];
let localHolds: HoldActionResponse[] = [...MOCK_HOLDS];

function loadLocalStores() {
  if (typeof window === "undefined") return;
  const savedAcc = localStorage.getItem("dhanova_accounts");
  if (savedAcc) {
    try {
      localAccounts = JSON.parse(savedAcc);
    } catch {}
  }
  const savedHolds = localStorage.getItem("dhanova_holds");
  if (savedHolds) {
    try {
      localHolds = JSON.parse(savedHolds);
    } catch {}
  }
}

function persistLocalStores() {
  if (typeof window === "undefined") return;
  localStorage.setItem("dhanova_accounts", JSON.stringify(localAccounts));
  localStorage.setItem("dhanova_holds", JSON.stringify(localHolds));
}

// Initialize on first load in browser
if (typeof window !== "undefined") {
  loadLocalStores();
}

export async function checkBackendHealth(): Promise<{ status: string; model_loaded: boolean } | null> {
  try {
    const res = await fetch("/api/backend/health", { method: "GET", cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

// (a) Citizen UPI Check: /upi/check/{account_id}
export async function checkUpiAccount(accountId: string): Promise<{ data: RiskScoreResponse; source: "live" | "mock" }> {
  const cleanId = accountId.trim().toUpperCase();

  // Try live backend proxy first
  try {
    const res = await fetch(`/api/backend/upi/check/${encodeURIComponent(cleanId)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return { data, source: "live" };
    }
  } catch {
    // Backend offline; smoothly fall back to mock
  }

  // Fallback to mock data
  if (MOCK_RISK_SCORES[cleanId]) {
    return { data: MOCK_RISK_SCORES[cleanId], source: "mock" };
  }

  // If ID exists in accounts list, construct deterministic score
  const existingAcc = localAccounts.find((a) => a.account_id === cleanId);
  const score = existingAcc ? existingAcc.risk_score || 25 : 15;
  const band: RiskBand = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  const fallbackData: RiskScoreResponse = {
    account_id: cleanId,
    score,
    top_features: {
      band,
      shap: [
        {
          feature: "account_age_days",
          value: existingAcc?.account_age_days || 180,
          direction: score >= 40 ? "increases_risk" : "decreases_risk",
          contribution: score >= 40 ? 0.25 : -0.2,
          description: `Account has been active for ${existingAcc?.account_age_days || 180} days`,
        },
        {
          feature: "night_txn_ratio",
          value: score >= 70 ? 0.45 : 0.05,
          direction: score >= 70 ? "increases_risk" : "decreases_risk",
          contribution: score >= 70 ? 0.3 : -0.15,
          description: score >= 70 ? "Unusual night activity observed" : "Regular standard-hours activity",
        },
      ],
    },
    explanation_text:
      score >= 70
        ? `HIGH RISK ALERT: Account ${cleanId} displays anomalous payment behavior with nocturnal transaction clustering and rapid pass-through velocity.`
        : score >= 40
        ? `CAUTION ADVISED: Account ${cleanId} shows moderate atypical activity. Verify counterparty identity before transferring funds.`
        : `SAFE TO PROCEED: Account ${cleanId} verified with no suspicious indicators or linkage to known fraud syndicates.`,
    ring_id: existingAcc?.ring_id || null,
    computed_at: new Date().toISOString(),
  };

  return { data: fallbackData, source: "mock" };
}

// (b) Accounts List & Filters
export async function getAccounts(filters?: {
  search?: string;
  status?: string;
  riskBand?: string;
  bank?: string;
}): Promise<Account[]> {
  loadLocalStores();
  let result = [...localAccounts];

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (a) =>
        a.account_id.toLowerCase().includes(q) ||
        a.holder_name.toLowerCase().includes(q) ||
        (a.upi_vpa && a.upi_vpa.toLowerCase().includes(q))
    );
  }

  if (filters?.status && filters.status !== "all") {
    result = result.filter((a) => a.status === filters.status);
  }

  if (filters?.bank && filters.bank !== "all") {
    result = result.filter((a) => a.bank_name.toLowerCase() === filters.bank?.toLowerCase());
  }

  if (filters?.riskBand && filters.riskBand !== "all") {
    if (filters.riskBand === "high") {
      result = result.filter((a) => (a.risk_score || 0) >= 70);
    } else if (filters.riskBand === "medium") {
      result = result.filter((a) => (a.risk_score || 0) >= 40 && (a.risk_score || 0) < 70);
    } else if (filters.riskBand === "low") {
      result = result.filter((a) => (a.risk_score || 0) < 40);
    }
  }

  return result;
}

export async function getAccountById(accountId: string): Promise<Account | null> {
  loadLocalStores();
  const cleanId = accountId.trim().toUpperCase();
  const found = localAccounts.find((a) => a.account_id === cleanId);
  if (found) return found;

  // Synthesize entry if not in static list
  return {
    account_id: cleanId,
    holder_name: `Account Holder (${cleanId})`,
    bank_name: "SBI",
    account_age_days: 90,
    kyc_level: "full",
    status: "clear",
    risk_score: 20,
    upi_vpa: `${cleanId.toLowerCase()}@oksbi`,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  };
}

export async function getAccountTransactions(accountId: string): Promise<Transaction[]> {
  const cleanId = accountId.trim().toUpperCase();
  if (MOCK_TRANSACTIONS[cleanId]) {
    return MOCK_TRANSACTIONS[cleanId];
  }

  // Return generated mock transactions
  return [
    {
      txn_id: `TXN_${Math.floor(Math.random() * 899999 + 100000)}`,
      sender_account_id: cleanId,
      receiver_account_id: "ACC_00001",
      amount: 450,
      channel: "UPI",
      device_id: "DEV_IN_401",
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      is_flagged: false,
      tag: "P2P Payment",
    },
    {
      txn_id: `TXN_${Math.floor(Math.random() * 899999 + 100000)}`,
      sender_account_id: "ACC_00002",
      receiver_account_id: cleanId,
      amount: 1200,
      channel: "UPI",
      device_id: "DEV_IN_401",
      timestamp: new Date(Date.now() - 26 * 3600000).toISOString(),
      is_flagged: false,
      tag: "UPI Settlement",
    },
  ];
}

// (c) Hold & Release Actions
export async function placeHoldAction(
  accountId: string,
  reason: string,
  officerId: string
): Promise<{ data: HoldActionResponse; source: "live" | "mock" }> {
  loadLocalStores();
  const cleanId = accountId.trim().toUpperCase();

  // Try live backend POST /actions/hold
  try {
    const res = await fetch("/api/backend/actions/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: cleanId, reason, officer_id: officerId }),
    });
    if (res.ok) {
      const data = await res.json();
      // Update local cache
      localAccounts = localAccounts.map((a) =>
        a.account_id === cleanId ? { ...a, status: "on_hold", active_hold_id: data.action_id } : a
      );
      localHolds.unshift(data);
      persistLocalStores();
      return { data, source: "live" };
    }
  } catch {}

  // Local fallback
  const actionId = `ACT_HOLD_${Math.floor(Math.random() * 89999 + 10000)}`;
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days exactly per RBI

  const newHold: HoldActionResponse = {
    action_id: actionId,
    account_id: cleanId,
    officer_id: officerId,
    reason,
    hold_start: now.toISOString(),
    hold_expiry: expiry.toISOString(),
    status: "active",
  };

  localAccounts = localAccounts.map((a) =>
    a.account_id === cleanId ? { ...a, status: "on_hold", active_hold_id: actionId } : a
  );
  localHolds.unshift(newHold);
  persistLocalStores();

  return { data: newHold, source: "mock" };
}

export async function releaseHoldAction(
  actionId: string
): Promise<{ message: string; account_id?: string; source: "live" | "mock" }> {
  loadLocalStores();

  // Try live backend POST /actions/release/{action_id}
  try {
    const res = await fetch(`/api/backend/actions/release/${encodeURIComponent(actionId)}`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      localHolds = localHolds.map((h) => (h.action_id === actionId ? { ...h, status: "released" } : h));
      if (data.account_id) {
        localAccounts = localAccounts.map((a) =>
          a.account_id === data.account_id ? { ...a, status: "clear", active_hold_id: undefined } : a
        );
      }
      persistLocalStores();
      return { ...data, source: "live" };
    }
  } catch {}

  // Local fallback
  const hold = localHolds.find((h) => h.action_id === actionId);
  const accountId = hold?.account_id;

  localHolds = localHolds.map((h) => (h.action_id === actionId ? { ...h, status: "released" } : h));
  if (accountId) {
    localAccounts = localAccounts.map((a) =>
      a.account_id === accountId ? { ...a, status: "clear", active_hold_id: undefined } : a
    );
  }
  persistLocalStores();

  return {
    message: `Hold ${actionId} released successfully under officer order.`,
    account_id: accountId,
    source: "mock",
  };
}

export async function checkExpiredHoldsAction(): Promise<{ message: string; expired_count: number; source: "live" | "mock" }> {
  loadLocalStores();

  // Try live backend GET /actions/holds/expired
  try {
    const res = await fetch("/api/backend/actions/holds/expired", { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      return { message: data.message, expired_count: 0, source: "live" };
    }
  } catch {}

  // Local fallback
  const now = Date.now();
  let count = 0;

  localHolds = localHolds.map((hold) => {
    if (hold.status === "active" && new Date(hold.hold_expiry).getTime() <= now) {
      count++;
      // Release account
      localAccounts = localAccounts.map((a) =>
        a.account_id === hold.account_id ? { ...a, status: "clear", active_hold_id: undefined } : a
      );
      return { ...hold, status: "expired" };
    }
    return hold;
  });

  persistLocalStores();
  return {
    message: `Processed and auto-expired ${count} hold(s) past their 60-day statutory window.`,
    expired_count: count,
    source: "mock",
  };
}

// (d) Gemini Case Chat: POST /chat/
export async function sendCaseChat(
  accountId: string,
  question: string
): Promise<{ answer: string; source: "live" | "mock" }> {
  const cleanId = accountId.trim().toUpperCase();

  // Try live backend
  try {
    const res = await fetch("/api/backend/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: cleanId, question }),
    });
    if (res.ok) {
      const data = await res.json();
      return { answer: data.answer, source: "live" };
    }
  } catch {}

  // Intelligent Context-Aware Mock Response
  const acc = localAccounts.find((a) => a.account_id === cleanId);
  const risk = MOCK_RISK_SCORES[cleanId];
  const qLower = question.toLowerCase();

  let answer = "";
  if (qLower.includes("summar") || qLower.includes("overview") || qLower.includes("what happened")) {
    answer = `Account ${cleanId} (${acc?.holder_name || "Suspect"}, ${acc?.bank_name || "Bank"}) is scored at ${
      risk?.score || acc?.risk_score || 90
    }/100. It shows classic mule characteristics: high velocity nocturnal transfers, pass-through ratio exceeding 95%, and immediate distribution of large inbound deposits in chunks calibrated just under ₹10,000.`;
  } else if (qLower.includes("ring") || qLower.includes("cluster") || qLower.includes("syndicate")) {
    answer = `This account is tied to ${acc?.ring_id || "a detected fraud ring"}. Network analysis revealed coordinated transfers across ${
      acc?.bank_name || "multiple banks"
    } designed to break audit trails. Top connections include rapid dispersal mules.`;
  } else if (qLower.includes("hold") || qLower.includes("action") || qLower.includes("freeze") || qLower.includes("recommend")) {
    answer = `Recommendation: Immediate statutory 60-day hold under RBI 2026 Digital Payment Fraud Mitigation Framework. Ensure freeze order is dispatched to ${
      acc?.bank_name || "nodal bank"
    } and correlate with National Cyber Crime Reporting Portal (1930) tickets.`;
  } else if (qLower.includes("structur") || qLower.includes("10,000") || qLower.includes("10000")) {
    answer = `Yes, extensive structuring detected. 85%+ of outbound transactions fall in the ₹9,000–₹9,999 band, spaced 2 to 5 minutes apart, indicating intentional avoidance of the ₹10,000 AML reporting threshold.`;
  } else {
    answer = `Based on forensic features for ${cleanId}: Risk score is ${
      risk?.score || acc?.risk_score || 85
    }/100. Notable signals include low account age (${acc?.account_age_days || 14} days), pass-through ratio of 0.98, and suspicious night-time transaction clustering.`;
  }

  return { answer, source: "mock" };
}

// (e) Fraud Rings
export async function getFraudRings(archetypeFilter?: string): Promise<FraudRing[]> {
  if (!archetypeFilter || archetypeFilter === "all") {
    return MOCK_RINGS;
  }
  return MOCK_RINGS.filter((r) => r.archetype === archetypeFilter);
}

export async function getFraudRingById(ringId: string): Promise<FraudRing | null> {
  const found = MOCK_RINGS.find((r) => r.ring_id === ringId);
  return found || null;
}

// (f) Holds List
export async function getAllHolds(): Promise<HoldActionResponse[]> {
  loadLocalStores();
  return [...localHolds];
}
