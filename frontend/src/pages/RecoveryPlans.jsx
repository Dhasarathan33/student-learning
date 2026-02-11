import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function RecoveryPlans() {
  const [subjects, setSubjects] = useState([]);
  const [plans, setPlans] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [priority, setPriority] = useState("Medium");
  const [msg, setMsg] = useState("");

  const loadSubjects = async () => {
    const res = await api.get("/api/subjects");
    setSubjects(res.data);
  };

  const loadPlans = async () => {
    const res = await api.get("/api/recovery-plans");
    setPlans(res.data);
  };

  useEffect(() => {
    loadSubjects();
    loadPlans();
  }, []);

  const add = async () => {
    setMsg("");
    if (!subjectId) return setMsg("Select a subject");
    if (!topic.trim()) return setMsg("Enter a topic");
    if (!targetDate) return setMsg("Choose target date");

    await api.post("/api/recovery-plans", {
      subject_id: Number(subjectId),
      topic,
      target_date: targetDate,
      daily_minutes: Number(dailyMinutes),
      priority,
    });

    setTopic("");
    setDailyMinutes(30);
    setPriority("Medium");
    setMsg("Plan created");
    loadPlans();
  };

  const toggleStatus = async (p) => {
    const next = p.status === "Active" ? "Completed" : "Active";
    await api.put(`/api/recovery-plans/${p.id}/status`, { status: next });
    loadPlans();
  };

  const remove = async (id) => {
    await api.delete(`/api/recovery-plans/${id}`);
    loadPlans();
  };

  const counts = useMemo(() => {
    const active = plans.filter(p => p.status === "Active").length;
    const completed = plans.length - active;
    return { active, completed, total: plans.length };
  }, [plans]);

  return (
    <Layout>
      <div className="page">
        <div className="pageHeader">
          <h1 className="pageTitle">Recovery Plan Builder</h1>
          <p className="pageSubtitle">
            Create a plan: subject {"->"} topic {"->"} target date {"->"} daily minutes {"->"} priority
          </p>
        </div>

        {msg && (
          <div className={`alert ${msg.startsWith("Plan created") ? "alertSuccess" : "alertError"}`}>
            {msg}
          </div>
        )}

        <div className="panel">
          <div className="formRow">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="selectInput"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (eg: Fractions)"
              className="textInput"
            />

            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="dateInput"
            />

            <input
              type="number"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(e.target.value)}
              min={5}
              max={300}
              className="numberInput"
              placeholder="Minutes"
            />

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="selectInput"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <button onClick={add} className="btnPrimary">
              Create Plan
            </button>
          </div>
        </div>

        <div className="chips">
          <span className="chip">Total: <b>{counts.total}</b></span>
          <span className="chip">Active: <b>{counts.active}</b></span>
          <span className="chip">Completed: <b>{counts.completed}</b></span>
        </div>

        <div className="filterRow">
          <h3 className="pageTitle" style={{ fontSize: 18, margin: 0 }}>Your Plans</h3>
          <span className="countText">{plans.length} plan(s)</span>
        </div>

        {plans.length === 0 ? (
          <div className="emptyState">
            No plans created yet.
          </div>
        ) : (
          <div className="list">
            {plans.map((p) => {
              const statusClass = p.status === "Completed"
                ? "badgeSuccess"
                : "badgeInfo";

              const priorityLower = String(p.priority || "").toLowerCase();
              const priorityClass =
                priorityLower === "high"
                  ? "badgeWarn"
                  : priorityLower === "low"
                    ? "badgeInfo"
                    : "badgeWarn";

              return (
                <div key={p.id} className="planCard">
                  <div className="planHeader">{p.subject_name}</div>
                  <div className="planSub">{p.topic}</div>
                  <div className="planMeta">
                    <div>Target date: <b>{String(p.target_date).slice(0, 10)}</b></div>
                    <div>Daily time: <b>{p.daily_minutes} min</b></div>
                    <div>Priority: <span className={`badge ${priorityClass}`}>{p.priority}</span></div>
                  </div>
                  <div className="planMeta">
                    <span className={`badge ${statusClass}`}>{p.status}</span>
                  </div>
                  <div className="planActions">
                    <button onClick={() => toggleStatus(p)} className="btnGhost">
                      {p.status === "Active" ? "Mark Completed" : "Mark Active"}
                    </button>
                    <button onClick={() => remove(p.id)} className="btnDangerAlt">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
