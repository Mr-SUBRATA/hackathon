from datetime import datetime, timezone
from math import exp
from random import uniform
from typing import Dict, List, Tuple

import networkx as nx

from .data_loader import load_emergency_vehicles, load_incidents, load_roads
from .models import EmergencyVehicle, Incident, RoadEdge, RoutePlan, SimulationState


SEVERITY_WEIGHT = {"low": 0.08, "medium": 0.16, "high": 0.32, "critical": 0.48}


class TrafficEngine:
    def __init__(self) -> None:
        self.roads: List[RoadEdge] = load_roads()
        self.incidents: List[Incident] = load_incidents()
        self.vehicles: List[EmergencyVehicle] = load_emergency_vehicles()

    def _incident_multiplier(self, node: str) -> float:
        total = 0.0
        for incident in self.incidents:
            if incident.active and incident.node == node:
                total += SEVERITY_WEIGHT[incident.severity]
        return 1 + total

    def _edge_cost(self, edge: RoadEdge) -> float:
        if edge.blocked:
            return 9999
        load_factor = 1 + (edge.live_load / max(edge.capacity, 1))
        confidence_penalty = 1 + (1 - edge.confidence) * 0.35
        node_penalty = self._incident_multiplier(edge.source) * self._incident_multiplier(edge.target)
        return edge.base_time * load_factor * confidence_penalty * node_penalty

    def _build_graph(self) -> nx.DiGraph:
        graph = nx.DiGraph()
        for edge in self.roads:
            graph.add_edge(edge.source, edge.target, weight=self._edge_cost(edge))
        return graph

    def _compute_plan(self, graph: nx.DiGraph, vehicle: EmergencyVehicle) -> RoutePlan:
        path = nx.shortest_path(graph, vehicle.source, vehicle.destination, weight="weight")
        eta = 0.0
        risk = 0.0
        for i in range(len(path) - 1):
            src, dst = path[i], path[i + 1]
            w = graph[src][dst]["weight"]
            eta += w
            risk += min(1.0, (w / 12.0))
        risk = min(1.0, risk / max(1, len(path) - 1))
        priority_gain = max(0.75, 1 - (vehicle.priority - 1) * 0.05)
        eta *= priority_gain
        return RoutePlan(
            vehicle_id=vehicle.id,
            path=path,
            eta_minutes=round(eta, 2),
            risk_score=round(risk, 3),
        )

    def tick(self) -> SimulationState:
        for edge in self.roads:
            edge.live_load = max(8, min(edge.capacity * 1.2, edge.live_load + uniform(-6.5, 8.0)))
            edge.confidence = max(0.45, min(0.99, edge.confidence + uniform(-0.04, 0.03)))

        graph = self._build_graph()
        plans = [self._compute_plan(graph, vehicle) for vehicle in self.vehicles]

        city_load_index = sum(edge.live_load / edge.capacity for edge in self.roads) / len(self.roads)
        uncertainty_index = sum(1 - edge.confidence for edge in self.roads) / len(self.roads)

        dispatch_score = exp(-(city_load_index * 0.65 + uncertainty_index * 0.7))
        active_incidents = sum(1 for inc in self.incidents if inc.active)

        kpis: Dict[str, float] = {
            "dispatch_efficiency": round(dispatch_score * 100, 2),
            "avg_eta_minutes": round(sum(p.eta_minutes for p in plans) / max(1, len(plans)), 2),
            "critical_incident_count": float(
                sum(1 for inc in self.incidents if inc.active and inc.severity == "critical")
            ),
            "active_incidents": float(active_incidents),
        }

        return SimulationState(
            timestamp=datetime.now(timezone.utc).isoformat(),
            roads=self.roads,
            incidents=self.incidents,
            emergency_vehicles=self.vehicles,
            plans=plans,
            city_load_index=round(city_load_index, 3),
            uncertainty_index=round(uncertainty_index, 3),
            kpis=kpis,
        )
