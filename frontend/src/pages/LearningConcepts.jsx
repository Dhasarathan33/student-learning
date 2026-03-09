import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function LearningConcepts() {
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicSearch, setTopicSearch] = useState("");

  // add form
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("youtube"); // youtube | note
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [difficulty, setDifficulty] = useState("basic");

  const [tab, setTab] = useState("youtube"); // youtube | note
  const [msg, setMsg] = useState("");

  // ✅ NEW: auto youtube search
  const [ytResults, setYtResults] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytErr, setYtErr] = useState("");

  const loadSubjects = async () => {
    const res = await api.get("/api/subjects");
    setSubjects(res.data || []);
  };

  const loadResources = async () => {
    const params = {};
    if (subjectId) params.subject_id = subjectId;
    if (topicSearch.trim()) params.topic = topicSearch.trim();

    const res = await api.get("/api/resources", { params });
    setResources(res.data || []);
  };

  // ✅ NEW: Auto search YouTube videos (no manual paste)
  const searchYoutube = async () => {
    setYtErr("");
    setYtResults([]);

    const subjectName =
      subjects.find((s) => String(s.id) === String(subjectId))?.name || "";

    const baseTopic = (topicSearch || topic || "").trim();
    if (!subjectId) return setYtErr("Select subject first");
    if (!baseTopic) return setYtErr("Enter topic in search box first");

    const q = `${baseTopic} in ${subjectName} tutorial`.trim();

    setYtLoading(true);
    try {
      const res = await api.get("/api/youtube/search", { params: { q } });
      setYtResults(res.data || []);
    } catch {
      setYtErr("YouTube search failed. Check API key / restrictions.");
    } finally {
      setYtLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    loadResources();
    // eslint-disable-next-line
  }, [subjectId, topicSearch]);

  const filtered = useMemo(() => {
    return resources.filter((r) => r.resource_type === tab);
  }, [resources, tab]);

  const addResource = async () => {
    setMsg("");
    if (!subjectId) return setMsg("Select a subject");
    if (!topic.trim()) return setMsg("Enter topic");
    if (!title.trim()) return setMsg("Enter title");

    if (type === "youtube" && !url.trim()) return setMsg("Paste YouTube link");
    if (type === "note" && !content.trim()) return setMsg("Write notes content");

    await api.post("/api/resources", {
      subject_id: Number(subjectId),
      topic,
      resource_type: type,
      title,
      url: type === "youtube" ? url : null,
      content: type === "note" ? content : null,
      difficulty,
    });

    setTopic("");
    setTitle("");
    setUrl("");
    setContent("");
    setDifficulty("basic");
    setMsg("Saved");
    loadResources();
  };

  const remove = async (id) => {
    await api.delete(`/api/resources/${id}`);
    loadResources();
  };

  return (
    <Layout>
      <div className="page learningPage">
        <div className="pageHeader">
          <h1 className="pageTitle">Learning Concepts</h1>
          <p className="pageSubtitle">
            Add videos + notes for each subject/topic and learn faster.
          </p>
        </div>

        {msg && (
          <div
            className={`alert ${
              msg.startsWith("Saved") ? "alertSuccess" : "alertError"
            }`}
          >
            {msg}
          </div>
        )}

        {/* Filters */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="formRow">
            <select
              className="selectInput"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              className="textInput"
              placeholder="Search topic (eg: Loops)"
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
            />

            <button className="btnPrimary" onClick={loadResources}>
              Refresh
            </button>

            {/* ✅ NEW */}
            <button className="btnSecondary" onClick={searchYoutube}>
              Search Videos
            </button>
          </div>
        </div>

        {/* ✅ NEW: Auto YouTube Results */}
        {ytErr && (
          <div className="alert alertError" style={{ marginBottom: 12 }}>
            {ytErr}
          </div>
        )}

        {ytLoading && (
          <div className="emptyState" style={{ marginBottom: 16 }}>
            Searching YouTube…
          </div>
        )}

        {ytResults.length > 0 && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 className="pageTitle" style={{ fontSize: 18, margin: 0 }}>
                Auto YouTube Videos
              </h3>
              <span className="countText">{ytResults.length} result(s)</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
                marginTop: 12,
              }}
            >
              {ytResults.map((v) => (
                <div key={v.videoId} className="panel" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{v.title}</div>
                  <div
                    className="pageSubtitle"
                    style={{ margin: "6px 0 10px" }}
                  >
                    {v.channelTitle}
                  </div>

                  <iframe
                    width="100%"
                    height="240"
                    src={v.embedUrl}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ border: 0, borderRadius: 12 }}
                  />

                  {/* ✅ Always give fallback link */}
                  <div style={{ marginTop: 10 }}>
                    <a
                      href={v.watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--text)" }}
                    >
                      Open on YouTube →
                    </a>
                  </div>

                  {/* ✅ Optional: one click save to your DB */}
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <button
                      className="btnPrimary"
                      onClick={async () => {
                        try {
                          setMsg("");
                          if (!subjectId) return setMsg("Select a subject first");
                          const saveTopic = (topicSearch || "").trim() || "general";
                          await api.post("/api/resources", {
                            subject_id: Number(subjectId),
                            topic: saveTopic,
                            resource_type: "youtube",
                            title: v.title,
                            url: v.watchUrl,
                            content: null,
                            difficulty: "basic",
                          });
                          setMsg("Saved");
                          loadResources();
                        } catch {
                          setMsg("Save failed");
                        }
                      }}
                    >
                      Save to Resources
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Resource */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 className="pageTitle" style={{ fontSize: 18, marginTop: 0 }}>
            Add Resource
          </h3>

          <div className="formRow">
            <input
              className="textInput"
              placeholder="Topic (eg: Loops)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />

            <select
              className="selectInput"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="youtube">YouTube Video</option>
              <option value="note">Note</option>
            </select>

            <select
              className="selectInput"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="basic">basic</option>
              <option value="medium">medium</option>
              <option value="advanced">advanced</option>
            </select>
          </div>

          <div className="formRow">
            <input
              className="textInput"
              placeholder="Title (eg: Loops Explained)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {type === "youtube" ? (
              <input
                className="textInput"
                placeholder="Paste YouTube link (watch or youtu.be)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            ) : (
              <input
                className="textInput"
                placeholder="Short note summary (optional)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}

            <button className="btnPrimary" onClick={addResource}>
              Save
            </button>
          </div>

          {type === "note" && (
            <div style={{ marginTop: 10 }}>
              <textarea
                className="textInput"
                style={{ width: "100%", minHeight: 120 }}
                placeholder="Write full notes here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="filterRow">
          <h3 className="pageTitle" style={{ fontSize: 18, margin: 0 }}>
            Resources
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={tab === "youtube" ? "btnPrimary" : "btnSecondary"}
              onClick={() => setTab("youtube")}
            >
              Videos
            </button>
            <button
              className={tab === "note" ? "btnPrimary" : "btnSecondary"}
              onClick={() => setTab("note")}
            >
              Notes
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="emptyState">
            No {tab === "youtube" ? "videos" : "notes"} found.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((r) => (
              <div key={r.id} className="panel">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.title}</div>
                    <div className="pageSubtitle" style={{ margin: 0 }}>
                      {r.subject_name} • {r.topic} • {r.difficulty}
                    </div>
                  </div>
                  <button className="btnDangerAlt" onClick={() => remove(r.id)}>
                    Delete
                  </button>
                </div>

                {r.resource_type === "youtube" ? (
                  <div style={{ marginTop: 12 }}>
                    <iframe
                      width="100%"
                      height="260"
                      src={r.embed_url}
                      title={r.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ border: 0, borderRadius: 12 }}
                    />
                  </div>
                ) : (
                  <div style={{ marginTop: 12, whiteSpace: "pre-wrap", opacity: 0.9 }}>
                    {r.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
