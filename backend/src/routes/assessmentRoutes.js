import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  ensureWorkflowSchema,
  generatePlansAndTasksFromWeak,
  getGapTableName,
  reconcileActivePlansWithCurrentGaps,
  scoreToLevel,
} from "../services/workflowService.js";
import {
  refreshOverallProgress,
  updateTaskProgress,
  upsertGap as upsertGapEngine,
} from "../services/recoveryEngine.js";

const router = express.Router();

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const isUnknownColumnError = (err, columnName) =>
  err?.code === "ER_BAD_FIELD_ERROR" ||
  String(err?.message || "").includes(`Unknown column '${columnName}'`);

const getCompatibleDifficulty = async (incomingDifficulty) => {
  const raw = String(incomingDifficulty || "").trim();
  const normalized = raw.toLowerCase();

  const [[col]] = await pool.query(
    `SELECT DATA_TYPE AS dataType, COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'assessment_attempts'
       AND COLUMN_NAME = 'difficulty'
     LIMIT 1`
  );

  if (!col) return "Medium";

  const dataType = String(col.dataType || "").toLowerCase();
  const columnType = String(col.columnType || "");

  if (
    ["tinyint", "smallint", "mediumint", "int", "bigint", "decimal", "float", "double"].includes(
      dataType
    )
  ) {
    if (normalized === "easy") return 1;
    if (normalized === "hard") return 3;
    return 2;
  }

  if (dataType === "enum") {
    const enumValues = [...columnType.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (!enumValues.length) return "Medium";

    const exact = enumValues.find((v) => v.toLowerCase() === normalized);
    if (exact) return exact;

    const mediumLike = enumValues.find((v) =>
      ["medium", "intermediate", "avg", "average", "m"].includes(v.toLowerCase())
    );
    if (mediumLike) return mediumLike;

    return enumValues[0];
  }

  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  }
  return "Medium";
};

const upsertGapEntry = async ({ gapTable, userId, subjectId, topic, level, score, assessedAt }) => {
  if (!subjectId || !topic) return;

  if (gapTable === "gaps") {
    try {
      await pool.query(
        `INSERT INTO gaps (user_id, subject_id, topic, level, score, last_assessed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           level=VALUES(level),
           score=VALUES(score),
           last_assessed_at=VALUES(last_assessed_at),
           updated_at=NOW()`,
        [userId, Number(subjectId), String(topic), level, Number(score || 0), assessedAt || new Date()]
      );
    } catch (gapErr) {
      if (!isUnknownColumnError(gapErr, "score")) throw gapErr;
      await pool.query(
        `INSERT INTO gaps (user_id, subject_id, topic, level, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE level=VALUES(level), updated_at=NOW()`,
        [userId, Number(subjectId), String(topic), level]
      );
    }
  } else {
    await pool.query(
      `INSERT INTO learning_gaps (user_id, subject_id, topic, level, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE level=VALUES(level), updated_at=NOW()`,
      [userId, Number(subjectId), String(topic), level]
    );
  }
};


