from copy import deepcopy
from datetime import datetime, timezone
from math import exp
from random import Random, uniform
from typing import Dict, List

import networkx as nx

from .data_loader import load_emergency_vehicles, load_incidents, load_roads
from .models import EmergencyVehicle, Incident, RoadEdge, RoutePlan, SimulationState


SEVERITY_WEIGHT = {"low": 0.08, "medium": 0.16, "high": 0.32, "critical": 0.48}
SEVERITY_ORDER = ["low", "medium", "high", "critical"]


class TrafficEngine:
    def __init__(self) -> None:
        self.base_roads: List[RoadEdge] = load_roads()
        self.base_incidents: List[Incident] = load_incidents()
        self.base_vehicles: List[EmergencyVehicle] = load_emergency_vehicles()
        self.roads: List[RoadEdge] = deepcopy(self.base_roads)
        self.incidents: List[Incident] = deepcopy(self.base_incidents)
        self.vehicles: List[EmergencyVehicle] = deepcopy(self.base_vehicles)
        self.tick_count: int = 0
        self.current_state: SimulationState | None = None
        self.active_scenario_id: str = "default"

    def available_scenarios(self) -> List[Dict[str, str]]:
        return [
            {"id": "default", "name": "Baseline City", "description": "Balanced city traffic with standard disruptions."},
            {"id": "peak_hour", "name": "Peak Hour Rush", "description": "High city load and congested key corridors."},
            {"id": "festival", "name": "Festival Traffic", "description": "Dense CBD movement and frequent signal failures."},
            {"id": "storm", "name": "Storm Day", "description": "Lower data confidence, roadblocks, and slower movement."},
            {"id": "multi_collision", "name": "Multi-Collision Emergency", "description": "Several high/critical incidents across nodes."},
            {"id": "night_relief", "name": "Night Relief", "description": "Lower normal load with selective emergency priorities."},
            {"id": "random_chaos", "name": "Randomized Chaos", "description": "Auto-generated mixed dummy scenario each activation."},
        ]

    def activate_scenario(self, scenario_id: str) -> bool:
        if scenario_id not in {item["id"] for item in self.available_scenarios()}:
            return False
        self.roads, self.incidents, self.vehicles = self._build_scenario(scenario_id)
        self.tick_count = 0
        self.current_state = None
        self.active_scenario_id = scenario_id
        return True

    def _build_scenario(self, scenario_id: str) -> tuple[List[RoadEdge], List[Incident], List[EmergencyVehicle]]:
        roads = deepcopy(self.base_roads)
        incidents = deepcopy(self.base_incidents)
        vehicles = deepcopy(self.base_vehicles)

        if scenario_id == "default":
            return roads, incidents, vehicles

        if scenario_id == "peak_hour":
            for edge in roads:
                edge.live_load = min(edge.capacity * 1.2, edge.live_load + 18)
                edge.confidence = max(0.55, edge.confidence - 0.04)
            incidents.append(Incident(id="INC-004", node="N4", severity="high", kind="congestion", active=True))
            incidents.append(Incident(id="INC-005", node="N5", severity="medium", kind="accident", active=True))
            return roads, incidents, vehicles

        if scenario_id == "festival":
            for edge in roads:
                if edge.target in {"CBD", "N5"} or edge.source in {"CBD", "N5"}:
                    edge.live_load = min(edge.capacity * 1.25, edge.live_load + 22)
                edge.confidence = max(0.52, edge.confidence - 0.05)
            incidents.append(Incident(id="INC-004", node="CBD", severity="high", kind="signal_failure", active=True))
            incidents.append(Incident(id="INC-005", node="N5", severity="high", kind="congestion", active=True))
            vehicles.append(EmergencyVehicle(id="AMB-19", kind="ambulance", source="HUB_A", destination="CBD", priority=4))
            return roads, incidents, vehicles

        if scenario_id == "storm":
            for edge in roads:
                edge.live_load = min(edge.capacity * 1.15, edge.live_load + 8)
                edge.confidence = max(0.45, edge.confidence - 0.18)
                if edge.source == "N2" and edge.target == "N4":
                    edge.blocked = True
            incidents.append(Incident(id="INC-004", node="N4", severity="critical", kind="roadblock", active=True))
            incidents.append(Incident(id="INC-005", node="N1", severity="medium", kind="signal_failure", active=True))
            return roads, incidents, vehicles

        if scenario_id == "multi_collision":
            for edge in roads:
                edge.live_load = min(edge.capacity * 1.3, edge.live_load + 12)
                edge.confidence = max(0.5, edge.confidence - 0.06)
            incidents.extend(
                [
                    Incident(id="INC-004", node="N1", severity="critical", kind="accident", active=True),
                    Incident(id="INC-005", node="N4", severity="high", kind="accident", active=True),
                    Incident(id="INC-006", node="CBD", severity="critical", kind="roadblock", active=True),
                ]
            )
            vehicles.extend(
                [
                    EmergencyVehicle(id="FIRE-13", kind="fire", source="FIRE_STATION", destination="N1", priority=5),
                    EmergencyVehicle(id="POL-09", kind="police", source="HUB_A", destination="CBD", priority=4),
                ]
            )
            return roads, incidents, vehicles

        if scenario_id == "night_relief":
            for edge in roads:
                edge.live_load = max(6, edge.live_load - 16)
                edge.confidence = min(0.99, edge.confidence + 0.06)
            incidents = [
                Incident(id="INC-010", node="N3", severity="medium", kind="accident", active=True),
                Incident(id="INC-011", node="CBD", severity="low", kind="congestion", active=True),
            ]
            vehicles = [
                EmergencyVehicle(id="AMB-31", kind="ambulance", source="HUB_A", destination="HOSPITAL", priority=5),
                EmergencyVehicle(id="POL-15", kind="police", source="HUB_A", destination="CBD", priority=4),
            ]
            return roads, incidents, vehicles

        return self._build_random_scenario(roads, vehicles)

    def _build_random_scenario(
        self, roads: List[RoadEdge], vehicles: List[EmergencyVehicle]
    ) -> tuple[List[RoadEdge], List[Incident], List[EmergencyVehicle]]:
        rng = Random(datetime.now(timezone.utc).microsecond)
        for edge in roads:
            edge.live_load = max(6, min(edge.capacity * 1.3, edge.live_load + rng.uniform(-10, 24)))
            edge.confidence = max(0.45, min(0.98, edge.confidence + rng.uniform(-0.22, 0.08)))
            edge.blocked = rng.random() < 0.14

        nodes = sorted({edge.source for edge in roads} | {edge.target for edge in roads})
        severities = ["low", "medium", "high", "critical"]
        kinds = ["accident", "congestion", "roadblock", "signal_failure"]
        incident_count = rng.randint(4, 8)
        incidents: List[Incident] = []
        for idx in range(incident_count):
            incidents.append(
                Incident(
                    id=f"INC-R{idx+1:03d}",
                    node=nodes[rng.randint(0, len(nodes) - 1)],
                    severity=severities[rng.randint(0, len(severities) - 1)],
                    kind=kinds[rng.randint(0, len(kinds) - 1)],
                    active=True,
                )
            )

        extra_vehicle_count = rng.randint(1, 4)
        for idx in range(extra_vehicle_count):
            source = nodes[rng.randint(0, len(nodes) - 1)]
            destination = nodes[rng.randint(0, len(nodes) - 1)]
            while destination == source:
                destination = nodes[rng.randint(0, len(nodes) - 1)]
            vehicles.append(
                EmergencyVehicle(
                    id=f"EV-R{idx+1:02d}",
                    kind=["ambulance", "fire", "police"][rng.randint(0, 2)],
                    source=source,
                    destination=destination,
                    priority=rng.randint(2, 5),
                )
            )
        return roads, incidents, vehicles

    def _incident_multiplier(self, node: str) -> float:
        total = 0.0
        for incident in self.incidents:
            if incident.active and incident.node == node:
                total += SEVERITY_WEIGHT[incident.severity]
        return 1 + total

    def _update_incidents(self) -> None:
        for incident in self.incidents:
            if incident.active:
                if uniform(0, 1) < 0.12:
                    incident.active = False
                elif uniform(0, 1) < 0.2:
                    index = SEVERITY_ORDER.index(incident.severity)
                    if uniform(0, 1) < 0.5 and index < len(SEVERITY_ORDER) - 1:
                        incident.severity = SEVERITY_ORDER[index + 1]
                    elif index > 0:
                        incident.severity = SEVERITY_ORDER[index - 1]
            else:
                if uniform(0, 1) < 0.08:
                    incident.active = True

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
        try:
            path = nx.shortest_path(graph, vehicle.source, vehicle.destination, weight="weight")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            # Keep simulation resilient when randomized dummy scenarios create disconnected routes.
            path = [vehicle.source, vehicle.destination]
            return RoutePlan(
                vehicle_id=vehicle.id,
                path=path,
                eta_minutes=45.0,
                risk_score=1.0,
            )
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
        self.tick_count += 1
        self._update_incidents()

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

        state = SimulationState(
            timestamp=datetime.now(timezone.utc).isoformat(),
            tick=self.tick_count,
            roads=self.roads,
            incidents=self.incidents,
            emergency_vehicles=self.vehicles,
            plans=plans,
            city_load_index=round(city_load_index, 3),
            uncertainty_index=round(uncertainty_index, 3),
            kpis=kpis,
        )
        self.current_state = state
        return state
