import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureWorkflowSchema, getGapTableName, hasTableColumn } from "../services/workflowService.js";

const RECOVERY_FLOW_TEXT =
  "Assessment Taken -> Weak Topics Detected -> System Creates Tasks -> Student Studies / Practices -> System Marks Task Completed -> Progress Updated";


const router = express.Router();

router.get("/summary", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const gapTable = await getGapTableName();
    const hasScore = await hasTableColumn(gapTable, "score");
    const avgScoreExpr = hasScore
      ? "AVG(IFNULL(score,0))"
      : `AVG(CASE
          WHEN LOWER(level) = 'weak' THEN 25
          WHEN LOWER(level) = 'average' THEN 55
          WHEN LOWER(level) = 'good' THEN 85
          ELSE 0
        END)`;
    const weakScoreExpr = hasScore
      ? "IFNULL(score, 0)"
      : `CASE
          WHEN LOWER(level) = 'weak' THEN 25
          WHEN LOWER(level) = 'average' THEN 55
          WHEN LOWER(level) = 'good' THEN 85
          ELSE 0
        END`;

    const [subjectsRows] = await pool.query("SELECT COUNT(*) AS count FROM subjects WHERE user_id = ?", [userId]);
    const [todayRows] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE user_id = ? AND task_date = CURDATE()", [userId]);
    const [taskRows] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS completed
       FROM tasks WHERE user_id = ?`,
      [userId]
    );
    const [gapRows] = await pool.query(
      `SELECT level, COUNT(*) AS count, ${avgScoreExpr} AS avg_score
       FROM ${gapTable}
       WHERE user_id = ?
       GROUP BY level`,
      [userId]
    );
    const [attemptRows] = await pool.query(
      "SELECT MAX(created_at) AS last_assessed_at FROM assessment_attempts WHERE user_id = ?",
      [userId]
    );
    const [activePlanRows] = await pool.query(
      "SELECT COUNT(*) AS active_plans FROM recovery_plans WHERE user_id = ? AND status = 'Active'",
      [userId]
    );
    const [pendingTaskRows] = await pool.query(
      "SELECT id, title, subject_id, topic FROM tasks WHERE user_id = ? AND is_done = 0 ORDER BY due_date ASC, id ASC LIMIT 1",
      [userId]
    );
    const [weakTopicRows] = await pool.query(
      `SELECT subject_id, topic, ${weakScoreExpr} AS score
       FROM ${gapTable}
       WHERE user_id = ? AND LOWER(level) = 'weak'
       ORDER BY score ASC, updated_at DESC
       LIMIT 1`,
      [userId]
    );

    const subjectsCountRow = subjectsRows[0] || {};
    const todayTasksRow = todayRows[0] || {};
    const taskStatsRow = taskRows[0] || {};

    const totalTasks = Number(taskStatsRow?.total || 0);
    const completedTasks = Number(taskStatsRow?.completed || 0);
    const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const gapDistribution = { Weak: 0, Average: 0, Good: 0 };
    let avgGapScore = 0;
    let gapCount = 0;
    gapRows.forEach((g) => {
      const lv = String(g.level || "").toLowerCase();
      if (lv === "weak") gapDistribution.Weak = Number(g.count || 0);
      else if (lv === "average") gapDistribution.Average = Number(g.count || 0);
      else gapDistribution.Good = Number(g.count || 0);
      avgGapScore += Number(g.avg_score || 0) * Number(g.count || 0);
      gapCount += Number(g.count || 0);
    });
    avgGapScore = gapCount ? Math.round(avgGapScore / gapCount) : 0;
    const performanceScore = Math.max(0, Math.min(100, Math.round(overallProgress * 0.6 + avgGapScore * 0.4)));

    const [weeklyRows] = await pool.query(
      `SELECT DATE(updated_at) AS day, COUNT(*) AS done_count
       FROM tasks
       WHERE user_id = ? AND is_done = 1 AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(updated_at)
       ORDER BY day ASC`,
      [userId]
    );
    const doneMap = {};
    weeklyRows.forEach((r) => {
      const key = String(r.day).slice(0, 10);
      doneMap[key] = Number(r.done_count || 0);
    });
    const completionTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      completionTrend.push({ date: key, done: doneMap[key] || 0 });
    }
    const weeklyDoneTotal = completionTrend.reduce((s, x) => s + x.done, 0);
    const weeklyAchievementBadge =
      weeklyDoneTotal >= 20 ? "Gold Achiever" : weeklyDoneTotal >= 10 ? "Silver Streak" : weeklyDoneTotal >= 5 ? "Bronze Starter" : "Getting Started";

    const weakest = weakTopicRows[0] || null;
    const nextTask = pendingTaskRows[0] || null;
    const nextBestAction = weakest
      ? `Focus weakest topic: ${weakest.topic} (score ${weakest.score || 0})`
      : nextTask
      ? `Complete pending task: ${nextTask.title}`
      : "Take a new assessment to refresh your plan.";

    const lastAssessedAt = attemptRows[0]?.last_assessed_at || null;
    let shouldReassess = false;
    let reassessReason = "No recent assessment";
    if (lastAssessedAt) {
      const days = Math.floor((Date.now() - new Date(lastAssessedAt).getTime()) / (1000 * 60 * 60 * 24));
      shouldReassess = days >= 7 || Number(activePlanRows[0]?.active_plans || 0) === 0 || gapDistribution.Weak === 0;
      reassessReason =
        days >= 7
          ? "7 days passed since last assessment"
          : Number(activePlanRows[0]?.active_plans || 0) === 0
          ? "No active recovery plan"
          : gapDistribution.Weak === 0
          ? "Weak topics reduced"
          : "Continue current plan";
    } else {
      shouldReassess = true;
    }

    if (shouldReassess) {
      const [exists] = await pool.query(
        `SELECT id
         FROM assessment_reminders
         WHERE user_id = ?
           AND reminder_date = CURDATE()
           AND reason = ?
           AND LOWER(status) = 'pending'
         LIMIT 1`,
        [userId, reassessReason]
      );
      if (!exists.length) {
        await pool.query(
          `INSERT INTO assessment_reminders (user_id, reminder_date, reason, status)
           VALUES (?, CURDATE(), ?, 'Pending')`,
          [userId, reassessReason]
        ).catch(() => {});
      }
    }

    res.json({
      totalSubjects: Number(subjectsCountRow?.count || 0),
      todayTasks: Number(todayTasksRow?.count || 0),
      completionTrend,
      overallProgress,
      gapDistribution,
      performanceScore,
      weeklyAchievementBadge,
      nextBestAction,
      reassessment: {
        show_cta: shouldReassess,
        reason: reassessReason,
        last_assessed_at: lastAssessedAt,
      },
      flow: RECOVERY_FLOW_TEXT,
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
