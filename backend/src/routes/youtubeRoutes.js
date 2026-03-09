import express from "express";
import axios from "axios";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/youtube/search?q=loops in c programming
 * Returns embeddable videos (reduces "Video unavailable")
 */
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ message: "q is required" });

    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      return res
        .status(500)
        .json({ message: "YOUTUBE_API_KEY missing in backend .env" });
    }

    const searchResp = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          key,
          part: "snippet",
          q,
          type: "video",
          maxResults: 8,
          safeSearch: "strict",
          videoEmbeddable: "true",
        },
      }
    );

    const items = (searchResp.data.items || [])
      .map((it) => {
        const videoId = it.id?.videoId;
        if (!videoId) return null;

        return {
          videoId,
          title: it.snippet?.title || "",
          channelTitle: it.snippet?.channelTitle || "",
          thumbnail:
            it.snippet?.thumbnails?.medium?.url ||
            it.snippet?.thumbnails?.default?.url ||
            "",
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      })
      .filter(Boolean);

    res.json(items);
  } catch (err) {
    // ✅ NEW: show full error details (very useful)
    console.error("FULL ERROR:", err?.response?.data || err.message);

    res.status(500).json({
      message: "YouTube search failed",
      error: err?.response?.data || err.message,
    });
  }
});

export default router;
