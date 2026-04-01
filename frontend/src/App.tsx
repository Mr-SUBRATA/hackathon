import { FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SimulationState } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
type Screen = "landing" | "login" | "profile" | "dashboard";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [profile, setProfile] = useState({
    fullName: "",
    role: "traffic_operator",
    city: "",
    phone: "",
    teamCode: ""
  });
  const [error, setError] = useState("");
  const [state, setState] = useState<SimulationState | null>(null);
  const [history, setHistory] = useState<Array<{ tick: number; load: number; eta: number; uncertainty: number }>>([]);
  const [tick, setTick] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchState = async () => {
    const res = await axios.get<SimulationState>(`${API_BASE}/api/v1/state`);
    setState(res.data);
    const avgEta = res.data.kpis.avg_eta_minutes ?? 0;
    setHistory((prev) => [...prev.slice(-15), { tick, load: res.data.city_load_index, eta: avgEta, uncertainty: res.data.uncertainty_index }]);
  };

  const runTick = async () => {
    setLoading(true);
    try {
      const res = await axios.post<SimulationState>(`${API_BASE}/api/v1/simulation/tick`);
      setTick((prev) => prev + 1);
      setState(res.data);
      const avgEta = res.data.kpis.avg_eta_minutes ?? 0;
      setHistory((prev) => [...prev.slice(-15), { tick: tick + 1, load: res.data.city_load_index, eta: avgEta, uncertainty: res.data.uncertainty_index }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (screen === "dashboard") fetchState().catch(console.error);
  }, [screen]);

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

  const criticalIncidents = useMemo(
    () => state?.incidents.filter((inc) => inc.active && inc.severity === "critical").length ?? 0,
    [state]
  );

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
              <select value={profile.role} onChange={(e) => setProfile((prev) => ({ ...prev, role: e.target.value }))}>
                <option value="traffic_operator">Traffic Operator</option>
                <option value="emergency_responder">Emergency Responder</option>
                <option value="city_admin">City Admin</option>
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
    <div className="shell">
      <header className="hero">
        <div>
          <h1>Intelligent Traffic & Emergency Coordination</h1>
          <p>
            Adaptive incident-aware dispatch with uncertainty-aware routing and live simulation telemetry. Logged in as {profile.fullName || "User"} ({profile.role}).
          </p>
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

      <section className="kpi-grid">
        {[
          { label: "Dispatch Efficiency", value: `${state.kpis.dispatch_efficiency}%` },
          { label: "Average ETA", value: `${state.kpis.avg_eta_minutes} min` },
          { label: "Critical Incidents", value: String(criticalIncidents) },
          { label: "Uncertainty Index", value: state.uncertainty_index.toFixed(3) }
        ].map((item) => (
          <motion.article layout whileHover={{ y: -4 }} key={item.label} className="glass-card">
            <span>{item.label}</span>
            <h2>{item.value}</h2>
          </motion.article>
        ))}
      </section>

      <section className="panel-grid">
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
      </section>
    </div>
  );
}
