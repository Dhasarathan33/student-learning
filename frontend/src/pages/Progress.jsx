import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Progress() {
  const [summary, setSummary] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      setMsg("");
      const res = await api.get("/api/progress/summary");
      setSummary(res.data || null);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to load progress");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => summary?.bySubject || [], [summary]);

  return (
    <Layout>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <h2 style={{ marginBottom: 6 }}>Progress</h2>
        <div style={{ color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
          Subject-wise improvement from task completion + gap score change.
        </div>

        {msg && <div style={{ color: "salmon", marginBottom: 12 }}>{msg}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
          <StatCard label="Overall" value={`${summary?.overallPercent || 0}%`} />
          <StatCard label="Total Tasks" value={summary?.total || 0} />
          <StatCard label="Completed" value={summary?.completed || 0} />
          <StatCard label="Pending" value={summary?.pending || 0} />
        </div>

        <Card>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>By Subject</div>
          {rows.length === 0 ? (
            <div style={{ opacity: 0.75 }}>No progress data yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((r) => (
                <div key={r.subject_id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700 }}>{r.subject_name}</div>
                    <div style={{ opacity: 0.85 }}>
                      {r.completed}/{r.total} ({r.percent}%)
                    </div>
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                    Gap score: {r.current_gap_score} - Change: {r.gap_score_change >= 0 ? "+" : ""}
                    {r.gap_score_change}
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
