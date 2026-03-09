import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureWorkflowSchema, getGapTableName, hasTableColumn, saveProgressSnapshot } from "../services/workflowService.js";

const RECOVERY_FLOW_TEXT =
  "Assessment Taken -> Weak Topics Detected -> System Creates Tasks -> Student Studies / Practices -> System Marks Task Completed -> Progress Updated";


const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    await saveProgressSnapshot(userId);
    const [[overallRows]] = await pool.query(
      `SELECT COUNT(*) AS total_tasks,
              SUM(CASE WHEN status = 'Done' OR is_done = 1 THEN 1 ELSE 0 END) AS completed_tasks
       FROM tasks
       WHERE user_id = ?`,
      [userId]
    );
    const totalTasks = Number(overallRows?.total_tasks || 0);
    const completedTasks = Number(overallRows?.completed_tasks || 0);
    const percent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const [subjectRows] = await pool.query(
      `SELECT s.name AS subject_name,
              COUNT(t.id) AS total_tasks,
              SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS completed_tasks
       FROM tasks t
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.user_id = ?
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [userId]
    );

    res.json({
      overall: {
        total: totalTasks,
        completed: completedTasks,
        percent,
      },
      bySubject: subjectRows.map((r) => ({
        subject_name: r.subject_name,
        total_tasks: Number(r.total_tasks || 0),
        completed_tasks: Number(r.completed_tasks || 0),
      })),
      flow: RECOVERY_FLOW_TEXT,
    });
  } catch (err) {
    console.error("PROGRESS ROOT ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    await saveProgressSnapshot(userId);
    const gapTable = await getGapTableName();
    const hasScore = await hasTableColumn(gapTable, "score");
    const scoreExpr = hasScore
      ? "IFNULL(g.score, 0)"
      : `CASE
          WHEN LOWER(g.level) = 'weak' THEN 25
          WHEN LOWER(g.level) = 'average' THEN 55
          WHEN LOWER(g.level) = 'good' THEN 85
          ELSE 0
        END`;

    const [taskRows] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS completed
       FROM tasks
       WHERE user_id = ?`,
      [userId]
    );
    const total = Number(taskRows[0]?.total || 0);
    const completed = Number(taskRows[0]?.completed || 0);
    const pending = Math.max(0, total - completed);
    const overallPercent = total ? Math.round((completed / total) * 100) : 0;

    const [subjectRows] = await pool.query(
      `SELECT s.id AS subject_id, s.name AS subject_name,
              COUNT(t.id) AS total,
              SUM(CASE WHEN t.is_done = 1 THEN 1 ELSE 0 END) AS completed,
              AVG(${scoreExpr}) AS gap_score
       FROM subjects s
       LEFT JOIN tasks t ON t.subject_id = s.id AND t.user_id = ?
       LEFT JOIN ${gapTable} g ON g.subject_id = s.id AND g.user_id = ?
       WHERE s.user_id = ?
       GROUP BY s.id, s.name
       ORDER BY s.name ASC`,
      [userId, userId, userId]
    );

    const [snapshotRows] = await pool.query(
      `SELECT subject_id, snapshot_date, avg_gap_score
       FROM progress_snapshots
       WHERE user_id = ?
       ORDER BY snapshot_date DESC`,
      [userId]
    );
    const prevScoreMap = {};
    snapshotRows.forEach((r) => {
      const sid = String(r.subject_id || "0");
      if (!prevScoreMap[sid]) prevScoreMap[sid] = [];
      prevScoreMap[sid].push(Number(r.avg_gap_score || 0));
    });

    const bySubject = subjectRows.map((r) => {
      const t = Number(r.total || 0);
      const c = Number(r.completed || 0);
      const pct = t ? Math.round((c / t) * 100) : 0;
      const currentGapScore = Math.round(Number(r.gap_score || 0));
      const history = prevScoreMap[String(r.subject_id)] || [];
      const previousGapScore = history.length > 1 ? history[1] : currentGapScore;
      return {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        total: t,
        completed: c,
        percent: pct,
        current_gap_score: currentGapScore,
        gap_score_change: currentGapScore - previousGapScore,
      };
    });

    res.json({
      total,
      completed,
      pending,
      overallPercent,
      bySubject,
      flow: RECOVERY_FLOW_TEXT,
    });
  } catch (err) {
    console.error("PROGRESS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
