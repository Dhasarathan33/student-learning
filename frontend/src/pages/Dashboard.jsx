import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./dashboard.css";

export default function Dashboard() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const [error, setError] = useState("");

  // ---- LOAD DATA ----
  const load = async () => {
    setError("");
    try {
      const [subRes, todayRes] = await Promise.all([
        api.get("/api/subjects"),
        api.get("/api/tasks/today"),
      ]);

      setSubjects(subRes.data || []);
      setTodayTasks(todayRes.data || []);

      // Try to load ALL tasks for graphs (best).
      // If your backend doesn't have /api/tasks, it will fallback to today tasks.
      try {
        const allRes = await api.get("/api/tasks");
        setTasks(allRes.data || []);
      } catch {
        setTasks(todayRes.data || []);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load dashboard data");
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---- COMPUTE PROGRESS ----
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

  // subject-wise progress: completed/total per subject
  const subjectBars = useMemo(() => {
    const map = {}; // { subjectName: { total, completed } }

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

    // show best/highest first
    arr.sort((a, b) => b.pct - a.pct);

    // show top 6 only to keep dashboard clean
    return arr.slice(0, 6);
  }, [tasks, subjectNameById]);

  const formatDate = (d) => (d ? String(d).slice(0, 10) : "");

  // ✅ NEW: Weekly completed tasks data (last 7 days)
  const weeklyData = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const completedCount = tasks.filter(
        (t) => !!t.is_done && String(t.task_date).slice(0, 10) === dateStr
      ).length;

      out.push({
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        date: dateStr,
        count: completedCount,
      });
    }
    return out;
  }, [tasks]);

  // ✅ NEW: Max for scaling bars
  const maxWeekly = useMemo(() => {
    const max = Math.max(...weeklyData.map((d) => d.count), 1);
    return max;
  }, [weeklyData]);

  // ---- UI ----
  return (
    <Layout>
      <div className="dbPage">
        <div className="dbHeader">
          <h1 className="dbTitle">Dashboard</h1>
          <p className="dbSubtitle">
            Quick overview + progress graphs (simple bars).
          </p>
        </div>

        {error && <div className="dbAlert dbAlertError">{error}</div>}

        {/* Top Summary Cards */}
        <div className="dbCards">
          <Card title="Subjects in Recovery" value={subjects.length} />
          <Card title="Today Tasks" value={todayTasks.length} />
          <Card title="Completed" value={stats.completed} />
          <Card title="Overall Progress" value={`${stats.overallPct}%`} />
        </div>

        {/* Graph Section */}
        <div className="dbGrid2">
          {/* Overall Progress bar */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div className="dbPanelTitle">Overall Progress</div>
              <div className="dbPanelHint">{stats.overallPct}%</div>
            </div>

            <div className="dbBar">
              <div
                className="dbBarFill"
                style={{ width: `${stats.overallPct}%` }}
              />
            </div>

            <div className="dbPills">
              <span className="dbPill">
                Total: <b>{stats.total}</b>
              </span>
              <span className="dbPill">
                Completed: <b>{stats.completed}</b>
              </span>
              <span className="dbPill">
                Pending: <b>{stats.pending}</b>
              </span>
            </div>
          </div>

          {/* Subject-wise bar chart */}
          <div className="dbPanel">
            <div className="dbPanelHeader">
              <div className="dbPanelTitle">Progress by Subject</div>
              <div className="dbPanelHint">Top {subjectBars.length}</div>
            </div>

            {subjectBars.length === 0 ? (
              <div className="dbEmpty">
                No tasks found. Add tasks to see subject progress.
              </div>
            ) : (
              <div className="dbSubjectList">
                {subjectBars.map((s) => (
                  <div key={s.name} className="dbSubjectItem">
                    <div className="dbSubjectTop">
                      <div className="dbSubjectName">{s.name}</div>
                      <div className="dbSubjectStat">
                        {s.completed}/{s.total} ({s.pct}%)
                      </div>
                    </div>

                    <div className="dbBar">
                      <div
                        className="dbBarFill"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ✅ NEW: Weekly Completed Tasks Graph */}
        <div className="dbPanel" style={{ marginTop: 14 }}>
          <div className="dbPanelHeader">
            <div>
              <div className="dbPanelTitle">Weekly Completed Tasks</div>
              <div className="dbPanelHint">Last 7 days (completed only)</div>
            </div>
            <div className="dbPanelHint">Max: {maxWeekly}</div>
          </div>

          <div className="weeklyGraph">
            {weeklyData.map((d) => {
              const heightPct = Math.round((d.count / maxWeekly) * 100);
              return (
                <div key={d.date} className="weeklyBarWrap">
                  <div className="weeklyCount">{d.count}</div>

                  <div className="weeklyBarBg" title={`${d.date}: ${d.count} done`}>
                    <div
                      className="weeklyBar"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>

                  <div className="weeklyLabel">{d.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today Focus */}
        <div className="dbPanel">
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
                    <div
                      className={`dbTaskTitle ${t.is_done ? "isDone" : ""}`}
                    >
                      {t.title}
                    </div>
                    <div className="dbTaskMeta">
                      {subjectNameById[t.subject_id] || "No subject"} •{" "}
                      {formatDate(t.task_date)}
                    </div>
                  </div>

                  <span
                    className={`dbStatus ${t.is_done ? "done" : "pending"}`}
                  >
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
