import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Gaps() {
  const [subjects, setSubjects] = useState([]);
  const [rows, setRows] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Average");
  const [msg, setMsg] = useState("");

  const loadSubjects = async () => {
    const res = await api.get("/api/subjects");
    setSubjects(res.data);
  };

  const loadGaps = async () => {
    const res = await api.get("/api/gaps");
    setRows(res.data);
  };

  useEffect(() => {
    loadSubjects();
    loadGaps();
  }, []);

  const save = async () => {
    setMsg("");
    if (!subjectId) return setMsg("Select a subject");
    if (!topic.trim()) return setMsg("Enter a topic");

    await api.post("/api/gaps", {
      subject_id: Number(subjectId),
      topic,
      level,
    });

    setTopic("");
    setLevel("Average");
    setMsg("Saved");
    loadGaps();
  };

  const remove = async (id) => {
    await api.delete(`/api/gaps/${id}`);
    loadGaps();
  };

  return (
    <Layout>
      <div className="page">
        <div className="pageHeader">
          <h1 className="pageTitle">Learning Gap Assessment</h1>
          <p className="pageSubtitle">
            Rate your topic level and save it: <span className="kpiValue" style={{ fontSize: 14 }}>Weak / Average / Good</span>
          </p>
        </div>

        {msg && (
          <div className={`alert ${msg.startsWith("Saved") ? "alertSuccess" : "alertError"}`}>
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

            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="selectInput"
            >
              <option value="Weak">Weak</option>
              <option value="Average">Average</option>
              <option value="Good">Good</option>
            </select>

            <button
              onClick={save}
              className="btnPrimary"
            >
              Save
            </button>
          </div>
        </div>

        <div className="filterRow">
          <h3 className="pageTitle" style={{ fontSize: 18, margin: 0 }}>Saved Gaps</h3>
          <span className="countText">{rows.length} item(s)</span>
        </div>

        {rows.length === 0 ? (
          <div className="emptyState">
            No gaps saved yet.
          </div>
        ) : (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Topic</th>
                  <th>Level</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const levelLower = String(r.level || "").toLowerCase();
                  const levelClass =
                    levelLower === "weak"
                      ? "badgeWarn"
                      : levelLower === "good"
                        ? "badgeSuccess"
                        : "badgeInfo";

                  return (
                    <tr key={r.id}>
                      <td>{r.subject_name}</td>
                      <td>{r.topic}</td>
                      <td>
                        <span className={`badge ${levelClass}`}>
                          {r.level}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => remove(r.id)}
                          className="btnDangerAlt"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
