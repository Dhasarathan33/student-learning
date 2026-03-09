import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./recoveryplans.css";

const normalize = (v) => String(v || "").trim().toLowerCase();

export default function RecoveryPlans() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [subRes, taskRes, planRes] = await Promise.all([
        api.get("/api/subjects"),
        api.get("/api/tasks").catch(() => api.get("/api/tasks/today")),
        api.get("/api/recovery-plans").catch(() => ({ data: [] })),
      ]);

      setSubjects(subRes.data || []);
      setTasks(taskRes.data || []);
      setPlans(planRes.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load recovery plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subjectNameById = useMemo(() => {
    const map = {};
    (subjects || []).forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [subjects]);

  const progress = useMemo(() => {
    const total = Number((tasks || []).length || 0);
    const completed = Number((tasks || []).filter((t) => t.is_done || normalize(t.status) === "done").length || 0);
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pct };
  }, [tasks]);

  return (
    <Layout>
      <div className="rpPage">
        <div className="rpHeader">
          <div>
            <h1 className="rpTitle">Recovery Plans</h1>
            <p className="rpSubtitle">Auto-generated from assessment weak topics.</p>
          </div>
          <div className="rpHeaderRight">
            <ProgressRing percent={progress.pct} />
          </div>
        </div>

        {error && <div className="rpAlert rpErr">{error}</div>}

        <div className="rpPanel">
          <div className="rpPanelHeader">
            <div>
              <div className="rpPanelTitle">Active Plans</div>
              <div className="rpHint">Plans are created automatically from assessment results.</div>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="rpEmpty">{loading ? "Loading..." : "No active plans found."}</div>
          ) : (
            <div className="rpTimeline">
              {plans.map((p) => (
                <div key={p.id} className="rpStep">
                  <div className="rpStepBody">
                    <div className="rpStepTop">
                      <div className="rpStepDate">
                        {subjectNameById[p.subject_id] || `Subject #${p.subject_id}`} - {p.priority}
                      </div>
                      <span className={`rpChip ${normalize(p.status) === "active" ? "primary" : "muted"}`}>{p.status}</span>
                    </div>
                    <div className="rpStepMain">Topics: {(p.topics || []).join(", ") || p.topic || "-"}</div>
                    <div className="rpHint">Target Date: {String(p.target_date || "").slice(0, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function ProgressRing({ percent }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (c * Math.max(0, Math.min(100, percent))) / 100;

  return (
    <div className="rpRingWrap" title={`Progress: ${percent}%`}>
      <svg width="84" height="84" viewBox="0 0 84 84" className="rpRing">
        <g transform="translate(42 42) rotate(-90)">
          <circle r={r} cx="0" cy="0" className="rpRingTrack" />
          <circle r={r} cx="0" cy="0" className="rpRingProg" style={{ strokeDasharray: `${dash} ${c - dash}` }} />
        </g>
        <text x="42" y="46" textAnchor="middle" className="rpRingText">
          {percent}%
        </text>
      </svg>
      <div className="rpRingLabel">Progress</div>
    </div>
  );
}
