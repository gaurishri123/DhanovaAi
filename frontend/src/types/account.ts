export type AccountStatus = "clear" | "flagged" | "on_hold";
export type KycLevel = "basic" | "full";
export type RiskBand = "low" | "medium" | "high";

export interface Account {
  account_id: string;
  holder_name: string;
  bank_name: string;
  account_age_days: number;
  kyc_level: KycLevel;
  status: AccountStatus;
  persona?: "salaried" | "merchant" | "student" | "dormant" | "family" | "burst_mule" | "mule_funnel";
  upi_vpa?: string;
  risk_score?: number;
  ring_id?: string;
  active_hold_id?: string;
  created_at?: string;
}

export interface ShapReason {
  feature: string;
  value: number;
  direction: "increases_risk" | "decreases_risk";
  contribution: number;
  description?: string;
}

export interface RiskScoreResponse {
  account_id: string;
  score: number;
  top_features: {
    band: RiskBand;
    shap: ShapReason[];
  };
  explanation_text?: string;
  ring_id?: string | null;
  computed_at: string;
}

export interface Transaction {
  txn_id: string;
  sender_account_id: string;
  receiver_account_id: string;
  amount: number;
  channel: "UPI" | "IMPS" | "NEFT";
  device_id?: string;
  timestamp: string;
  is_flagged?: boolean;
  tag?: string;
}

export interface HoldActionRequest {
  account_id: string;
  reason: string;
  officer_id: string;
}

export interface HoldActionResponse {
  action_id: string;
  account_id: string;
  officer_id: string;
  reason: string;
  hold_start: string;
  hold_expiry: string;
  status: "active" | "released" | "expired";
}

export type RingArchetype = 
  | "fan_out_dispersal" 
  | "circular_layering" 
  | "device_farm" 
  | "burst_mule" 
  | "fan_in_collector";

export interface GraphNode {
  id: string;
  label: string;
  type: "account" | "device";
  role?: "hub" | "source" | "mule" | "collector" | "device";
  risk_score?: number;
  bank?: string;
  status?: AccountStatus;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  count: number;
  channel?: string;
  is_suspicious?: boolean;
}

export interface FraudRing {
  ring_id: string;
  name: string;
  archetype: RingArchetype;
  member_account_ids: string[];
  total_flow_amount: number;
  detection_method: string;
  detected_at: string;
  risk_score: number;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface OfficerProfile {
  id: string;
  name: string;
  badge: string;
  agency: string;
  jurisdiction: string;
}
