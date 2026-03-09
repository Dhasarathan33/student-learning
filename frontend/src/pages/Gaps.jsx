import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./gaps.css";

export default function Gaps() {
  const location = useLocation();
  const nav = useNavigate();

  const [gaps, setGaps] = useState([]);
  const [msg, setMsg] = useState("");
  const [confirmDeleteGapId, setConfirmDeleteGapId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      const gapsRes = await api.get("/api/gaps");
      setGaps(gapsRes.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to load gaps");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const incoming = location.state?.flashMsg;
    if (!incoming) return;
    setMsg(incoming);
    nav(location.pathname, { replace: true, state: {} });
  }, [location, nav]);

  const levelToScore = (level) => {
    const l = String(level || "").toLowerCase();
    if (l.includes("weak")) return 25;
    if (l.includes("avg") || l.includes("average")) return 55;
    if (l.includes("good")) return 85;
    return 0;
  };

  const relevantGaps = useMemo(() => {
    return (gaps || []).filter((g) => {
      const l = String(g?.level || "").toLowerCase();
      return l.includes("weak") || l.includes("avg") || l.includes("average");
    });
  }, [gaps]);

  const removeGap = async (id) => {
    try {
      setDeletingId(id);
      await api.delete(`/api/gaps/${id}`);
      setMsg("Deleted successfully");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to delete gap");
    } finally {
      setDeletingId(null);
    }
  };

  const requestDeleteGap = (id) => setConfirmDeleteGapId(id);
  const cancelDeleteGap = () => setConfirmDeleteGapId(null);
  const confirmDeleteGap = async () => {
    if (!confirmDeleteGapId) return;
    await removeGap(confirmDeleteGapId);
    setConfirmDeleteGapId(null);
  };

  const radarData = useMemo(() => {
    const map = {};
    relevantGaps.forEach((g) => {
      const name = g.subject_name || "No subject";
      const val = typeof g.score === "number" ? g.score : levelToScore(g.level);
      if (!map[name]) map[name] = { sum: 0, count: 0 };
      map[name].sum += Number(val || 0);
      map[name].count += 1;
    });

    return Object.entries(map).map(([name, v]) => ({
      name,
      avg: v.count ? Math.round(v.sum / v.count) : 0,
    }));
  }, [relevantGaps]);

  const heatmapList = useMemo(() => {
    const arr = relevantGaps.map((g) => {
      const val = typeof g.score === "number" ? g.score : levelToScore(g.level || "Weak");
      return {
        id: g.id,
        subject: g.subject_name || "No subject",
        topic: g.topic || "",
        level: g.level || "Weak",
        score: Number(val || 0),
      };
    });

    arr.sort((a, b) => a.score - b.score);
    return arr.slice(0, 6);
  }, [relevantGaps]);

  return (
    <Layout>
      <div className="gpPage">
        <div className="gpHeader">
          <h1 className="gpTitle">Gaps Diagnostic</h1>
          <p className="gpSubtitle">Weak/Average topics are automatically detected from assessments.</p>
        </div>

        {msg && <div style={{ marginBottom: 12, color: "rgba(255,255,255,.85)" }}>{msg}</div>}

        <div className="gpGrid2">
          <div className="gpPanel">
            <div style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>Radar Chart</div>
            <div className="gpSmall">Average score for Weak/Average topics</div>

            <div className="gpRadarWrap">
              {radarData.length === 0 ? (
                <div className="gpSmall">No Weak/Average gaps yet.</div>
              ) : (
                radarData.map((r) => (
                  <div key={r.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ color: "#fff", fontWeight: 900 }}>{r.name}</div>
                      <div style={{ color: "rgba(255,255,255,.8)", fontWeight: 900 }}>{r.avg}</div>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(255,255,255,.10)",
                        overflow: "hidden",
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${r.avg}%`,
                          background: "linear-gradient(90deg,#ef4444,#f59e0b)",
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="gpPanel">
            <div style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>Heatmap</div>
            <div className="gpSmall">Weak/Average topics (sorted by weakness)</div>

            <div className="gpHeatGrid">
              {heatmapList.length === 0 ? (
                <div className="gpSmall">No Weak/Average topics yet.</div>
              ) : (
                heatmapList.map((x) => {
                  const cls = x.score < 40 ? "gpBadge gpWeak" : "gpBadge gpAvg";
                  const pri = x.score < 40 ? "High" : "Medium";
                  return (
                    <div key={x.id} className="gpHeatItem">
                      <div className="gpHeatTop">
                        <div style={{ color: "#fff", fontWeight: 900 }}>{x.subject}</div>
                        <div style={{ color: "rgba(255,255,255,.75)", fontWeight: 900 }}>{x.score}</div>
                      </div>
                      <div style={{ color: "rgba(255,255,255,.8)", fontWeight: 800 }}>{x.topic}</div>
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className={cls}>{String(x.level).toLowerCase()}</span>
                        <span className="gpSmall">{pri}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="gpPanel" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900, color: "#fff", fontSize: 18 }}>Saved Diagnostic Entries</div>
              <div className="gpSmall">Weak/Average entries from assessment</div>
            </div>
            <button className="gpBtn" onClick={load}>Refresh</button>
          </div>

          <div className="gpList">
            {relevantGaps.map((g) => {
              const sName = g.subject_name || "No subject";
              const lvl = g.level || "Weak";
              const sc = typeof g.score === "number" ? g.score : levelToScore(lvl);
              const cls = sc < 40 ? "gpBadge gpWeak" : "gpBadge gpAvg";

              return (
                <div key={g.id} className="gpRow">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#fff", fontWeight: 900 }}>{sName} - {g.topic}</div>
                    <div className="gpSmall">Score: {sc} - Priority: {sc < 40 ? "High" : "Medium"}</div>
                  </div>

                  <span className={cls}>{String(lvl).toLowerCase()}</span>

                  <button className="gpBtn gpBtnDanger" onClick={() => requestDeleteGap(g.id)} disabled={deletingId === g.id}>
                    {deletingId === g.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              );
            })}

            {relevantGaps.length === 0 && (
              <div className="gpSmall" style={{ marginTop: 10 }}>
                No Weak/Average gaps yet. Take assessment first.
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmDeleteGapId && (
        <div className="gpModalBackdrop">
          <div className="gpModal">
            <div className="gpModalTitle">Delete this gap?</div>
            <div className="gpModalSub">This action cannot be undone.</div>
            <div className="gpModalActions">
              <button className="gpBtn" onClick={cancelDeleteGap}>Cancel</button>
              <button className="gpBtn gpBtnDanger" onClick={confirmDeleteGap}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
