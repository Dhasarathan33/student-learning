import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import api from "../api/axios";

export default function Layout({ children }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "1");
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get("/api/notifications/summary");
        if (mounted) setUnreadCount(Number(res.data?.unread || 0));
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const userKey = user?.id ? String(user.id) : "default";
    const storageKey = `task_popup_seen_at_${userKey}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, new Date().toISOString());
    }

    const addToast = (text) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, text }].slice(-4));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };

    let mounted = true;
    const pollCreatedTasks = async () => {
      try {
        const since = localStorage.getItem(storageKey) || new Date().toISOString();
        const res = await api.get("/api/notifications/task-created", { params: { since } });
        const rows = res.data || [];
        if (!mounted || !rows.length) return;

        const newest = rows.reduce((max, r) => {
          const ts = new Date(r.created_at).getTime();
          const mx = new Date(max || 0).getTime();
          return ts > mx ? r.created_at : max;
        }, since);

        rows
          .slice(0, 3)
          .reverse()
          .forEach((r) => addToast(`Task created: ${r.title}${r.topic ? ` (${r.topic})` : ""}`));

        localStorage.setItem(storageKey, String(newest));
      } catch {
        // ignore polling errors
      }
    };

    const timer = setInterval(pollCreatedTasks, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user?.id]);

  return (
    <div className="container">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebarHeader">
          <div className="brand">{collapsed ? "SR" : "Student Recovery"}</div>
          <button
            className="collapseBtn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? ">>" : "<<"}
          </button>
        </div>

        <NavLink to="/dashboard" title="Dashboard" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotCyan">
            <svg viewBox="0 0 24 24">
              <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-8.5z" />
            </svg>
          </span>
          <span className="navText">Dashboard</span>
        </NavLink>

        <NavLink to="/subjects" title="Subjects" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotViolet">
            <svg viewBox="0 0 24 24">
              <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2V4zm2 2v12h9V6H7zm11 0h1a2 2 0 0 1 2 2v13h-3V6z" />
            </svg>
          </span>
          <span className="navText">Subjects</span>
        </NavLink>

        <NavLink to="/tasks" title="Tasks" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotEmerald">
            <svg viewBox="0 0 24 24">
              <path d="M4 5h16v14H4V5zm2 2v10h12V7H6zm2 4h4v2H8v-2z" />
            </svg>
          </span>
          <span className="navText">Tasks</span>
        </NavLink>

        <NavLink to="/gaps" title="Gaps" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotAmber">
            <svg viewBox="0 0 24 24">
              <path d="M12 4 2.6 20h18.8L12 4zm1 12h-2v-5h2v5zm0 3h-2v-2h2v2z" />
            </svg>
          </span>
          <span className="navText">Gaps</span>
        </NavLink>

        <NavLink to="/assessment" title="Assessment" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotOrange">
            <svg viewBox="0 0 24 24">
              <path d="M3 3h18v4H3V3zm0 6h18v12H3V9zm4 3h10v2H7v-2zm0 4h6v2H7v-2z" />
            </svg>
          </span>
          <span className="navText">Assessment</span>
        </NavLink>

        <NavLink to="/learning-concepts" title="Learning Concepts" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotTeal">
            <svg viewBox="0 0 24 24">
              <path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3z" />
            </svg>
          </span>
          <span className="navText">Learning Concepts</span>
        </NavLink>

        <NavLink to="/recovery-plans" title="Recovery Plans" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotPink">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a8 8 0 1 1-6.32 12.9L2 18.6l1.4 1.4 3.7-3.7A8 8 0 1 1 12 2z" />
            </svg>
          </span>
          <span className="navText">Recovery Plans</span>
        </NavLink>

        <NavLink to="/progress" title="Progress" className={({ isActive }) => "navItem" + (isActive ? " active" : "") }>
          <span className="navIcon navDotBlue">
            <svg viewBox="0 0 24 24">
              <path d="M4 19h16v2H2V4h2v15z" />
            </svg>
          </span>
          <span className="navText">Progress</span>
        </NavLink>

        <div className={`sidebarUser${collapsed ? " hidden" : ""}`}>
          Logged in as
          <div style={{ color: "var(--text)", fontWeight: 700, marginTop: 6 }}>
            {user?.name}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div style={{ fontWeight: 800 }}>Student Learning Recovery Planner</div>
          <div className="row">
            <span style={{ color: "var(--muted)" }}>{user?.email}</span>
            <NavLink to="/notifications" className="bellBtn" title="Notifications" style={{ textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" className="topIconSvg" aria-hidden="true">
                <path d="M12 2a6 6 0 0 0-6 6v3.6L4.2 14a1 1 0 0 0 .8 1.6h14a1 1 0 0 0 .8-1.6L18 11.6V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22z" />
              </svg>
              {unreadCount > 0 && <span className="bellBadge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </NavLink>
            <NavLink to="/settings" className="topIconBtn" title="Settings" style={{ textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" className="topIconSvg" aria-hidden="true">
                <path d="M19.14 12.94a7.48 7.48 0 0 0 .05-.94 7.48 7.48 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.12 7.12 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
              </svg>
            </NavLink>
          </div>
        </div>

        {toasts.length > 0 && (
          <div className="taskToastStack">
            {toasts.map((t) => (
              <div key={t.id} className="taskToast">
                {t.text}
              </div>
            ))}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
