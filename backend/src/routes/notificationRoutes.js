import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureWorkflowSchema } from "../services/workflowService.js";

const router = express.Router();

const toYmd = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dedupePendingAssessmentReminders = async (userId) => {
  const [rows] = await pool.query(
    `SELECT id, reminder_date, reason
     FROM assessment_reminders
     WHERE user_id = ?
       AND LOWER(status) = 'pending'
     ORDER BY id DESC`,
    [userId]
  );

  const idsToDone = [];
  for (let i = 0; i < rows.length; i++) {
    // Keep only the newest pending reminder; close the rest.
    if (i === 0) continue;
    idsToDone.push(Number(rows[i].id));
  }

  if (!idsToDone.length) return;
  await pool.query(
    `UPDATE assessment_reminders
     SET status = 'Done'
     WHERE user_id = ?
       AND id IN (${idsToDone.map(() => "?").join(",")})`,
    [userId, ...idsToDone]
  );
};

router.get("/", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    await dedupePendingAssessmentReminders(userId);

    const [remRows] = await pool.query(
      `SELECT id, reminder_date, reason, status, created_at
       FROM assessment_reminders
       WHERE user_id = ?
         AND LOWER(status) <> 'done'
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    const [taskRows] = await pool.query(
      `SELECT id, title, topic, due_date, status, is_done, created_at
       FROM tasks
       WHERE user_id = ?
         AND is_done = 0
         AND due_date IS NOT NULL
         AND due_date <= CURDATE()
       ORDER BY due_date ASC
       LIMIT 20`,
      [userId]
    );

    const today = toYmd(new Date());

    const reminderItems = remRows.map((r) => ({
      id: `assessment-${r.id}`,
      source: "assessment",
      title: "Assessment Reminder",
      message: String(r.reason || "Take an assessment"),
      date: toYmd(r.reminder_date || r.created_at),
      status: String(r.status || "Pending"),
      unread: String(r.status || "").toLowerCase() !== "done",
      created_at: r.created_at,
      raw_id: Number(r.id),
    }));

    const taskItems = taskRows.map((t) => {
      const due = toYmd(t.due_date);
      const overdue = due < today;
      return {
        id: `task-${t.id}`,
        source: "task",
        title: overdue ? "Task Overdue" : "Task Reminder",
        message: `${t.title}${t.topic ? ` (${t.topic})` : ""}`,
        date: due,
        status: overdue ? "Overdue" : "Pending",
        unread: false,
        created_at: t.created_at,
        raw_id: Number(t.id),
      };
    });

    const items = [...reminderItems, ...taskItems].sort((a, b) => {
      const aTime = new Date(a.created_at || a.date).getTime();
      const bTime = new Date(b.created_at || b.date).getTime();
      return bTime - aTime;
    });

    res.json(items);
  } catch (err) {
    console.error("NOTIFICATIONS LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    await dedupePendingAssessmentReminders(userId);

    const [[rem]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM assessment_reminders
       WHERE user_id = ?
         AND LOWER(status) <> 'done'`,
      [userId]
    );

    const unread = Number(rem?.count || 0);
    res.json({ unread });
  } catch (err) {
    console.error("NOTIFICATIONS SUMMARY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/task-created", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const sinceRaw = String(req.query?.since || "").trim();

    let since = null;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!Number.isNaN(d.getTime())) since = d;
    }

    const sql =
      `SELECT id, title, topic, created_at
       FROM tasks
       WHERE user_id = ?
       ${since ? "AND created_at > ?" : ""}
       ORDER BY created_at DESC
       LIMIT 20`;
    const params = since ? [userId, since] : [userId];

    const [rows] = await pool.query(sql, params);
    res.json(
      rows.map((r) => ({
        id: Number(r.id),
        title: String(r.title || "Task"),
        topic: String(r.topic || ""),
        created_at: r.created_at,
      }))
    );
  } catch (err) {
    console.error("NOTIFICATIONS TASK CREATED ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();
    const userId = req.user.id;
    const id = String(req.params.id || "");

    if (!id.startsWith("assessment-")) {
      return res.status(400).json({ message: "Only assessment reminders can be marked read." });
    }

    const rawId = Number(id.replace("assessment-", ""));
    if (!Number.isInteger(rawId) || rawId <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const [result] = await pool.query(
      `UPDATE assessment_reminders
       SET status = 'Done'
       WHERE id = ? AND user_id = ?`,
      [rawId, userId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Reminder not found" });
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("NOTIFICATIONS READ ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
