export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentKind = "accident" | "congestion" | "roadblock" | "signal_failure";
export type VehicleKind = "ambulance" | "fire" | "police";

export interface RoadEdge {
  source: string;
  target: string;
  base_time: number;
  capacity: number;
  live_load: number;
  confidence: number;
  blocked: boolean;
}

export interface Incident {
  id: string;
  node: string;
  severity: Severity;
  kind: IncidentKind;
  active: boolean;
}

export interface EmergencyVehicle {
  id: string;
  kind: VehicleKind;
  source: string;
  destination: string;
  priority: number;
}

export interface RoutePlan {
  vehicle_id: string;
  path: string[];
  eta_minutes: number;
  risk_score: number;
}

export interface SimulationState {
  timestamp: string;
  tick: number;
  roads: RoadEdge[];
  incidents: Incident[];
  emergency_vehicles: EmergencyVehicle[];
  plans: RoutePlan[];
  city_load_index: number;
  uncertainty_index: number;
  kpis: Record<string, number>;
}

export interface ScenarioItem {
  id: string;
  name: string;
  description: string;
}

export interface ScenarioResponse {
  active_scenario_id: string;
  items: ScenarioItem[];
}
