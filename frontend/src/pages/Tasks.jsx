import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./tasks.css";

export default function Tasks() {
  const toLocalDateInput = (value) => {
    const d = new Date(value);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const [title, setTitle] = useState("");
  const [taskDate, setTaskDate] = useState(() => {
    return toLocalDateInput(new Date());
  });
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [msg, setMsg] = useState("");

  // ✅ NEW (Edit states)
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDate, setEditDate] = useState("");

  const loadSubjects = async () => {
    const res = await api.get("/api/subjects");
    setSubjects(res.data);
  };

  const loadByDate = async (date) => {
    const res = await api.get("/api/tasks/by-date", { params: { date } });
    setTasks(res.data);
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    loadByDate(taskDate);
  }, [taskDate]);

  const add = async () => {
    setMsg("");
    if (!title.trim()) return setMsg("Task title is required");
    if (!subjectId) return setMsg("Please choose a subject");

    await api.post("/api/tasks", {
      title,
      task_date: taskDate,
      subject_id: Number(subjectId),
    });

    setTitle("");
    setMsg("Task added");
    loadByDate(taskDate);
  };

  const toggleDone = async (t) => {
    await api.put(`/api/tasks/${t.id}/done`, { is_done: !t.is_done });
    loadByDate(taskDate);
  };

  // ✅ NEW (Edit + Delete functions)
  const startEdit = (t) => {
    setMsg("");
    setEditingId(t.id);
    setEditTitle(t.title || "");
    setEditSubjectId(String(t.subject_id || ""));
    setEditDate(t.task_date ? toLocalDateInput(t.task_date) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditSubjectId("");
    setEditDate("");
  };

  const saveEdit = async () => {
    setMsg("");
    if (!editTitle.trim()) return setMsg("Task title is required");
    if (!editSubjectId) return setMsg("Please choose a subject");
    if (!editDate) return setMsg("Choose a date");

    // ✅ Works only if backend has PUT /api/tasks/:id
    await api.put(`/api/tasks/${editingId}`, {
      title: editTitle,
      task_date: editDate,
      subject_id: Number(editSubjectId),
    });

    setMsg("Task updated");
    setEditingId(null);
    loadByDate(taskDate);
  };

  const removeTask = async (id) => {
    await api.delete(`/api/tasks/${id}`);
    setMsg("Task deleted");
    loadByDate(taskDate);
  };

  const subjectNameById = useMemo(() => {
    const map = {};
    subjects.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [subjects]);

  const filteredTasks = filterSubjectId
    ? tasks.filter((t) => String(t.subject_id) === String(filterSubjectId))
    : tasks;

  const doneCount = filteredTasks.filter((t) => !!t.is_done).length;
  const pendingCount = filteredTasks.length - doneCount;
  const progress = filteredTasks.length
    ? Math.round((doneCount / filteredTasks.length) * 100)
    : 0;

  return (
    <Layout>
      <div className="page">
        {/* Header */}
        <div className="pageHeader">
          <h1 className="pageTitle">Plan Today's Study Tasks</h1>
          <p className="pageSubtitle">
            Add tasks, assign subjects, and track progress easily.
          </p>
        </div>

        {/* ✅ NEW LINE ADDED: Progress summary */}
        <div className="progressWrap">
          <div className="progressTop">
            <div className="progressTitle">Progress</div>
            <div className="progressPercent">{progress}%</div>
          </div>

          <div className="progressBar">
            <div
              className="progressFill"
              style={{ width: `${progress}%` }}
              aria-label="progress bar"
            />
          </div>

          <div className="progressStats">
            <div className="statBox">
              <div className="statLabel">Total</div>
              <div className="statValue">{filteredTasks.length}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Completed</div>
              <div className="statValue">{doneCount}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Pending</div>
              <div className="statValue">{pendingCount}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Subjects</div>
              <div className="statValue">{subjects.length}</div>
            </div>
          </div>
        </div>

        {/* Message */}
        {msg && (
          <div
            className={`alert ${
              msg.startsWith("Task added") ||
              msg.startsWith("Task updated") ||
              msg.startsWith("Task deleted")
                ? "alertSuccess"
                : "alertError"
            }`}
          >
            {msg}
          </div>
        )}

        {/* Add Task Section */}
        <div className="panel">
          <div className="formRow">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title (Eg: Revise Algebra)"
              className="textInput"
            />

            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="selectInput"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              className="dateInput"
            />

            <button onClick={add} className="btnPrimary">
              Add
            </button>
          </div>

          {/* Filter */}
          <div className="filterRow">
            <select
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className="selectInput"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="countText">{filteredTasks.length} task(s)</div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="list">
          {filteredTasks.map((t) => {
            const done = !!t.is_done;
            const subjectName = subjectNameById[t.subject_id] || "No subject";

            return (
              <div key={t.id} className="listItem">
                <div className="listLeft">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleDone(t)}
                  />

                  {/* ✅ NEW: Edit mode UI */}
                  {editingId === t.id ? (
                    <div className="editBox">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="textInput"
                        placeholder="Task title"
                      />

                      <select
                        value={editSubjectId}
                        onChange={(e) => setEditSubjectId(e.target.value)}
                        className="selectInput"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="dateInput"
                      />

                      <div className="editActions">
                        <button className="btnPrimary" onClick={saveEdit}>
                          Save
                        </button>
                        <button className="btnGhost" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className={`listTitle ${done ? "done" : ""}`}>
                        {t.title}
                      </div>

                      <div className="listMeta">
                        {subjectName} - {t.task_date}
                      </div>
                    </div>
                  )}
                </div>

                {/* ✅ NEW: Actions (Edit/Delete) */}
                <div className="rightActions">
                  <span
                    className={`badge ${done ? "badgeSuccess" : "badgeWarn"}`}
                  >
                    {done ? "Completed" : "Pending"}
                  </span>

                  <button className="iconBtn" onClick={() => startEdit(t)}>
                    Edit
                  </button>

                  <button
                    className="iconBtn danger"
                    onClick={() => removeTask(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="emptyState">No tasks found.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
