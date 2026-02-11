import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Progress() {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setMsg("");
      const [tRes, sRes] = await Promise.all([
        api.get("/api/tasks/all"),      // ✅ we will add this backend route (Step 4)
        api.get("/api/subjects"),
      ]);
      setTasks(tRes.data || []);
      setSubjects(sRes.data || []);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to load progress");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subjectNameById = useMemo(() => {
    const map = {};
    subjects.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [subjects]);

  const summary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => !!t.is_done).length;
    const pending = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // group by subject
    const bySubject = {};
    tasks.forEach((t) => {
      const sid = t.subject_id || "none";
      if (!bySubject[sid]) bySubject[sid] = { total: 0, completed: 0 };
      bySubject[sid].total += 1;
      if (t.is_done) bySubject[sid].completed += 1;
    });

    const subjectRows = Object.entries(bySubject).map(([sid, v]) => {
      const name =
        sid === "none" ? "No subject" : subjectNameById[Number(sid)] || `Subject #${sid}`;
      const p = v.total === 0 ? 0 : Math.round((v.completed / v.total) * 100);
      return { id: sid, name, ...v, percent: p };
    });

    // sort highest progress first
    subjectRows.sort((a, b) => b.percent - a.percent);

    return { total, completed, pending, percent, subjectRows };
  }, [tasks, subjectNameById]);

  return (
    <Layout>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Progress</h2>
        <div style={{ color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
          Completed tasks and subject-wise improvement (simple bars).
        </div>

        {msg && <div style={{ color: "salmon", marginBottom: 12 }}>{msg}</div>}

        {/* Top summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          <StatCard label="Overall" value={`${summary.percent}%`} />
          <StatCard label="Total Tasks" value={summary.total} />
          <StatCard label="Completed" value={summary.completed} />
          <StatCard label="Pending" value={summary.pending} />
        </div>

        {/* Overall bar */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Overall Progress</div>
            <div style={{ opacity: 0.8 }}>{summary.percent}%</div>
          </div>

          <Bar percent={summary.percent} />
        </Card>

        {/* Subject bars */}
        <Card style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Progress by Subject</div>

          {summary.subjectRows.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No tasks found. Add tasks to see progress.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {summary.subjectRows.map((r) => (
                <div key={r.id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ opacity: 0.8 }}>
                      {r.completed}/{r.total} ({r.percent}%)
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Bar percent={r.percent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.45)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div style={{ opacity: 0.75, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Bar({ percent }) {
  return (
    <div
      style={{
        height: 12,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: 999,
          background: "linear-gradient(90deg, #22c55e, #3b82f6)",
        }}
      />
    </div>
  );
}
