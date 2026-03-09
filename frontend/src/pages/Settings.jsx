import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Layout from "../components/Layout";
import "./settings.css";

export default function Settings() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(60);
  const [difficultyMode, setDifficultyMode] = useState("Medium");
  const [emailReminders, setEmailReminders] = useState(true);
  const [studyReminders, setStudyReminders] = useState(true);

  const loadSettings = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/auth/settings");
      const data = res.data || {};
      setName(data.account?.name || "");
      setEmail(data.account?.email || "");
      setDailyStudyMinutes(Number(data.learning?.daily_study_minutes || 60));
      setDifficultyMode(data.learning?.difficulty_mode || "Medium");
      setEmailReminders(Boolean(data.notifications?.email_reminders));
      setStudyReminders(Boolean(data.notifications?.study_reminders));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveAccount = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await api.put("/api/auth/settings/account", { name, email });
      const user = res.data?.user;
      if (user) localStorage.setItem("user", JSON.stringify(user));
      setMsg("Account updated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await api.put("/api/auth/settings/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password updated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await api.put("/api/auth/settings/preferences", {
        daily_study_minutes: Number(dailyStudyMinutes),
        difficulty_mode: difficultyMode,
        email_reminders: emailReminders,
        study_reminders: studyReminders,
      });
      setMsg("Preferences updated");
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to update preferences");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    nav("/login");
  };

  return (
    <Layout>
      <div className="stPage">
        <div className="stHeader">
          <h1 className="stTitle">Settings</h1>
          <p className="stSubtitle">Manage your account, learning preferences, and reminders.</p>
        </div>

        {msg && <div className="stAlert stOk">{msg}</div>}
        {err && <div className="stAlert stErr">{err}</div>}

        <div className="stGrid">
          <div className="stMain">
            <section className="stPanel">
              <h2>Account</h2>
              <div className="stRow">
                <label>Name</label>
                <input className="stInput" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="stRow">
                <label>Email</label>
                <input className="stInput" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="stBtn" onClick={saveAccount} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Account"}
              </button>
            </section>

            <section className="stPanel">
              <h2>Change Password</h2>
              <div className="stRow">
                <label>Current Password</label>
                <input
                  type="password"
                  className="stInput"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="stRow">
                <label>New Password</label>
                <input
                  type="password"
                  className="stInput"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button className="stBtn" onClick={savePassword} disabled={saving || loading}>
                {saving ? "Saving..." : "Update Password"}
              </button>
            </section>

            <section className="stPanel">
              <h2>Learning</h2>
              <div className="stRow">
                <label>Daily Study Time (minutes)</label>
                <input
                  type="number"
                  min="15"
                  max="480"
                  className="stInput"
                  value={dailyStudyMinutes}
                  onChange={(e) => setDailyStudyMinutes(e.target.value)}
                />
              </div>
              <div className="stRow">
                <label>Difficulty Mode</label>
                <select className="stInput" value={difficultyMode} onChange={(e) => setDifficultyMode(e.target.value)}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <button className="stBtn" onClick={savePreferences} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Learning"}
              </button>
            </section>

            <section className="stPanel">
              <h2>Notifications</h2>
              <label className="stToggle">
                <input
                  type="checkbox"
                  checked={emailReminders}
                  onChange={(e) => setEmailReminders(e.target.checked)}
                />
                Email reminders
              </label>
              <label className="stToggle">
                <input
                  type="checkbox"
                  checked={studyReminders}
                  onChange={(e) => setStudyReminders(e.target.checked)}
                />
                Study reminders
              </label>
              <button className="stBtn" onClick={savePreferences} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Notifications"}
              </button>
            </section>
          </div>

          <aside className="stSide">
            <div className="stPanel stSticky">
              <h3>Session</h3>
              <p>Use this to securely sign out from your account.</p>
              <button className="stBtn stDanger" onClick={logout}>
                Logout
              </button>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
