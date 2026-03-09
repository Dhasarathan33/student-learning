import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureNonEmpty, isPositiveInt } from "../middleware/validation.js";

const router = express.Router();

// Add subject
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const name = ensureNonEmpty(req.body?.name, "Subject name");

    const [result] = await pool.query(
      "INSERT INTO subjects (user_id, name, status) VALUES (?, ?, 'recovery')",
      [userId, name]
    );

    res.status(201).json({ id: result.insertId, name, status: "recovery" });
  } catch (err) {
    console.error("SUBJECT ADD ERROR:", err);
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

// List subjects
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      "SELECT * FROM subjects WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("SUBJECT LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ ADD THIS DELETE ROUTE HERE
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isPositiveInt(id)) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    await pool.query(
      "DELETE FROM subjects WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("SUBJECT DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ NEW: UPDATE SUBJECT (Edit)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const name = ensureNonEmpty(req.body?.name, "Subject name");
    if (!isPositiveInt(id)) {
      return res.status(400).json({ message: "Invalid subject id" });
    }

    await pool.query(
      "UPDATE subjects SET name = ? WHERE id = ? AND user_id = ?",
      [name, id, userId]
    );

    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("SUBJECT UPDATE ERROR:", err);
    res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
  }
});

export default router;
