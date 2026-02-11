import { NavLink, useNavigate } from "react-router-dom";

export default function Layout({ children }) {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    nav("/login");
  };

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="brand">Student Recovery</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotCyan" aria-hidden />
          Dashboard
        </NavLink>

        <NavLink
          to="/subjects"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotViolet" aria-hidden />
          Subjects
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotEmerald" aria-hidden />
          Tasks
        </NavLink>

        <NavLink
          to="/gaps"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotAmber" aria-hidden />
          Gaps
        </NavLink>

        <NavLink
          to="/recovery-plans"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotPink" aria-hidden />
          Recovery Plans
        </NavLink>

        {/* ✅ NEW: Progress Tracking */}
        <NavLink
          to="/progress"
          className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
        >
          <span className="navDot navDotBlue" aria-hidden />
          Progress
        </NavLink>

        <div style={{ marginTop: 18, color: "var(--muted)", fontSize: 13 }}>
          Logged in as
          <div
            style={{
              color: "var(--text)",
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            {user?.name}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div style={{ fontWeight: 800 }}>
            Student Learning Recovery Planner
          </div>
          <div className="row">
            <span style={{ color: "var(--muted)" }}>
              {user?.email}
            </span>
            <button className="btn btnDanger" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
