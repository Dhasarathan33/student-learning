import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  badRequest,
  ensureNonEmpty,
  validateEmail,
  validatePassword,
} from "../middleware/validation.js";

const router = express.Router();
let settingsSchemaEnsured = false;

async function ensureUserSettingsSchema() {
  if (settingsSchemaEnsured) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_settings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      daily_study_minutes INT NOT NULL DEFAULT 60,
      difficulty_mode VARCHAR(20) NOT NULL DEFAULT 'Medium',
      email_reminders TINYINT(1) NOT NULL DEFAULT 1,
      study_reminders TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_settings_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  settingsSchemaEnsured = true;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const name = ensureNonEmpty(req.body?.name, "name");
    const email = ensureNonEmpty(req.body?.email, "email").toLowerCase();
    const password = ensureNonEmpty(req.body?.password, "password");
    if (!validateEmail(email)) badRequest("Valid email is required");
    if (!validatePassword(password)) badRequest("Password must be at least 6 characters");

    // check email exists
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(409).json({ message: "Email already registered" });

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, password_hash]
    );

    const user = { id: result.insertId, email };
    const token = signToken(user);

    res.status(201).json({
      message: "Signup successful",
      token,
      user: { id: user.id, name, email }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = ensureNonEmpty(req.body?.email, "email").toLowerCase();
    const password = ensureNonEmpty(req.body?.password, "password");
    if (!validateEmail(email)) badRequest("Valid email is required");

    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// GET /api/auth/settings
router.get("/settings", requireAuth, async (req, res) => {
  try {
    await ensureUserSettingsSchema();
    const userId = req.user.id;

    const [uRows] = await pool.query(
      "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!uRows.length) return res.status(404).json({ message: "User not found" });

    const [sRows] = await pool.query(
      `SELECT daily_study_minutes, difficulty_mode, email_reminders, study_reminders
       FROM user_settings WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const settings = sRows[0] || {
      daily_study_minutes: 60,
      difficulty_mode: "Medium",
      email_reminders: 1,
      study_reminders: 1,
    };

    res.json({
      account: {
        name: uRows[0].name,
        email: uRows[0].email,
      },
      learning: {
        daily_study_minutes: Number(settings.daily_study_minutes || 60),
        difficulty_mode: String(settings.difficulty_mode || "Medium"),
      },
      notifications: {
        email_reminders: Boolean(settings.email_reminders),
        study_reminders: Boolean(settings.study_reminders),
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// PUT /api/auth/settings/account
router.put("/settings/account", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const name = ensureNonEmpty(req.body?.name, "name");
    const email = ensureNonEmpty(req.body?.email, "email").toLowerCase();
    if (!validateEmail(email)) badRequest("Valid email is required");

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [email, userId]
    );
    if (existing.length) {
      return res.status(409).json({ message: "Email already in use" });
    }

    await pool.query("UPDATE users SET name = ?, email = ? WHERE id = ?", [name, email, userId]);

    res.json({ message: "Account updated", user: { id: userId, name, email } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// PUT /api/auth/settings/password
router.put("/settings/password", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentPassword = ensureNonEmpty(req.body?.current_password, "current_password");
    const newPassword = ensureNonEmpty(req.body?.new_password, "new_password");

    if (!validatePassword(newPassword)) badRequest("Password must be at least 6 characters");

    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, userId]);

    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// PUT /api/auth/settings/preferences
router.put("/settings/preferences", requireAuth, async (req, res) => {
  try {
    await ensureUserSettingsSchema();
    const userId = req.user.id;

    const minutesRaw = Number(req.body?.daily_study_minutes);
    const dailyStudyMinutes = Number.isFinite(minutesRaw)
      ? Math.max(15, Math.min(480, Math.round(minutesRaw)))
      : 60;

    const difficultyRaw = String(req.body?.difficulty_mode || "Medium").trim();
    const allowed = ["Easy", "Medium", "Hard"];
    const difficultyMode = allowed.includes(difficultyRaw) ? difficultyRaw : "Medium";

    const emailReminders = req.body?.email_reminders ? 1 : 0;
    const studyReminders = req.body?.study_reminders ? 1 : 0;

    await pool.query(
      `INSERT INTO user_settings
       (user_id, daily_study_minutes, difficulty_mode, email_reminders, study_reminders)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         daily_study_minutes = VALUES(daily_study_minutes),
         difficulty_mode = VALUES(difficulty_mode),
         email_reminders = VALUES(email_reminders),
         study_reminders = VALUES(study_reminders)`,
      [userId, dailyStudyMinutes, difficultyMode, emailReminders, studyReminders]
    );

    res.json({
      message: "Preferences updated",
      learning: {
        daily_study_minutes: dailyStudyMinutes,
        difficulty_mode: difficultyMode,
      },
      notifications: {
        email_reminders: Boolean(emailReminders),
        study_reminders: Boolean(studyReminders),
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

export default router;
