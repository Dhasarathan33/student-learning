import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  ensureWorkflowSchema,
  generatePlansAndTasksFromWeak,
  reconcileActivePlansWithCurrentGaps,
} from "../services/workflowService.js";

const router = express.Router();

// CREATE plan
router.post("/", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const { subject_id, topic, target_date, daily_minutes, priority } = req.body;

    if (!subject_id) return res.status(400).json({ message: "subject_id required" });
    if (!topic?.trim()) return res.status(400).json({ message: "topic required" });
    if (!target_date) return res.status(400).json({ message: "target_date required" });

    const minutes = Number(daily_minutes || 30);
    const allowed = ["High", "Medium", "Low"];
    const pr = allowed.includes(priority) ? priority : "Medium";

    const [result] = await pool.query(
      `INSERT INTO recovery_plans (user_id, subject_id, topic, target_date, daily_minutes, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, subject_id, topic.trim(), target_date, minutes, pr]
    );

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      subject_id,
      topic: topic.trim(),
      target_date,
      daily_minutes: minutes,
      priority: pr,
      status: "Active",
    });
  } catch (err) {
    console.error("RECOVERY PLAN CREATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Generate plan from gaps + auto create tasks
router.post("/generate", requireAuth, async (req, res) => {
  try {
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
    console.error("RECOVERY PLAN GENERATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LIST plans
router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    await reconcileActivePlansWithCurrentGaps(userId);

    const [rows] = await pool.query(
      `SELECT p.*, s.name AS subject_name,
              COALESCE(pt.topics, '') AS topics_csv
       FROM recovery_plans p
       JOIN subjects s ON s.id = p.subject_id
       LEFT JOIN (
         SELECT plan_id, GROUP_CONCAT(topic ORDER BY
           CASE WHEN LOWER(level)='weak' THEN 1 WHEN LOWER(level)='average' THEN 2 ELSE 3 END,
           score ASC, topic ASC SEPARATOR '||') AS topics
         FROM plan_topics
         GROUP BY plan_id
       ) pt ON pt.plan_id = p.id
       WHERE p.user_id = ?
         AND p.status = 'Active'
       ORDER BY p.id DESC`,
      [userId]
    );

    res.json(
      rows.map((r) => ({
        ...r,
        topics: String(r.topics_csv || "")
          .split("||")
          .map((x) => x.trim())
          .filter(Boolean),
      }))
    );
  } catch (err) {
    console.error("RECOVERY PLAN LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// TOGGLE status Active/Completed
router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["Active", "Completed"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [result] = await pool.query(
      "UPDATE recovery_plans SET status = ? WHERE id = ? AND user_id = ?",
      [status, id, userId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });

    res.json({ message: "Updated", status });
  } catch (err) {
    console.error("RECOVERY PLAN STATUS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE plan
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM recovery_plans WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("RECOVERY PLAN DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
