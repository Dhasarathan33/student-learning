import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./subject.css";

export default function Subjects() {
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState([]);

  // ✅ NEW: edit state
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");

  // ✅ NEW: search + delete confirm (inline)
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    const res = await api.get("/api/subjects");
    setSubjects(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    setMsg("");
    if (!name.trim()) return setMsg("Subject name is required");
    await api.post("/api/subjects", { name });
    setName("");
    setMsg("Subject added");
    load();
  };

  // ✅ NEW: start edit
  const startEdit = (s) => {
    setMsg("");
    setConfirmDeleteId(null); // ✅ NEW: close delete confirm if open
    setEditId(s.id);
    setEditName(s.name);
  };

  // ✅ NEW: cancel edit
  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // ✅ NEW: save edit (PUT /api/subjects/:id)
  const saveEdit = async () => {
    setMsg("");
    if (!editName.trim()) return setMsg("Subject name is required");
    await api.put(`/api/subjects/${editId}`, { name: editName });
    setMsg("Subject updated");
    cancelEdit();
    load();
  };

  // ✅ NEW: delete (DELETE /api/subjects/:id)
  const remove = async (id) => {
    setMsg("");
    await api.delete(`/api/subjects/${id}`);
    setMsg("Subject deleted");
    setConfirmDeleteId(null); // ✅ NEW
    load();
  };

  // ✅ NEW: filter subjects by search
  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => String(s.name || "").toLowerCase().includes(q));
  }, [subjects, search]);

  return (
    <Layout>
      <div className="page subjectsPage">
        <div className="pageHeader">
          <h1 className="pageTitle">Subjects</h1>
          <p className="pageSubtitle">
            Organize the subjects you are focusing on for recovery.
          </p>
        </div>

        {/* ✅ NEW: message */}
        {msg && (
          <div
            className={`alert ${
              msg.toLowerCase().includes("required") ? "alertError" : "alertSuccess"
            }`}
          >
            {msg}
          </div>
        )}

        <div className="panel">
          <div className="formRow">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add subject (eg: Math)"
              className="textInput"
              // ✅ NEW: Enter key adds
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
            <button onClick={add} className="btnPrimary">
              Add
            </button>
          </div>

          {/* ✅ NEW: Search bar (no new CSS required) */}
          <div style={{ marginTop: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects..."
              className="textInput"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="list">
          {filteredSubjects.map((s) => {
            const status = (s.status || "active").toLowerCase();
            const statusClass = status === "recovery" ? "badgeWarn" : "badgeSuccess";

            const isEditing = editId === s.id;
            const isConfirmingDelete = confirmDeleteId === s.id;

            return (
              <div key={s.id} className="listItem">
                {/* LEFT */}
                <div className="subjectLeft">
                  {!isEditing ? (
                    <div className="listTitle">{s.name}</div>
                  ) : (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="textInput"
                      placeholder="Edit subject name"
                      style={{ width: "100%" }}
                      // ✅ NEW: Enter to save, Esc to cancel
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                  )}
                </div>

                {/* MIDDLE: badge */}
                <span className={`badge ${statusClass}`}>{status}</span>

                {/* RIGHT: actions */}
                <div className="subjectActions">
                  {!isEditing ? (
                    <>
                      {!isConfirmingDelete ? (
                        <>
                          <button
                            className="btnPrimary"
                            style={{ padding: "8px 12px" }}
                            onClick={() => startEdit(s)}
                          >
                            Edit
                          </button>

                          {/* ✅ NEW: inline delete confirm (replaces window.confirm UI) */}
                          <button
                            className="btnDanger"
                            style={{ padding: "8px 12px" }}
                            onClick={() => {
                              setMsg("");
                              setConfirmDeleteId(s.id);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btnDanger"
                            style={{ padding: "8px 12px" }}
                            onClick={() => remove(s.id)}
                          >
                            Confirm
                          </button>

                          <button
                            className="btnPrimary"
                            style={{ padding: "8px 12px" }}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="btnPrimary"
                        style={{ padding: "8px 12px" }}
                        onClick={saveEdit}
                      >
                        Save
                      </button>

                      <button
                        className="btnDanger"
                        style={{ padding: "8px 12px" }}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filteredSubjects.length === 0 && (
            <div className="emptyState">
              {subjects.length === 0 ? "No subjects added yet." : "No matching subjects."}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
