import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./tasks.css";

const COLS = [
  { key: "pending", title: "Pending" },
  { key: "in_progress", title: "In Progress" },
  { key: "done", title: "Done" },
];

const FLOW_STEPS = [
  "Assessment Taken",
  "Weak Topics Detected",
  "System Creates Tasks",
  "Student Studies / Practices",
  "System Marks Task Completed",
  "Progress Updated",
];

export default function Tasks() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [weakTopics, setWeakTopics] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    setMsg("");

    try {
      const [subRes, taskRes, gapsRes] = await Promise.all([
        api.get("/api/subjects"),
        api.get("/api/tasks").catch(() => api.get("/api/tasks/today")),
        api.get("/api/gaps"),
      ]);

      setSubjects(subRes.data || []);
      setTasks(taskRes.data || []);

      const weakOnly = (gapsRes.data || []).filter(
        (g) => String(g.level || "").trim().toLowerCase() === "weak"
      );
      setWeakTopics(weakOnly);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load task flow data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subjectNameById = useMemo(() => {
    const map = {};
    subjects.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [subjects]);

  const flowTasks = useMemo(() => tasks || [], [tasks]);

  const grouped = useMemo(() => {
    const g = { pending: [], in_progress: [], done: [] };

    flowTasks.forEach((t) => {
      const backend = String(t.status || "").trim().toLowerCase();
      const st =
        backend === "inprogress"
          ? "in_progress"
          : backend === "done"
          ? "done"
          : t.is_done
          ? "done"
          : "pending";
      (g[st] || g.pending).push(t);
    });

    return g;
  }, [flowTasks]);

  const startPractice = async (taskId) => {
    setUpdatingId(taskId);
    setError("");
    setMsg("");

    try {
      await api.put(`/api/tasks/${taskId}`, { status: "InProgress", is_done: 0 });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "InProgress", is_done: 0 } : t))
      );
      setMsg("Task moved to In Progress.");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to start practice");
    } finally {
      setUpdatingId(null);
    }
  };

  const markCompleted = async (taskId) => {
    setUpdatingId(taskId);
    setError("");
    setMsg("");

    try {
      await api.put(`/api/tasks/${taskId}/done`, { is_done: true });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "Done", is_done: 1 } : t)));
      setMsg("Task completed and progress updated.");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to mark task completed");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteTask = async (taskId) => {
    setDeletingId(taskId);
    setError("");
    setMsg("");

    try {
      await api.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setMsg("Task deleted.");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  const requestDeleteTask = (taskId) => {
    setConfirmDeleteTaskId(taskId);
  };

  const cancelDeleteTask = () => {
    setConfirmDeleteTaskId(null);
  };

  const confirmDeleteTask = async () => {
    if (!confirmDeleteTaskId) return;
    await deleteTask(confirmDeleteTaskId);
    setConfirmDeleteTaskId(null);
  };

  return (
    <Layout>
      <div className="tkPage">
        <div className="tkHeader">
          <div>
            <h1 className="tkTitle">Recovery Tasks</h1>
            <p className="tkSubtitle">
              Flow-only mode: Assessment -&gt; Weak Topics -&gt; Tasks -&gt; Practice -&gt; Complete
              -&gt; Progress
            </p>
          </div>

          <div className="tkTopRight">
            <div className="tkXP" style={{ minWidth: 320 }}>
              <div className="tkXPTop">
                <span className="tkXPLabel">Required Flow</span>
              </div>
              <div className="tkXPBadge" style={{ lineHeight: 1.7 }}>
                {FLOW_STEPS.map((step, i) => (
                  <div key={step}>{`${i + 1}. ${step}`}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {msg && <div className="tkAlert tkOk">{msg}</div>}
        {error && <div className="tkAlert tkErr">{error}</div>}

        <div className="tkAddPanel">
          <div className="tkAddRow" style={{ alignItems: "center" }}>
            <button className="tkBtn" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="tkHint">
            {weakTopics.length
              ? `Weak topics detected: ${weakTopics
                  .map((w) => `${subjectNameById[w.subject_id] || "Subject"} - ${w.topic}`)
                  .join(" | ")}`
              : "No weak topics found. Take an assessment first to unlock task generation."}
          </div>
        </div>

        <div className="tkBoard">
          {COLS.map((c) => (
            <div key={c.key} className="tkCol">
              <div className="tkColHeader">
                <div className="tkColTitle">{c.title}</div>
                <div className="tkColCount">{(grouped[c.key] || []).length}</div>
              </div>

              <div className="tkColBody">
                {(grouped[c.key] || []).map((t) => {
                  const subj = subjectNameById[t.subject_id] || "No subject";
                  const date = String(t.task_date || t.due_date || "").slice(0, 10);

                  return (
                    <div key={t.id} className="tkCard" style={{ cursor: "default" }}>
                      <div className="tkCardTop">
                        <div className="tkCardTitle" title={t.title}>
                          {t.title}
                        </div>
                      </div>

                      <div className="tkMeta">
                        <span className="tkMetaPill">{subj}</span>
                        {t.topic && <span className="tkMetaPill">{t.topic}</span>}
                        {date && <span className="tkMetaPill">{date}</span>}
                      </div>

                      <div className="tkCardBottom">
                        <span className={`tkTag ${c.key}`}>{c.key.replace("_", " ")}</span>

                        <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
                          {c.key === "pending" && (
                            <button className="tkBtn" onClick={() => startPractice(t.id)} disabled={updatingId === t.id || deletingId === t.id}>
                              {updatingId === t.id ? "Updating..." : "Start Practice"}
                            </button>
                          )}

                          {c.key === "in_progress" && (
                            <button
                              className="tkBtn tkBtnPrimary"
                              onClick={() => markCompleted(t.id)}
                              disabled={updatingId === t.id || deletingId === t.id}
                            >
                              {updatingId === t.id ? "Updating..." : "Mark Completed"}
                            </button>
                          )}

                          {c.key === "done" && <span className="tkXPChip">Progress Updated</span>}

                          <button className="tkBtn tkBtnDanger" onClick={() => requestDeleteTask(t.id)} disabled={deletingId === t.id || updatingId === t.id}>
                            {deletingId === t.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(grouped[c.key] || []).length === 0 && (
                  <div className="tkEmpty">
                    {c.key === "pending" ? "No pending tasks" : "No tasks yet"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDeleteTaskId && (
        <div className="tkModalBackdrop">
          <div className="tkModal">
            <div className="tkModalTitle">Delete this task?</div>
            <div className="tkModalSub">This action cannot be undone.</div>
            <div className="tkModalActions">
              <button className="tkBtn" onClick={cancelDeleteTask}>Cancel</button>
              <button className="tkBtn tkBtnDanger" onClick={confirmDeleteTask}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
