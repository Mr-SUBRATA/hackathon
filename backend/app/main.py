from fastapi import FastAPI
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
latest_state = engine.tick()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/v1/state", response_model=SimulationState)
def get_state() -> SimulationState:
    return latest_state


@app.post("/api/v1/simulation/tick", response_model=SimulationState)
def run_tick() -> SimulationState:
    global latest_state
    latest_state = engine.tick()
    return latest_state
