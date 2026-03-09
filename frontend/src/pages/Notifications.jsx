import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./notifications.css";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/notifications");
      setItems(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, unread: false, status: "Done" } : x)));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to mark reminder as read");
    }
  };

  const unreadCount = useMemo(() => items.filter((x) => x.unread).length, [items]);
  const shown = useMemo(
    () => (tab === "unread" ? items.filter((x) => x.unread) : items),
    [items, tab]
  );

  return (
    <Layout>
      <div className="ntPage">
        <div className="ntHeader">
          <h1 className="ntTitle">Notifications & Reminders</h1>
          <div className="ntChips">
            <button className={`ntChip ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
              All ({items.length})
            </button>
            <button className={`ntChip ${tab === "unread" ? "active" : ""}`} onClick={() => setTab("unread")}>
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {error && <div className="ntAlert">{error}</div>}

        {loading ? (
          <div className="ntEmpty">Loading notifications...</div>
        ) : shown.length === 0 ? (
          <div className="ntEmpty">No notifications.</div>
        ) : (
          <div className="ntList">
            {shown.map((n) => (
              <div key={n.id} className={`ntItem ${n.unread ? "unread" : ""}`}>
                <div className="ntItemTop">
                  <div className="ntItemTitle">{n.title}</div>
                  <span className={`ntStatus ${String(n.status || "").toLowerCase() === "done" ? "done" : ""}`}>
                    {n.status}
                  </span>
                </div>
                <div className="ntMsg">{n.message}</div>
                <div className="ntMeta">
                  <span>{n.source === "task" ? "Task Reminder" : "Assessment Reminder"}</span>
                  <span>{String(n.date || "").slice(0, 10)}</span>
                </div>
                {n.unread && n.source === "assessment" && (
                  <button className="ntBtn" onClick={() => markRead(n.id)}>
                    Mark as read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