router.get("/status", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total_questions, COUNT(DISTINCT subject_id) AS subject_count
       FROM question_bank`
    );
    res.json({
      total_questions: Number(rows[0]?.total_questions || 0),
      subject_count: Number(rows[0]?.subject_count || 0),
    });
  } catch (err) {
    console.error("ASSESS STATUS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * Helper: topics list for a subject
 */
router.get("/topics", requireAuth, async (req, res) => {
  try {
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ message: "subject_id required" });

    const [rows] = await pool.query(
      "SELECT DISTINCT topic FROM question_bank WHERE subject_id = ? ORDER BY topic ASC",
      [Number(subject_id)]
    );
    res.json(rows.map((r) => r.topic));
  } catch (err) {
    console.error("ASSESS TOPICS ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * Topic-based quiz generator (used for retest OR manual practice)
 */
router.get("/generate", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject_id, topic, difficulty, count } = req.query;

    if (!subject_id) return res.status(400).json({ message: "subject_id required" });
    if (!topic) return res.status(400).json({ message: "topic required" });

    const qCount = clamp(Number(count || 5), 1, 20);
    const reqTopic = String(topic).trim();
    const normalizedDifficulty = String(difficulty || "").trim();

    let questions = [];
    let effectiveDifficulty = normalizedDifficulty || "Mixed";

    if (normalizedDifficulty && normalizedDifficulty.toLowerCase() !== "mixed") {
      const [strictRows] = await pool.query(
        `SELECT id, subject_id, topic, question, opt_a, opt_b, opt_c, opt_d
         FROM question_bank
         WHERE subject_id = ? AND topic = ? AND difficulty = ?
         ORDER BY RAND()
         LIMIT ?`,
        [Number(subject_id), reqTopic, normalizedDifficulty, qCount]
      );
      questions = strictRows;
    }

    if (!questions.length) {
      const [fallbackRows] = await pool.query(
        `SELECT id, subject_id, topic, question, opt_a, opt_b, opt_c, opt_d
         FROM question_bank
         WHERE subject_id = ? AND topic = ?
         ORDER BY RAND()
         LIMIT ?`,
        [Number(subject_id), reqTopic, qCount]
      );
      questions = fallbackRows;
      effectiveDifficulty = "Mixed";
    }

    if (!questions.length) {
      return res.status(404).json({
        message:
          "No questions found for this Subject + Topic. (Tip: your topic text must match exactly, and you need enough questions.)",
      });
    }

    res.json({
      user_id: userId,
      subject_id: Number(subject_id),
      topic: reqTopic,
      difficulty: effectiveDifficulty,
      total: questions.length,
      questions: questions.map((q) => ({
        id: q.id,
        subject_id: q.subject_id,
        topic: q.topic,
        question: q.question,
        options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
      })),
    });
  } catch (err) {
    console.error("ASSESS GENERATE ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * ✅ NEW: Start test
 * mode:
 *  - "diagnostic": SUBJECT-based MIXED TOPICS (solves your problem)
 *  - "retest": TOPIC-based (weak topic retest)
 */
router.post("/start", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode, subject_id, topic, count } = req.body;

    const qCount = clamp(Number(count || (mode === "diagnostic" ? 8 : 6)), 1, 20);

    // --- DIAGNOSTIC: pick a subject then pull mixed topics
    if (mode === "diagnostic") {
      if (subject_id) {
        const [subRows] = await pool.query("SELECT id FROM subjects WHERE id = ? LIMIT 1", [Number(subject_id)]);
        if (!subRows.length) {
          return res.status(400).json({ message: "subject_id not found in subjects table" });
        }
        const [rows] = await pool.query(
          `SELECT id, subject_id, topic, question, opt_a, opt_b, opt_c, opt_d
           FROM question_bank
           WHERE subject_id = ?
           ORDER BY RAND()
           LIMIT ?`,
          [Number(subject_id), qCount]
        );
        if (!rows.length) {
          return res.status(404).json({ message: "No questions found for this subject." });
        }
        return res.json({
          mode: "diagnostic",
          subject_id: Number(subject_id),
          topic: "Mixed Topics",
          total: rows.length,
          questions: rows.map((q) => ({
            id: q.id,
            subject_id: q.subject_id,
            topic: q.topic,
            question: q.question,
            options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
          })),
        });
      }
      // 1) try to pick subject from user's weak gaps first
      // (if you use gaps table; if empty, fallback to any subject with questions)
      let pickedSubjectId = null;

      // try gaps table first (either gaps or learning_gaps)
      let gapTable = await getGapTableName().catch(() => "learning_gaps");

      try {
        const [weakRows] = await pool.query(
          `SELECT subject_id
           FROM ${gapTable}
           WHERE user_id = ? AND LOWER(level) = 'weak'
           ORDER BY updated_at DESC
           LIMIT 1`,
          [userId]
        );
        if (weakRows?.length) pickedSubjectId = Number(weakRows[0].subject_id);
      } catch {
        // ignore gap lookup issues
      }

      // 2) fallback: pick any subject that has enough questions
      if (!pickedSubjectId) {
        const [anySub] = await pool.query(
          `SELECT subject_id, COUNT(*) AS cnt
           FROM question_bank
           GROUP BY subject_id
           ORDER BY cnt DESC
           LIMIT 1`
        );
        if (anySub?.length) pickedSubjectId = Number(anySub[0].subject_id);
      }

      if (!pickedSubjectId) {
        return res.status(404).json({ message: "No questions in question_bank yet." });
      }

      // 3) pull mixed-topic questions within that subject
      const [qs] = await pool.query(
        `SELECT id, subject_id, topic, question, opt_a, opt_b, opt_c, opt_d
         FROM question_bank
         WHERE subject_id = ?
         ORDER BY RAND()
         LIMIT ?`,
        [pickedSubjectId, qCount]
      );

      if (!qs.length) {
        return res.status(404).json({ message: "No questions found for diagnostic subject." });
      }

      return res.json({
        mode: "diagnostic",
        subject_id: pickedSubjectId,
        topic: "Mixed Topics",
        total: qs.length,
        questions: qs.map((q) => ({
          id: q.id,
          subject_id: q.subject_id,
          topic: q.topic,
          question: q.question,
          options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
        })),
      });
    }

    // --- RETEST: must have subject_id + topic
    if (mode === "retest") {
      if (!subject_id || !topic) {
        return res.status(400).json({ message: "subject_id and topic required for retest" });
      }
      const [subRows] = await pool.query("SELECT id FROM subjects WHERE id = ? LIMIT 1", [Number(subject_id)]);
      if (!subRows.length) return res.status(400).json({ message: "subject_id not found in subjects table" });

      const reqTopic = String(topic).trim();
      const [qs] = await pool.query(
        `SELECT id, subject_id, topic, question, opt_a, opt_b, opt_c, opt_d
         FROM question_bank
         WHERE subject_id = ? AND topic = ?
         ORDER BY RAND()
         LIMIT ?`,
        [Number(subject_id), reqTopic, qCount]
      );

      if (!qs.length) {
        return res.status(404).json({
          message:
            "No questions found for this retest topic. Check topic spelling/case OR add more questions.",
        });
      }

      return res.json({
        mode: "retest",
        subject_id: Number(subject_id),
        topic: reqTopic,
        total: qs.length,
        questions: qs.map((q) => ({
          id: q.id,
          subject_id: q.subject_id,
          topic: q.topic,
          question: q.question,
          options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
        })),
      });
    }

    return res.status(400).json({ message: "Invalid mode. Use 'diagnostic' or 'retest'." });
  } catch (err) {
    console.error("ASSESS START ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * Submit quiz + compute score + save attempt + auto update gaps
 */
router.post("/submit", requireAuth, async (req, res) => {
  try {
    await ensureWorkflowSchema();

    const userId = req.user.id;
    const { subject_id, topic, mode, difficulty, answers } = req.body;
    const assessedAt = new Date();

    if (!subject_id)
      return res.status(400).json({ message: "subject_id required" });

    if (!difficulty)
      return res.status(400).json({ message: "difficulty required" });

    if (!answers || typeof answers !== "object")
      return res.status(400).json({ message: "answers object required" });

    const qIds = Object.keys(answers).map(Number).filter(Boolean);
    if (!qIds.length)
      return res.status(400).json({ message: "No answers submitted" });

    const [rows] = await pool.query(
      `SELECT id, correct_opt, explanation, topic, subject_id
       FROM question_bank
       WHERE id IN (${qIds.map(() => "?").join(",")})`,
      qIds
    );

    const correctMap = {};
    rows.forEach((r) => {
      correctMap[r.id] = {
        correct: r.correct_opt,
        explanation: r.explanation,
        topic: r.topic,
        subject_id: r.subject_id,
      };
    });

    let correctCount = 0;

    const topicStats = {};

    const detail = qIds.map((qid) => {
      const selected = answers[qid];
      const corr = correctMap[qid]?.correct || null;

      const isCorrect = corr && selected ? selected === corr : false;

      if (isCorrect) correctCount++;

      const qTopic = correctMap[qid]?.topic;
      const qSubjectId = correctMap[qid]?.subject_id;

      if (qTopic) {
        const key = `${qSubjectId}__${qTopic}`;

        if (!topicStats[key]) {
          topicStats[key] = {
            subject_id: qSubjectId,
            topic: qTopic,
            total: 0,
            correct: 0,
          };
        }

        topicStats[key].total++;
        if (isCorrect) topicStats[key].correct++;
      }

      return {
        question_id: qid,
        selected_opt: selected || null,
        correct_opt: corr,
        is_correct: isCorrect ? 1 : 0,
        explanation: correctMap[qid]?.explanation || null,
      };
    });

    const total = qIds.length;
    const scorePercent = Math.round((correctCount / total) * 100);
    const level = scoreToLevel(scorePercent);

    const dbDifficulty = await getCompatibleDifficulty(difficulty);

    const [attemptRes] = await pool.query(
      `INSERT INTO assessment_attempts
       (user_id, subject_id, topic, difficulty, total_questions, correct_count, score_percent, level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        Number(subject_id),
        "Mixed Topics",
        dbDifficulty,
        total,
        correctCount,
        scorePercent,
        level,
      ]
    );

    const attemptId = attemptRes.insertId;

    // Save answers
    if (detail.length) {
      const values = detail.map((d) => [
        attemptId,
        d.question_id,
        d.selected_opt,
        d.is_correct,
      ]);

      await pool.query(
        `INSERT INTO assessment_answers
         (attempt_id, question_id, selected_opt, is_correct)
         VALUES ${values.map(() => "(?, ?, ?, ?)").join(",")}`,
        values.flat()
      );
    }

    // Detect weak topics
    const gapTable = await getGapTableName();
    const weakTopics = [];

    for (const stat of Object.values(topicStats)) {
      const topicScore = Math.round(
        (stat.correct / Math.max(stat.total, 1)) * 100
      );

      const tLevel = topicScore < 50 ? "Weak" : scoreToLevel(topicScore);

      await upsertGapEntry({
        gapTable,
        userId,
        subjectId: stat.subject_id,
        topic: stat.topic,
        level: tLevel,
        score: topicScore,
        assessedAt,
      });

      await upsertGapEngine({
        userId,
        subjectId: stat.subject_id,
        topic: stat.topic,
        score: topicScore,
      });

      if (tLevel === "Weak") {
        weakTopics.push({
          subject_id: stat.subject_id,
          topic: stat.topic,
          score_percent: topicScore,
        });
      }
    }

    // Keep recovery plans aligned with latest gap state before any new generation.
    await reconcileActivePlansWithCurrentGaps(userId);

    // Auto-generate recovery plans + tasks when weak topics are detected.
    let tasksCreated = 0;
    let tasksReused = 0;
    let plansGenerated = 0;
    if (weakTopics.length) {
      const out = await generatePlansAndTasksFromWeak(userId);
      tasksCreated = Number(out?.tasks_created || 0);
      tasksReused = Number(out?.tasks_reused || 0);
      plansGenerated = Number(out?.plans?.length || 0);
    }

    // Student solved questions: update related task progress and auto-complete by target.
    const isRetestFlow =
      String(mode || "").toLowerCase() === "retest" ||
      (topic && String(topic).trim().toLowerCase() !== "mixed topics");

    if (isRetestFlow) {
      for (const stat of Object.values(topicStats)) {
        await updateTaskProgress({
          userId,
          subjectId: stat.subject_id,
          topic: stat.topic,
          taskType: "practice_mcq",
          incrementBy: stat.total,
        });

        await updateTaskProgress({
          userId,
          subjectId: stat.subject_id,
          topic: stat.topic,
          taskType: "mini_test",
          incrementBy: 1,
        });
      }
    }

    // Refresh progress
    const progress = await refreshOverallProgress(userId);

    res.json({
      attempt_id: attemptId,
      total_questions: total,
      correct_count: correctCount,
      score_percent: scorePercent,
      level,
      detail,
      weak_topics: weakTopics,
      plans_generated: plansGenerated,
      tasks_created: tasksCreated,
      tasks_reused: tasksReused,
      progress,
      message:
        weakTopics.length
          ? "Assessment saved -> Weak topics detected -> Recovery plans generated -> Tasks generated -> Progress updated"
          : "Assessment saved -> No weak topics detected -> No recovery plan or task generation needed",
    });
  } catch (err) {
    console.error("ASSESS SUBMIT ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject_id, topic } = req.query;

    const params = [userId];
    let sql = `SELECT id, subject_id, topic, difficulty, score_percent, level, created_at
               FROM assessment_attempts
               WHERE user_id = ?`;

    if (subject_id) {
      sql += " AND subject_id = ?";
      params.push(Number(subject_id));
    }
    if (topic) {
      sql += " AND topic = ?";
      params.push(String(topic));
    }

    sql += " ORDER BY created_at DESC LIMIT 20";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("ASSESS HISTORY ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;



