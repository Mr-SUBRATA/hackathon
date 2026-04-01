from typing import Dict, List, Literal

from pydantic import BaseModel, Field


class RoadEdge(BaseModel):
    source: str
    target: str
    base_time: float = Field(..., gt=0)
    capacity: int = Field(..., gt=0)
    live_load: float = Field(..., ge=0)
    confidence: float = Field(..., ge=0, le=1)
    blocked: bool = False


class Incident(BaseModel):
    id: str
    node: str
    severity: Literal["low", "medium", "high", "critical"]
    kind: Literal["accident", "congestion", "roadblock", "signal_failure"]
    active: bool = True


class EmergencyVehicle(BaseModel):
    id: str
    kind: Literal["ambulance", "fire", "police"]
    source: str
    destination: str
    priority: int = Field(..., ge=1, le=5)


class RoutePlan(BaseModel):
    vehicle_id: str
    path: List[str]
    eta_minutes: float
    risk_score: float


class SimulationState(BaseModel):
    timestamp: str
    tick: int
    roads: List[RoadEdge]
    incidents: List[Incident]
    emergency_vehicles: List[EmergencyVehicle]
    plans: List[RoutePlan]
    city_load_index: float
    uncertainty_index: float
    kpis: Dict[str, float]
