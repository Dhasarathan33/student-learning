import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/gaps
 * List all gaps for logged-in user (with subject name)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT g.id, g.subject_id, s.name AS subject_name, g.topic, g.level, g.updated_at
       FROM learning_gaps g
       JOIN subjects s ON s.id = g.subject_id
       WHERE g.user_id = ?
       ORDER BY g.updated_at DESC`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("GAPS LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/gaps
 * Upsert (insert or update) gap rating
 * body: { subject_id, topic, level }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject_id, topic, level } = req.body;

    if (!subject_id) return res.status(400).json({ message: "subject_id is required" });
    if (!topic?.trim()) return res.status(400).json({ message: "topic is required" });

    const allowed = ["Weak", "Average", "Good"];
    const safeLevel = allowed.includes(level) ? level : "Average";

    // Upsert using UNIQUE(user_id, subject_id, topic)
    await pool.query(
      `INSERT INTO learning_gaps (user_id, subject_id, topic, level)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE level = VALUES(level)`,
      [userId, subject_id, topic.trim(), safeLevel]
    );

    res.status(201).json({ message: "Saved", subject_id, topic: topic.trim(), level: safeLevel });
  } catch (err) {
    console.error("GAPS SAVE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * DELETE /api/gaps/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM learning_gaps WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("GAPS DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
