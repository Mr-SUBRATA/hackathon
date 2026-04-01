from pathlib import Path
from typing import List

import pandas as pd

from .models import EmergencyVehicle, Incident, RoadEdge


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def load_roads() -> List[RoadEdge]:
    df = pd.read_csv(DATA_DIR / "roads.csv")
    return [RoadEdge(**row) for row in df.to_dict(orient="records")]


def load_incidents() -> List[Incident]:
    df = pd.read_csv(DATA_DIR / "incidents.csv")
    return [Incident(**row) for row in df.to_dict(orient="records")]


def load_emergency_vehicles() -> List[EmergencyVehicle]:
    df = pd.read_csv(DATA_DIR / "emergency_vehicles.csv")
    return [EmergencyVehicle(**row) for row in df.to_dict(orient="records")]
