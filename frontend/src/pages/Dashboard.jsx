import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./dashboard.css";

const makeLast7Days = () => {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    arr.push({ dateStr, label });
  }
  return arr;
};

const RECOVERY_FLOW_STEPS = [
  { id: 1, label: "Assessment Taken", path: "/assessment" },
  { id: 2, label: "Weak Topics Detected", path: "/gaps" },
  { id: 3, label: "System Creates Tasks", path: "/tasks" },
  { id: 4, label: "Student Studies / Practices", path: "/tasks" },
  { id: 5, label: "System Marks Task Completed", path: "/tasks" },
  { id: 6, label: "Progress Updated", path: "/progress" },
];

const RECOVERY_FLOW_TEXT = RECOVERY_FLOW_STEPS.map((x) => x.label).join(" -> ");

export default function Dashboard() {
  const nav = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]); // today tasks used for cards + today's progress
  const [todayTasks, setTodayTasks] = useState([]);
  const [error, setError] = useState("");

  // ✅ gaps + weekly analytics
  const [gaps, setGaps] = useState([]); // expects: [{ level: "weak"|"average"|"good" }...] (optional)
  const [weeklySeries, setWeeklySeries] = useState([]); // 7 days: {date,label,total,done,pct}
  const [dashboardSummary, setDashboardSummary] = useState(null);

  // ---- HELPERS ----
  const formatDate = (d) => (d ? String(d).slice(0, 10) : "");

  // ---- LOAD DATA ----
  const load = useCallback(async () => {
    setError("");
    try {
      // subjects + today tasks
      const [subRes, todayRes] = await Promise.all([
        api.get("/api/subjects"),
        api.get("/api/tasks/today"),
      ]);

      setSubjects(subRes.data || []);
      setTodayTasks(todayRes.data || []);
      setTasks(todayRes.data || []); // today-based progress (no /api/tasks)

      // ✅ weekly (7 days) using by-date endpoint
      const last7 = makeLast7Days();
      const weeklyResponses = await Promise.all(
        last7.map((d) =>
          api
            .get("/api/tasks/by-date", { params: { date: d.dateStr } })
            .then((res) => ({ ok: true, data: res.data || [], ...d }))
            .catch(() => ({ ok: false, data: [], ...d }))
        )
      );

      const weekly = weeklyResponses.map((r) => {
        const total = r.data.length;
        const done = r.data.filter((t) => !!t.is_done).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { date: r.dateStr, label: r.label, total, done, pct };
      });

      setWeeklySeries(weekly);

      // ✅ gaps (optional)
      try {
        const gapsRes = await api.get("/api/gaps");
        setGaps(gapsRes.data || []);
      } catch {
        setGaps([]);
      }

      try {
        const dashRes = await api.get("/api/dashboard/summary");
        setDashboardSummary(dashRes.data || null);
      } catch {
        setDashboardSummary(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load dashboard data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- COMPUTE TODAY PROGRESS ----
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => !!t.is_done).length;
    const pending = total - completed;
    const overallPct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, overallPct };
  }, [tasks]);

  const subjectNameById = useMemo(() => {
    const map = {};
    subjects.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [subjects]);

  // subject-wise progress: based on TODAY tasks
  const _subjectBars = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const name = subjectNameById[t.subject_id] || "No subject";
      if (!map[name]) map[name] = { total: 0, completed: 0 };
      map[name].total += 1;
      if (t.is_done) map[name].completed += 1;
    });

    const arr = Object.entries(map).map(([name, v]) => {
      const pct = v.total === 0 ? 0 : Math.round((v.completed / v.total) * 100);
      return { name, ...v, pct };
    });

    arr.sort((a, b) => b.pct - a.pct);
    return arr.slice(0, 6);
  }, [tasks, subjectNameById]);

  // ✅ Pie chart data (Gap Distribution)
  const gapDist = useMemo(() => {
    const out = { weak: 0, average: 0, good: 0 };
    gaps.forEach((g) => {
      const lvl = String(g.level || g.gap_level || g.status || "").toLowerCase();
      if (lvl.includes("weak")) out.weak += 1;
      else if (lvl.includes("avg") || lvl.includes("average")) out.average += 1;
      else if (lvl.includes("good")) out.good += 1;
    });
    const total = out.weak + out.average + out.good;
    return { ...out, total };
  }, [gaps]);

  // ✅ Line chart points (7 day improvement = daily completion %)
  const linePoints = useMemo(() => weeklySeries.map((d) => d.pct), [weeklySeries]);

  const maxWeeklyDone = useMemo(() => {
    const max = Math.max(...weeklySeries.map((d) => d.done), 1);
    return max;
  }, [weeklySeries]);

  // ✅ Performance Score (0-100)
  const performanceScore = useMemo(() => {
    if (!weeklySeries.length) return 0;

    const avgPct =
      Math.round(
        weeklySeries.reduce((sum, d) => sum + d.pct, 0) / weeklySeries.length
      ) || 0;

    const weakPenalty =
      gapDist.total > 0 ? Math.round((gapDist.weak / gapDist.total) * 20) : 0;

    return Math.max(0, Math.min(100, avgPct - weakPenalty));
  }, [weeklySeries, gapDist]);

  // ✅ Weekly Achievement Badge
  const weeklyBadge = useMemo(() => {
    const totalDone = weeklySeries.reduce((sum, d) => sum + d.done, 0);
    if (totalDone >= 20) return { label: "Gold Achiever", tone: "gold" };
    if (totalDone >= 10) return { label: "Silver Streak", tone: "silver" };
    if (totalDone >= 5) return { label: "Bronze Starter", tone: "bronze" };
    return { label: "Getting Started", tone: "starter" };
  }, [weeklySeries]);

  // ---- SVG HELPERS (NO LIBS) ----
  const buildLinePath = (values, w, h, pad) => {
    const n = values.length;
    if (!n) return "";

    const maxV = Math.max(...values, 100);
    const minV = 0;

    const xStep = n === 1 ? 0 : (w - pad * 2) / (n - 1);

    const points = values.map((v, i) => {
      const x = pad + i * xStep;
      const y =
        pad +
        (h - pad * 2) *
          (1 - (Math.max(minV, Math.min(maxV, v)) - minV) / (maxV - minV));
      return `${x},${y}`;
    });

    return `M ${points[0]} ` + points.slice(1).map((p) => `L ${p}`).join(" ");
  };

  const Pie = ({ weak, average, good, total }) => {
    const r = 44;
    const c = 2 * Math.PI * r;

    const wPct = total ? weak / total : 0;
    const aPct = total ? average / total : 0;
    const gPct = total ? good / total : 0;

    const wLen = c * wPct;
    const aLen = c * aPct;
    const gLen = c * gPct;

    const wOff = 0;
    const aOff = wLen;
    const gOff = wLen + aLen;

    return (
      <div className="anaPieWrap">
        <svg width="120" height="120" viewBox="0 0 120 120" className="anaPie">
          <g transform="translate(60 60) rotate(-90)">
            <circle className="anaPieTrack" r={r} cx="0" cy="0" />
            <circle
              className="anaPieWeak"
              r={r}
              cx="0"
              cy="0"
              style={{
                strokeDasharray: `${wLen} ${c - wLen}`,
                strokeDashoffset: -wOff,
              }}
            />
            <circle
              className="anaPieAvg"
              r={r}
              cx="0"
              cy="0"
              style={{
                strokeDasharray: `${aLen} ${c - aLen}`,
                strokeDashoffset: -aOff,
              }}
            />
            <circle
              className="anaPieGood"
              r={r}
              cx="0"
              cy="0"
              style={{
                strokeDasharray: `${gLen} ${c - gLen}`,
                strokeDashoffset: -gOff,
              }}
            />
          </g>
          <text x="60" y="62" textAnchor="middle" className="anaPieCenter">
            {total || 0}
          </text>
          <text x="60" y="78" textAnchor="middle" className="anaPieCenterSub">
            gaps
          </text>
        </svg>

        <div className="anaLegend">
          <div className="anaLegendRow">
            <span className="dot weak" /> Weak: <b>{weak}</b>
          </div>
          <div className="anaLegendRow">
            <span className="dot avg" /> Average: <b>{average}</b>
          </div>
          <div className="anaLegendRow">
            <span className="dot good" /> Good: <b>{good}</b>
          </div>
        </div>
      </div>
    );
  };

  const LineChart = ({ series }) => {
    const w = 520;
    const h = 160;
    const pad = 18;
    const path = buildLinePath(series.map((x) => Number(x || 0)), w, h, pad);

    return (
      <div className="anaLineWrap">
        <svg className="anaLine" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <line x1="0" y1={h - pad} x2={w} y2={h - pad} className="anaGrid" />
          <line x1="0" y1={pad} x2={w} y2={pad} className="anaGrid" />
          <path d={path} className="anaLinePath" />
          {series.map((v, i) => {
            const n = series.length;
            const xStep = n === 1 ? 0 : (w - pad * 2) / (n - 1);
            const x = pad + i * xStep;
            const y = pad + (h - pad * 2) * (1 - v / 100);
            return <circle key={i} cx={x} cy={y} r="4" className="anaDot" />;
          })}
        </svg>

        <div className="anaLineLabels">
          {weeklySeries.map((d) => (
            <div key={d.date} className="anaLineLabel">
              <div className="anaLineDay">{d.label}</div>
              <div className="anaLinePct">{d.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- UI ----
  return (
    <Layout>
      <div className="dbPage">
        <div className="dbHeader">
          <h1 className="dbTitle">Dashboard</h1>
          <p className="dbSubtitle">
            Analytics Center: gaps + improvement + score + achievements.
          </p>
        </div>

        {error && <div className="dbAlert dbAlertError">{error}</div>}

        {/* Top Summary Cards */}
        <div className="dbCards">
          <Card title="Subjects" value={subjects.length} />
          <Card title="Today Tasks" value={todayTasks.length} />
          <Card title="Completed Today" value={stats.completed} />
          <Card title="Overall Today" value={`${stats.overallPct}%`} />
        </div>


        {/* ✅ ANALYTICS CENTER */}
        <div className="anaGrid">
          {/* Pie */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div>
                <div className="dbPanelTitle">Gap Distribution</div>
                <div className="dbPanelHint">Weak / Average / Good</div>
              </div>
              <div className="dbPanelHint">
                {gapDist.total ? "from saved gaps" : "no gap data"}
              </div>
            </div>

            {gapDist.total === 0 ? (
              <div className="dbEmpty">
                No gaps found. Add gaps in the Gaps page to show this chart.
              </div>
            ) : (
              <Pie weak={gapDist.weak} average={gapDist.average} good={gapDist.good} total={gapDist.total} />
            )}
          </div>

          {/* Line */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div>
                <div className="dbPanelTitle">7 Day Improvement</div>
                <div className="dbPanelHint">Daily completion %</div>
              </div>
              <div className="dbPanelHint">
                Avg:{" "}
                {weeklySeries.length
                  ? Math.round(
                      weeklySeries.reduce((s, d) => s + d.pct, 0) / weeklySeries.length
                    )
                  : 0}
                %
              </div>
            </div>

            {weeklySeries.length === 0 ? (
              <div className="dbEmpty">No weekly data.</div>
            ) : (
              <LineChart series={linePoints} />
            )}
          </div>

          {/* Score */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div>
                <div className="dbPanelTitle">Performance Score</div>
                <div className="dbPanelHint">Auto score (0-100)</div>
              </div>
              <div className="anaScore">{performanceScore}</div>
            </div>

            <div className="dbBar">
              <div className="dbBarFill" style={{ width: `${performanceScore}%` }} />
            </div>

            <div className="dbPills" style={{ marginTop: 10 }}>
              <span className="dbPill">
                Weekly Done: <b>{weeklySeries.reduce((s, d) => s + d.done, 0)}</b>
              </span>
              <span className="dbPill">
                Weak Gaps: <b>{gapDist.weak}</b>
              </span>
            </div>
          </div>

          {/* Badge */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div>
                <div className="dbPanelTitle">Weekly Achievement</div>
                <div className="dbPanelHint">Badge based on last 7 days</div>
              </div>
              <span className={`anaBadge ${weeklyBadge.tone}`}>🏆 {weeklyBadge.label}</span>
            </div>

            <div className="weeklyGraph" style={{ marginTop: 10 }}>
              {weeklySeries.map((d) => {
                const heightPct = Math.round((d.done / maxWeeklyDone) * 100);
                return (
                  <div key={d.date} className="weeklyBarWrap">
                    <div className="weeklyCount">{d.done}</div>

                    <div className="weeklyBarBg" title={`${d.date}: ${d.done} done`}>
                      <div className="weeklyBar" style={{ height: `${heightPct}%` }} />
                    </div>

                    <div className="weeklyLabel">{d.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dbPanel" style={{ marginTop: 14 }}>
          <div className="dbPanelHeader">
            <div>
              <div className="dbPanelTitle">Next Best Action</div>
              <div className="dbPanelHint">{dashboardSummary?.flow || RECOVERY_FLOW_TEXT}</div>
            </div>
          </div>

          <div className="dbTaskCard" style={{ marginTop: 10 }}>
            <div className="dbTaskLeft">
              <div className="dbTaskTitle">{dashboardSummary?.nextBestAction || "Complete pending tasks and reassess."}</div>
              <div className="dbTaskMeta">
                Performance: {dashboardSummary?.performanceScore ?? performanceScore} • Badge: {dashboardSummary?.weeklyAchievementBadge || weeklyBadge.label}
              </div>
            </div>
            <span className="dbStatus pending">Action</span>
          </div>

          {dashboardSummary?.reassessment?.show_cta && (
            <div style={{ marginTop: 12 }}>
              <button className="dbBtnPrimary" onClick={() => nav("/assessment")}>
                Take A New Assessment
              </button>
              <div className="dbPanelHint" style={{ marginTop: 6 }}>
                {dashboardSummary?.reassessment?.reason}
              </div>
            </div>
          )}
        </div>

        {/* ✅ REMOVED duplicate "Existing Graph Section" to avoid same features again */}

        {/* Today Focus */}
        <div className="dbPanel" style={{ marginTop: 14 }}>
          <div className="dbPanelHeader">
            <div>
              <div className="dbPanelTitle">Today Focus</div>
              <div className="dbPanelHint">Quick list of today’s tasks</div>
            </div>
            <div className="dbPanelHint">{todayTasks.length} task(s)</div>
          </div>

          {todayTasks.length === 0 ? (
            <div className="dbEmpty">No tasks for today.</div>
          ) : (
            <div className="dbTodayGrid">
              {todayTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="dbTaskCard">
                  <div className="dbTaskLeft">
                    <div className={`dbTaskTitle ${t.is_done ? "isDone" : ""}`}>
                      {t.title}
                    </div>
                    <div className="dbTaskMeta">
                      {subjectNameById[t.subject_id] || "No subject"} •{" "}
                      {formatDate(t.task_date)}
                    </div>
                  </div>

                  <span className={`dbStatus ${t.is_done ? "done" : "pending"}`}>
                    {t.is_done ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Card({ title, value }) {
  return (
    <div className="dbCard">
      <div className="dbCardTitle">{title}</div>
      <div className="dbCardValue">{value}</div>
    </div>
  );
}
