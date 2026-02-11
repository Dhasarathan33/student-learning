import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Subjects() {
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState([]);

  // ✅ NEW: edit state
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");

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
    const ok = window.confirm("Delete this subject?");
    if (!ok) return;
    await api.delete(`/api/subjects/${id}`);
    setMsg("Subject deleted");
    load();
  };

  return (
    <Layout>
      <div className="page">
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
            />
            <button onClick={add} className="btnPrimary">
              Add
            </button>
          </div>
        </div>

        <div className="list">
          {subjects.map((s) => {
            const status = (s.status || "active").toLowerCase();
            const statusClass = status === "recovery" ? "badgeWarn" : "badgeSuccess";

            const isEditing = editId === s.id;

            return (
              <div key={s.id} className="listItem">
                {/* LEFT */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!isEditing ? (
                    <div className="listTitle">{s.name}</div>
                  ) : (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="textInput"
                      placeholder="Edit subject name"
                      style={{ width: "100%" }}
                    />
                  )}
                </div>

                {/* MIDDLE: badge */}
                <span className={`badge ${statusClass}`}>{status}</span>

                {/* RIGHT: actions */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {!isEditing ? (
                    <>
                      <button
                        className="btnPrimary"
                        style={{ padding: "8px 12px" }}
                        onClick={() => startEdit(s)}
                      >
                        Edit
                      </button>

                      <button
                        className="btnDanger"
                        style={{ padding: "8px 12px" }}
                        onClick={() => remove(s.id)}
                      >
                        Delete
                      </button>
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

          {subjects.length === 0 && (
            <div className="emptyState">No subjects added yet.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
