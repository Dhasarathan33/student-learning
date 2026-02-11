import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/dashboard/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Subjects in recovery
    const [[subCountRow]] = await pool.query(
      "SELECT COUNT(*) AS subjectsInRecovery FROM subjects WHERE user_id = ? AND status = 'recovery'",
      [userId]
    );

    // 2) Today's tasks
    const [[todayTasksRow]] = await pool.query(
      "SELECT COUNT(*) AS todayTasks FROM tasks WHERE user_id = ? AND task_date = CURDATE()",
      [userId]
    );

    // 3) Progress %
    const [[progressRow]] = await pool.query(
      `SELECT
         COUNT(*) AS totalTasks,
         SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS doneTasks
       FROM tasks
       WHERE user_id = ?`,
      [userId]
    );

    const total = progressRow.totalTasks || 0;
    const done = progressRow.doneTasks || 0;
    const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

    // 4) Last activity (last created task or last updated task)
    // Simple: show latest task created
    const [lastRows] = await pool.query(
      `SELECT title, created_at
       FROM tasks
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const lastActivity =
      lastRows.length === 0
        ? null
        : { text: `Created task: ${lastRows[0].title}`, at: lastRows[0].created_at };

    res.json({
      subjectsInRecovery: subCountRow.subjectsInRecovery,
      todayTasks: todayTasksRow.todayTasks,
      progressPercent,
      lastActivity
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
