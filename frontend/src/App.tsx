import { FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScenarioItem, ScenarioResponse, SimulationState } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
type Screen = "landing" | "login" | "profile" | "dashboard";
type UserRole = "traffic_operator" | "emergency_responder" | "citizen";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [profile, setProfile] = useState({
    fullName: "",
    role: "traffic_operator" as UserRole,
    city: "",
    phone: "",
    teamCode: ""
  });
  const [error, setError] = useState("");
  const [state, setState] = useState<SimulationState | null>(null);
  const [history, setHistory] = useState<Array<{ tick: number; load: number; eta: number; uncertainty: number }>>([]);
  const [tick, setTick] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState("default");
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeedMs, setAutoSpeedMs] = useState(2500);

  const fetchState = async () => {
    const res = await axios.get<SimulationState>(`${API_BASE}/api/v1/state`);
    setState(res.data);
    setTick(res.data.tick ?? 1);
    const avgEta = res.data.kpis.avg_eta_minutes ?? 0;
    setHistory((prev) => [...prev.slice(-15), { tick: res.data.tick ?? 1, load: res.data.city_load_index, eta: avgEta, uncertainty: res.data.uncertainty_index }]);
  };

  const runTick = async () => {
    setLoading(true);
    try {
      const res = await axios.post<SimulationState>(`${API_BASE}/api/v1/simulation/tick`);
      setTick(res.data.tick);
      setState(res.data);
      const avgEta = res.data.kpis.avg_eta_minutes ?? 0;
      setHistory((prev) => [...prev.slice(-15), { tick: res.data.tick, load: res.data.city_load_index, eta: avgEta, uncertainty: res.data.uncertainty_index }]);
    } finally {
      setLoading(false);
    }
  };

  const fetchScenarios = async () => {
    const res = await axios.get<ScenarioResponse>(`${API_BASE}/api/v1/scenarios`);
    setScenarios(res.data.items);
    setActiveScenarioId(res.data.active_scenario_id);
  };

  const activateScenario = async (scenarioId: string) => {
    setLoading(true);
    try {
      const res = await axios.post<SimulationState>(`${API_BASE}/api/v1/scenarios/${scenarioId}/activate`);
      setState(res.data);
      setTick(res.data.tick);
      setActiveScenarioId(scenarioId);
      const avgEta = res.data.kpis.avg_eta_minutes ?? 0;
      setHistory((prev) => [...prev.slice(-15), { tick: res.data.tick, load: res.data.city_load_index, eta: avgEta, uncertainty: res.data.uncertainty_index }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (screen === "dashboard") {
      fetchState().catch(console.error);
      fetchScenarios().catch(console.error);
    }
  }, [screen]);

  useEffect(() => {
    if (!autoPlay || screen !== "dashboard") return;
    const timer = window.setInterval(() => {
      runTick().catch(console.error);
    }, autoSpeedMs);
    return () => window.clearInterval(timer);
  }, [autoPlay, autoSpeedMs, screen]);

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    if (!userEmail.trim() || !userPassword.trim()) {
      setError("Please enter email and password.");
      return;
    }
    setError("");
    setScreen("profile");
  };

  const handleProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!profile.fullName.trim() || !profile.city.trim() || !profile.phone.trim()) {
      setError("Please complete all required user details.");
      return;
    }
    setError("");
    setScreen("dashboard");
  };

  const roleDisplayName = {
    traffic_operator: "Traffic Operator",
    emergency_responder: "Emergency Responder",
    citizen: "Citizen",
  } as const;

  const criticalIncidents = useMemo(
    () => state?.incidents.filter((inc) => inc.active && inc.severity === "critical").length ?? 0,
    [state]
  );

  const insightsByRole = {
    traffic_operator: [
      {
        id: "corridor",
        label: "Emergency Corridor",
        description:
          "Prioritize emergency corridors by clearing low-confidence and high-load roads. Use this view to keep emergency units moving ahead of general traffic.",
      },
      {
        id: "uncertainty",
        label: "Data Confidence",
        description:
          "Review roads with lower confidence values. Add static confidence metadata here to flag unreliable traffic sensors and reroute emergencies away from uncertain segments.",
      },
      {
        id: "incident",
        label: "Incident Response",
        description:
          "Identify the most critical active incidents and recommend operational actions such as detours, closures, and prioritized clearance.",
      },
    ],
    emergency_responder: [
      {
        id: "mission",
        label: "Mission Status",
        description:
          "Track active emergency missions and route assignments. Tap each mission to see which vehicle is closest and how risk scores compare.",
      },
      {
        id: "priority",
        label: "Priority Dispatch",
        description:
          "Use vehicle priority and incident severity to allocate your fastest units. This static guidance helps align the dispatch plan with the problem statement.",
      },
      {
        id: "bypass",
        label: "Incident Bypass",
        description:
          "Show recommended bypass strategies around high-severity incidents, minimizing delay for critical responders while keeping ETA low.",
      },
    ],
    citizen: [
      {
        id: "overview",
        label: "Commute Readiness",
        description:
          "Track current traffic pressure and active incidents before starting a trip. This helps citizens choose safer and faster travel windows.",
      },
      {
        id: "allocation",
        label: "Safe Route Tips",
        description:
          "See roads with lower load and better confidence so citizens can prefer routes that avoid heavy disruptions and emergency corridors.",
      },
      {
        id: "policy",
        label: "Public Alerts",
        description:
          "Receive plain-language guidance on critical incidents, blocked stretches, and recommended alternatives for normal public movement.",
      },
    ],
  } as const;

  const currentInsights = insightsByRole[profile.role] ?? insightsByRole.traffic_operator;
  const selectedInsightItem =
    currentInsights.find((item) => item.id === selectedInsight) ?? currentInsights[0];
  const roleThemeClass = `role-${profile.role}`;

  const dashboardKpis = useMemo(() => {
    if (!state) return [];

    if (profile.role === "emergency_responder") {
      const urgentCount = state.incidents.filter(
        (inc) => inc.active && ["high", "critical"].includes(inc.severity)
      ).length;
      const avgRisk = state.plans.reduce((sum, plan) => sum + plan.risk_score, 0) / Math.max(1, state.plans.length);
      return [
        { label: "Assigned Missions", value: `${state.emergency_vehicles.length}` },
        { label: "Urgent Incidents", value: `${urgentCount}` },
        { label: "Avg ETA", value: `${state.kpis.avg_eta_minutes} min` },
        { label: "Avg Route Risk", value: avgRisk.toFixed(2) },
      ];
    }

    if (profile.role === "citizen") {
      const criticalCount = state.incidents.filter(
        (inc) => inc.active && inc.severity === "critical"
      ).length;
      const avgConfidence = (state.roads.reduce((sum, road) => sum + road.confidence, 0) / state.roads.length).toFixed(3);
      return [
        { label: "Traffic Load", value: `${state.city_load_index}` },
        { label: "Critical Alerts", value: `${criticalCount}` },
        { label: "Road Data Confidence", value: `${avgConfidence}` },
        { label: "Avg Emergency ETA", value: `${state.kpis.avg_eta_minutes} min` },
      ];
    }

    return [
      { label: "Dispatch Efficiency", value: `${state.kpis.dispatch_efficiency}%` },
      { label: "Average ETA", value: `${state.kpis.avg_eta_minutes} min` },
      { label: "Critical Incidents", value: String(criticalIncidents) },
      { label: "Uncertainty Index", value: state.uncertainty_index.toFixed(3) },
    ];
  }, [profile.role, state, criticalIncidents]);

  if (screen === "landing") {
    return (
      <div className="shell auth-shell">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
          <h1>Urban Traffic Command Center</h1>
          <p>Intelligent emergency corridor management with uncertainty-aware city routing.</p>
          <div className="feature-row">
            <span>Multi-incident response</span>
            <span>Priority dispatch optimization</span>
            <span>Live simulation telemetry</span>
          </div>
          <button className="primary-btn auth-btn" onClick={() => setScreen("login")}>
            Enter Platform
          </button>
        </motion.section>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div className="shell auth-shell">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
          <h2>Secure Login</h2>
          <p>Sign in to open operational dashboard access.</p>
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Work Email
              <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="operator@city.gov" />
            </label>
            <label>
              Password
              <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Enter your password" />
            </label>
            {error ? <small className="error-text">{error}</small> : null}
            <div className="auth-actions">
              <button type="button" className="ghost-btn" onClick={() => setScreen("landing")}>
                Back
              </button>
              <button type="submit" className="primary-btn">
                Continue
              </button>
            </div>
          </form>
        </motion.section>
      </div>
    );
  }

  if (screen === "profile") {
    return (
      <div className="shell auth-shell">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="auth-card wide">
          <h2>User Details</h2>
          <p>Fill profile details before entering command operations.</p>
          <form className="auth-form grid-form" onSubmit={handleProfile}>
            <label>
              Full Name *
              <input value={profile.fullName} onChange={(e) => setProfile((prev) => ({ ...prev, fullName: e.target.value }))} />
            </label>
            <label>
              Role
              <select value={profile.role} onChange={(e) => setProfile((prev) => ({ ...prev, role: e.target.value as UserRole }))}>
                <option value="traffic_operator">Traffic Operator</option>
                <option value="emergency_responder">Emergency Responder</option>
                <option value="citizen">Citizen</option>
              </select>
            </label>
            <label>
              City *
              <input value={profile.city} onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))} />
            </label>
            <label>
              Contact Number *
              <input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label>
              Team Code
              <input value={profile.teamCode} onChange={(e) => setProfile((prev) => ({ ...prev, teamCode: e.target.value }))} />
            </label>
            {error ? <small className="error-text">{error}</small> : null}
            <div className="auth-actions full">
              <button type="button" className="ghost-btn" onClick={() => setScreen("login")}>
                Back
              </button>
              <button type="submit" className="primary-btn">
                Open Dashboard
              </button>
            </div>
          </form>
        </motion.section>
      </div>
    );
  }

  if (!state) return <div className="shell loading">Connecting to control plane...</div>;

  return (
    <div className={`shell ${roleThemeClass}`}>
      <header className="hero">
        <div>
          <h1>Intelligent Traffic & Emergency Coordination</h1>
          <p>
            Adaptive incident-aware dispatch with uncertainty-aware routing and live simulation telemetry. Logged in as {profile.fullName || "User"} ({roleDisplayName[profile.role]}).
          </p>
          <p className="muted-text">Simulation tick: {state.tick} • last updated {new Date(state.timestamp).toLocaleTimeString()}</p>
          <div className="feature-row">
            <span>🚦 Live control</span>
            <span>🧠 Uncertainty-aware routing</span>
            <span>🚑 Multi-vehicle dispatch</span>
            <span>🧩 Scenario switching</span>
          </div>
        </div>
        <div className="hero-actions">
          <button onClick={runTick} disabled={loading} className="primary-btn">
            {loading ? "Optimizing..." : "Run Simulation Tick"}
          </button>
          <button onClick={() => setScreen("landing")} className="ghost-btn">
            Logout
          </button>
        </div>
      </header>

      <section className="glass-panel">
        <h3>Interactive Scenario Studio</h3>
        <div className="scenario-controls">
          <label>
            Scenario
            <select value={activeScenarioId} onChange={(e) => activateScenario(e.target.value)}>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Auto Tick Speed
            <select value={autoSpeedMs} onChange={(e) => setAutoSpeedMs(Number(e.target.value))}>
              <option value={1500}>Fast (1.5s)</option>
              <option value={2500}>Normal (2.5s)</option>
              <option value={4000}>Slow (4s)</option>
            </select>
          </label>
          <button type="button" className="ghost-btn" onClick={() => setAutoPlay((prev) => !prev)}>
            {autoPlay ? "Pause Auto Tick" : "Start Auto Tick"}
          </button>
        </div>
        <div className="list">
          {scenarios.filter((scenario) => scenario.id === activeScenarioId).map((scenario) => (
            <div key={scenario.id} className="list-item">
              <strong>{scenario.name}</strong>
              <span>{scenario.description}</span>
              <small>Current simulated dataset: {scenario.id}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="kpi-grid">
        {dashboardKpis.map((item) => (
          <motion.article layout whileHover={{ y: -4 }} key={item.label} className="glass-card">
            <span>{item.label}</span>
            <h2>{item.value}</h2>
          </motion.article>
        ))}
      </section>

      <section className="panel-grid">
        {profile.role === "traffic_operator" ? (
          <>
            <article className="glass-panel chart">
          <h3>City Load, ETA and Data Uncertainty Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e385e" />
              <XAxis dataKey="tick" stroke="#a7b5ff" />
              <YAxis stroke="#a7b5ff" />
              <Tooltip />
              <Area type="monotone" dataKey="load" stroke="#00d4ff" fill="url(#loadGradient)" />
              <Area type="monotone" dataKey="eta" stroke="#22c55e" fillOpacity={0.12} fill="#22c55e" />
              <Area type="monotone" dataKey="uncertainty" stroke="#f59e0b" fillOpacity={0.12} fill="#f59e0b" />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-panel">
          <h3>Emergency Route Plans</h3>
          <div className="list">
            {state.plans.map((plan) => (
              <div key={plan.vehicle_id} className="list-item">
                <strong>{plan.vehicle_id}</strong>
                <span>{plan.path.join(" -> ")}</span>
                <small>
                  ETA {plan.eta_minutes} min | Risk {plan.risk_score}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <h3>Incident Matrix</h3>
          <div className="list">
            {state.incidents.map((incident) => (
              <div key={incident.id} className="list-item">
                <strong>{incident.id}</strong>
                <span>{incident.kind.toUpperCase()} at {incident.node}</span>
                <small className={`pill ${incident.severity}`}>{incident.severity}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="glass-panel">
          <h3>Road Heat Snapshot</h3>
          <div className="list">
            {state.roads.slice(0, 6).map((road) => {
              const ratio = road.live_load / Math.max(1, road.capacity);
              return (
                <div key={`${road.source}-${road.target}`} className="list-item">
                  <strong>{road.source} → {road.target}</strong>
                  <span>Load {road.live_load.toFixed(1)}/{road.capacity}</span>
                  <small>Confidence {road.confidence.toFixed(2)}</small>
                  <progress max={1.3} value={ratio} />
                </div>
              );
            })}
          </div>
        </article>
      </>
        ) : profile.role === "emergency_responder" ? (
      <>
        <article className="glass-panel">
          <h3>Active Mission Dashboard</h3>
          <div className="list">
            {state.emergency_vehicles.map((vehicle) => (
              <div key={vehicle.id} className="list-item">
                <strong>{vehicle.id}</strong>
                <span>{vehicle.kind.toUpperCase()} from {vehicle.source} to {vehicle.destination}</span>
                <small>Priority {vehicle.priority}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <h3>Primary Route Assignments</h3>
          <div className="list">
            {state.plans.map((plan) => (
              <div key={plan.vehicle_id} className="list-item">
                <strong>{plan.vehicle_id}</strong>
                <span>{plan.path.join(" → ")}</span>
                <small>ETA {plan.eta_minutes} min | Risk {plan.risk_score}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel">
          <h3>High-Severity Incident Alerts</h3>
          <div className="list">
            {state.incidents
              .filter((incident) => incident.active && ["high", "critical"].includes(incident.severity))
              .map((incident) => (
                <div key={incident.id} className="list-item">
                  <strong>{incident.id}</strong>
                  <span>{incident.kind.toUpperCase()} at {incident.node}</span>
                  <small className={`pill ${incident.severity}`}>{incident.severity}</small>
                </div>
              ))}
          </div>
        </article>
      </>
        ) : (
      <>
        <article className="glass-panel chart">
          <h3>Citizen Traffic Snapshot</h3>
          <div className="list">
            <div className="list-item">
              <strong>Road Network Monitored</strong>
              <span>{state.roads.length}</span>
            </div>
            <div className="list-item">
              <strong>Active Disruptions</strong>
              <span>{state.incidents.filter((incident) => incident.active).length}</span>
            </div>
            <div className="list-item">
              <strong>Emergency Units in City</strong>
              <span>{state.emergency_vehicles.length}</span>
            </div>
            <div className="list-item">
              <strong>Avg Data Confidence</strong>
              <span>
                {(state.roads.reduce((sum, road) => sum + road.confidence, 0) / state.roads.length).toFixed(3)}
              </span>
            </div>
          </div>
        </article>

        <article className="glass-panel">
          <h3>Citizen Alert Feed</h3>
          <div className="list">
            {state.incidents
              .filter((incident) => incident.active)
              .sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0))
              .map((incident) => (
                <div key={incident.id} className="list-item">
                  <strong>{incident.id}</strong>
                  <span>{incident.kind.toUpperCase()} at {incident.node}</span>
                  <small className={`pill ${incident.severity}`}>{incident.severity}</small>
                </div>
              ))}
          </div>
        </article>

        <article className="glass-panel">
          <h3>Suggested Lower-Load Roads</h3>
          <div className="list">
            {state.roads
              .sort((a, b) => a.live_load / a.capacity - b.live_load / b.capacity)
              .slice(0, 4)
              .map((road) => (
                <div key={`${road.source}-${road.target}`} className="list-item">
                  <strong>{road.source} → {road.target}</strong>
                  <span>Load {road.live_load.toFixed(1)}/{road.capacity}</span>
                  <small>Confidence {road.confidence.toFixed(2)}</small>
                </div>
              ))}
          </div>
        </article>
      </>
        )}
      </section>

      <section className="glass-panel insights">
        <h3>Interactive Problem-Solving Insights</h3>
        <div className="feature-row">
          {currentInsights.map((insight) => (
            <button
              key={insight.id}
              type="button"
              className={`ghost-btn ${selectedInsight === insight.id ? "active" : ""}`}
              onClick={() => setSelectedInsight(insight.id)}
            >
              {insight.label}
            </button>
          ))}
        </div>

        <div className="glass-card detail-card">
          <h4>{selectedInsightItem.label}</h4>
          <p>{selectedInsightItem.description}</p>
          <p className="muted-text">
            This is static scenario guidance that complements the simulation. Tap each insight to see how the dashboard supports emergency routing, incident management, and uncertainty handling.
          </p>
        </div>
      </section>
    </div>
  );
}
