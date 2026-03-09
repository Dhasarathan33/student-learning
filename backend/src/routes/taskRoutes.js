import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const isUnknownColumnError = (err, columnName) =>
  err?.code === "ER_BAD_FIELD_ERROR" ||
  String(err?.message || "").includes(`Unknown column '${columnName}'`);

// Add task
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, task_date, subject_id } = req.body;

    const [result] = await pool.query(
      "INSERT INTO tasks (user_id, subject_id, title, task_date, is_done) VALUES (?, ?, ?, ?, 0)",
      [userId, subject_id || null, title, task_date]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("TASK ADD ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// List today tasks
router.get("/today", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE user_id = ? AND task_date = CURDATE() ORDER BY id DESC",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("TASK TODAY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// List all tasks (used by tasks board)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("TASK LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// List tasks by date (YYYY-MM-DD)
router.get("/by-date", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "date query param is required (YYYY-MM-DD)" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE user_id = ? AND task_date = ? ORDER BY id DESC",
      [userId, date]
    );

    res.json(rows);
  } catch (err) {
    console.error("TASK BY DATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// List all tasks for the user
router.get("/all", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      "SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("TASK ALL ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Mark done/undone
router.put("/:id/done", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { is_done } = req.body;

    const done = is_done ? 1 : 0;

    try {
      await pool.query(
        "UPDATE tasks SET is_done = ?, status = ? WHERE id = ? AND user_id = ?",
        [done, done ? "Done" : "Pending", id, userId]
      );
    } catch (err) {
      if (!isUnknownColumnError(err, "status")) throw err;
      await pool.query(
        "UPDATE tasks SET is_done = ? WHERE id = ? AND user_id = ?",
        [done, id, userId]
      );
    }

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("TASK DONE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Update task
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, task_date, subject_id, status, is_done } = req.body;

    if (title !== undefined || task_date !== undefined || subject_id !== undefined) {
      await pool.query(
        "UPDATE tasks SET title = COALESCE(?, title), task_date = COALESCE(?, task_date), subject_id = COALESCE(?, subject_id) WHERE id = ? AND user_id = ?",
        [title ?? null, task_date ?? null, subject_id ?? null, id, userId]
      );
    }

    if (status !== undefined || is_done !== undefined) {
      const done = is_done === undefined ? undefined : is_done ? 1 : 0;
      const nextStatus = status !== undefined ? String(status) : done === 1 ? "Done" : done === 0 ? "Pending" : undefined;

      if (done !== undefined && nextStatus !== undefined) {
        try {
          await pool.query(
            "UPDATE tasks SET is_done = ?, status = ? WHERE id = ? AND user_id = ?",
            [done, nextStatus, id, userId]
          );
        } catch (err) {
          if (!isUnknownColumnError(err, "status")) throw err;
          await pool.query(
            "UPDATE tasks SET is_done = ? WHERE id = ? AND user_id = ?",
            [done, id, userId]
          );
        }
      } else if (done !== undefined) {
        await pool.query(
          "UPDATE tasks SET is_done = ? WHERE id = ? AND user_id = ?",
          [done, id, userId]
        );
      } else if (nextStatus !== undefined) {
        try {
          await pool.query(
            "UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?",
            [nextStatus, id, userId]
          );
        } catch (err) {
          if (!isUnknownColumnError(err, "status")) throw err;
        }
      }
    }

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("TASK UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete task
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      "DELETE FROM tasks WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("TASK DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
