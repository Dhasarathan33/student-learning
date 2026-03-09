import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureNonEmpty, isPositiveInt } from "../middleware/validation.js";

const router = express.Router();

// Helper: convert watch URL to embed URL
function toYoutubeEmbed(url) {
  if (!url) return "";
  const u = String(url);

  // youtu.be/VIDEO_ID
  const short = u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (short?.[1]) return `https://www.youtube.com/embed/${short[1]}`;

  // youtube.com/watch?v=VIDEO_ID
  const watch = u.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (watch?.[1]) return `https://www.youtube.com/embed/${watch[1]}`;

  // already embed
  if (u.includes("/embed/")) return u;

  return u; // fallback
}

/**
 * GET /api/resources
 * query: subject_id?, topic?
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject_id, topic } = req.query;

    // ✅ FIX: qualify columns with lr.
    const conditions = ["lr.user_id = ?"];
    const params = [userId];

    if (subject_id) {
      conditions.push("lr.subject_id = ?"); // ✅ CHANGED
      params.push(Number(subject_id));
    }
    if (topic) {
      conditions.push("lr.topic LIKE ?"); // ✅ CHANGED
      params.push(`%${topic}%`);
    }

    const [rows] = await pool.query(
      `
      SELECT lr.*, s.name AS subject_name
      FROM learning_resources lr
      JOIN subjects s ON s.id = lr.subject_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY lr.updated_at DESC, lr.id DESC
      `,
      params
    );

    const mapped = rows.map((r) => ({
      ...r,
      embed_url: r.resource_type === "youtube" ? toYoutubeEmbed(r.url) : null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("RESOURCES LIST ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * POST /api/resources
 * body: { subject_id, topic, resource_type, title, url?, content?, difficulty? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const subject_id = req.body?.subject_id;
    const topic = ensureNonEmpty(req.body?.topic, "topic");
    const resource_type = req.body?.resource_type;
    const title = ensureNonEmpty(req.body?.title, "title");
    const { url, content, difficulty } = req.body;

    if (!isPositiveInt(subject_id)) return res.status(400).json({ message: "subject_id is required" });

    const typeOk = ["youtube", "note"].includes(resource_type);
    if (!typeOk) return res.status(400).json({ message: "resource_type must be youtube or note" });

    if (resource_type === "youtube" && !String(url || "").trim()) {
      return res.status(400).json({ message: "url is required for youtube" });
    }
    if (resource_type === "note" && !String(content || "").trim()) {
      return res.status(400).json({ message: "content is required for note" });
    }

    const diff = ["basic", "medium", "advanced"].includes(difficulty) ? difficulty : "basic";

    const [result] = await pool.query(
      `
      INSERT INTO learning_resources
      (user_id, subject_id, topic, resource_type, title, url, content, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        Number(subject_id),
        topic,
        resource_type,
        title,
        url?.trim() || null,
        content?.trim() || null,
        diff,
      ]
    );

    res.status(201).json({ id: result.insertId, message: "Resource added" });
  } catch (err) {
    console.error("RESOURCES CREATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * DELETE /api/resources/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isPositiveInt(id)) {
      return res.status(400).json({ message: "Invalid resource id" });
    }

    const [result] = await pool.query(
      "DELETE FROM learning_resources WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: "Not found" });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("RESOURCES DELETE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
