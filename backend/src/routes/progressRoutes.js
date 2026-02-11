import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/progress/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // total/completed/pending
    const [rows] = await pool.query(
      `
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN is_done = 0 THEN 1 ELSE 0 END) AS pending
      FROM tasks
      WHERE user_id = ?
      `,
      [userId]
    );

    const total = Number(rows[0]?.total || 0);
    const completed = Number(rows[0]?.completed || 0);
    const pending = Number(rows[0]?.pending || 0);
    const overallPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // subject-wise progress
    const [subjectRows] = await pool.query(
      `
      SELECT 
        s.id AS subject_id,
        s.name AS subject_name,
        COUNT(t.id) AS total,
        SUM(CASE WHEN t.is_done = 1 THEN 1 ELSE 0 END) AS completed
      FROM subjects s
      LEFT JOIN tasks t 
        ON t.subject_id = s.id AND t.user_id = s.user_id
      WHERE s.user_id = ?
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
      `,
      [userId]
    );

    const bySubject = subjectRows.map((r) => {
      const t = Number(r.total || 0);
      const c = Number(r.completed || 0);
      return {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        total: t,
        completed: c,
        percent: t === 0 ? 0 : Math.round((c / t) * 100),
      };
    });

    res.json({
      total,
      completed,
      pending,
      overallPercent,
      bySubject,
    });
  } catch (err) {
    console.error("PROGRESS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
