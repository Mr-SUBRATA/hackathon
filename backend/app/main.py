from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine import TrafficEngine
from .models import SimulationState


app = FastAPI(
    title="Intelligent Traffic & Emergency Coordination API",
    version="1.0.0",
    description="Adaptive routing and incident-aware traffic orchestration backend.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = TrafficEngine()
latest_state: SimulationState | None = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/v1/state", response_model=SimulationState)
def get_state() -> SimulationState:
    global latest_state
    if latest_state is None:
        latest_state = engine.tick()
    return latest_state


@app.post("/api/v1/simulation/tick", response_model=SimulationState)
def run_tick() -> SimulationState:
    global latest_state
    latest_state = engine.tick()
    return latest_state


@app.get("/api/v1/scenarios")
def get_scenarios() -> dict:
    return {"active_scenario_id": engine.active_scenario_id, "items": engine.available_scenarios()}


@app.post("/api/v1/scenarios/{scenario_id}/activate", response_model=SimulationState)
def activate_scenario(scenario_id: str) -> SimulationState:
    global latest_state
    ok = engine.activate_scenario(scenario_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")
    latest_state = engine.tick()
    return latest_state
