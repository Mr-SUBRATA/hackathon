# Intelligent Traffic & Emergency Coordination System

Professional, deploy-ready hackathon project based on the problem statement:
- Multiple traffic disruptions at once
- Multiple emergency vehicles with priority routing
- Incomplete / delayed / partially incorrect traffic data
- Continuous normal traffic mixed with emergency traffic

## Project Structure

```text
traffic_management_system/
  backend/
    app/
      main.py
      engine.py
      models.py
      data_loader.py
    data/
      roads.csv
      incidents.csv
      emergency_vehicles.csv
    requirements.txt
  frontend/
    src/
      App.tsx
      main.tsx
      styles.css
      types.ts
    package.json
    tsconfig.json
    vite.config.ts
    index.html
  README.md
```

## Tech Stack

- Backend: FastAPI, Pydantic, NetworkX, Pandas
- Frontend: React + TypeScript + Vite + Recharts + Framer Motion
- Data: Seeded CSV datasets with uncertainty-aware road confidence

## Core Logic

- Dynamic route optimization on every simulation tick
- Cost function includes:
  - Road load vs capacity
  - Data confidence penalties (for uncertain traffic data)
  - Incident severity impact at connected nodes
- Dispatch KPIs:
  - Dispatch efficiency
  - Average ETA
  - Critical incident count
  - Uncertainty index

## Local Setup (Windows / PowerShell)

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at `http://127.0.0.1:8000`

### 2) Frontend (new terminal)

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`

## API Endpoints

- `GET /health`
- `GET /api/v1/state`
- `POST /api/v1/simulation/tick`

## Deployment Notes

- Backend can be deployed on Render, Railway, or any VPS with Python 3.10+.
- Frontend can be deployed on Vercel / Netlify.
- Set frontend API base URL to your deployed backend URL.

## Docker Setup (One Command)

From project root:

```powershell
docker compose up --build
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

## Environment Configuration

- Backend template: `backend/.env.example`
- Frontend template: `frontend/.env.example`
- For frontend production API, set `VITE_API_BASE_URL` to deployed backend URL.

## CI/CD

- GitHub Actions workflow available at `.github/workflows/ci.yml`
- Runs backend dependency/import validation and frontend production build on push/PR.

## Pitch Deck Draft

- Ready presentation draft: `docs/HACKATHON_PRESENTATION_DRAFT.md`

## Hackathon Presentation Mapping

1. Problem Understanding -> traffic + emergency + uncertainty handling
2. Proposed Solution -> uncertainty-aware optimization engine
3. System Overview -> React control panel + FastAPI orchestration API
4. Core Logic -> weighted shortest path + KPI outputs
5. Technology Used -> listed above
6. Demonstration of Results -> route plans + KPI changes per tick
7. GUI Demo -> advanced dashboard with real-time simulation
8. Challenges & Limitations -> synthetic data; static topology
9. Future Scope -> live map APIs, RL-based signal control, digital twin integration
