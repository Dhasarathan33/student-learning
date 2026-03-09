import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  ensureWorkflowSchema,
  generatePlansAndTasksFromWeak,
  getGapTableName,
  hasTableColumn,
} from "../services/workflowService.js";

const router = express.Router();

/*
GET /api/gaps
Shows weak topics detected from assessment
*/
router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
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

    const [rows] = await pool.query(
      `SELECT g.id,
              g.subject_id,
              s.name AS subject_name,
              g.topic,
              g.level,
              ${scoreExpr} AS score,
              g.updated_at
       FROM ${gapTable} g
       LEFT JOIN subjects s ON s.id = g.subject_id
       WHERE g.user_id = ?
       ORDER BY g.updated_at DESC`,
      [userId]
    );

    res.json(rows);

  } catch (err) {
    console.error("GAPS FETCH ERROR:", err);
    res.status(500).json({ message: "Failed to load gaps" });
  }
});

/*
GET /api/gaps/summary
Used for charts
*/
router.get("/summary", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const gapTable = await getGapTableName();

    const [[stats]] = await pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(LOWER(level)='weak') AS weakCount,
        SUM(LOWER(level)='average') AS averageCount,
        SUM(LOWER(level)='good') AS goodCount
       FROM ${gapTable}
       WHERE user_id = ?`,
      [userId]
    );

    res.json(stats);

  } catch (err) {
    console.error("GAP SUMMARY ERROR:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
});

/*
POST /api/gaps/generate-recovery-plan
Create/update recovery plans from weak topics and generate tasks.
*/
router.post("/generate-recovery-plan", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;

    const out = await generatePlansAndTasksFromWeak(userId);

    res.json({
      message: out.message,
      plans: out.plans,
      tasks_created: out.tasks_created,
      tasks_reused: out.tasks_reused,
      next_step: "Go to Tasks and start with Pending items.",
    });
  } catch (err) {
    console.error("GAP PLAN GENERATE ERROR:", err);
    res.status(500).json({ message: "Failed to generate recovery plan", error: err.message });
  }
});

/*
DELETE /api/gaps/:id
Delete one saved gap row for current user.
*/
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid gap id" });
    }

    const gapTable = await getGapTableName();
    const [result] = await pool.query(
      `DELETE FROM ${gapTable} WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Gap not found" });
    }

    res.json({ message: "Gap deleted" });
  } catch (err) {
    console.error("GAP DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete gap", error: err.message });
  }
});

export default router;
