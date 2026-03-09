import { pool } from "../config/db.js";

const weakLevelSql = "LOWER(level) = 'weak'";
const AUTO_TITLE_PREFIXES = [
  "learn concept:",
  "practice mcqs:",
  "mini test:",
  "practice concept:",
  "quick test:",
  "revision:",
];
const toYmdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const hasTable = async (tableName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
};

const hasColumn = async (tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
};

const resolveGapTable = async () => {
  if (await hasTable("gaps")) return "gaps";
  if (await hasTable("learning_gaps")) return "learning_gaps";
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gaps (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      topic VARCHAR(255) NOT NULL,
      level VARCHAR(20) NOT NULL DEFAULT 'Average',
      score INT NOT NULL DEFAULT 0,
      last_assessed_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_gaps_user_subject_topic (user_id, subject_id, topic)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  return "gaps";
};

const autoTaskTitleWhereSql = AUTO_TITLE_PREFIXES.map(() => "LOWER(TRIM(title)) LIKE ?").join(" OR ");
const autoTaskTitleParams = AUTO_TITLE_PREFIXES.map((p) => `${p}%`);

/*
Create tasks automatically from weak topics
*/
export const createTasksFromWeakTopics = async (userId, weakTopicsFromAssessment = null) => {
  try {
    let weakTopics = [];

    if (Array.isArray(weakTopicsFromAssessment) && weakTopicsFromAssessment.length) {
      weakTopics = weakTopicsFromAssessment
        .filter((x) => x?.subject_id && String(x?.topic || "").trim())
        .map((x) => ({
          subject_id: Number(x.subject_id),
          topic: String(x.topic).trim(),
        }));
    } else {
      const gapTable = await resolveGapTable();
      const hasScore = await hasColumn(gapTable, "score");
      const [rows] = await pool.query(
        `SELECT user_id, subject_id, topic${hasScore ? ", score" : ""}, level
         FROM ${gapTable}
         WHERE user_id = ?
           AND (${weakLevelSql}${hasScore ? " OR IFNULL(score, 0) < 50" : ""})
         ORDER BY updated_at DESC`,
        [userId]
      );
      weakTopics = rows || [];
    }

    if (!weakTopics.length) {
      return { created: 0 };
    }

    let created = 0;

    for (const gap of weakTopics) {
      const { subject_id, topic } = gap;
      const taskDefs = [
        { title: `Learn concept: ${topic}`, task_type: "study", target: 1, xp: 20 },
        { title: `Practice MCQs: ${topic}`, task_type: "practice_mcq", target: 10, xp: 15 },
        { title: `Mini test: ${topic}`, task_type: "mini_test", target: 1, xp: 25 },
      ];

      for (const def of taskDefs) {
        const [existing] = await pool.query(
          `SELECT id
           FROM tasks
           WHERE user_id = ?
             AND subject_id = ?
             AND LOWER(TRIM(topic)) = LOWER(TRIM(?))
             AND task_type = ?
             AND is_done = 0
           LIMIT 1`,
          [userId, subject_id, topic, def.task_type]
        );

        if (existing.length) continue;

        const dueDate = toYmdLocal(new Date());
        await pool.query(
          `INSERT INTO tasks
           (user_id, subject_id, topic, title, task_type, target_value, progress_value, status, is_done, xp_reward, due_date, task_date)
           VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending', 0, ?, ?, ?)`,
          [userId, subject_id, topic, def.title, def.task_type, def.target, def.xp, dueDate, dueDate]
        );

        created++;
      }
    }

    return { created };
  } catch (err) {
    console.error("TASK GENERATION ERROR:", err);
    return { created: 0 };
  }
};

/*
Update progress for a specific task
*/
export const updateTaskProgress = async ({
  userId,
  subjectId,
  topic,
  taskType,
  incrementBy = 1,
}) => {
  try {
    const [tasks] = await pool.query(
      `SELECT id, target_value, progress_value
       FROM tasks
       WHERE user_id = ?
         AND subject_id = ?
         AND LOWER(TRIM(topic)) = LOWER(TRIM(?))
         AND task_type = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId, subjectId, topic, taskType]
    );

    if (!tasks.length) return;

    const task = tasks[0];
    const target = Number(task.target_value || 1);
    const nextProgress = Number(task.progress_value || 0) + Number(incrementBy || 1);
    const done = nextProgress >= target ? 1 : 0;
    const status = done ? "Done" : "InProgress";

    await pool.query(
      `UPDATE tasks
       SET progress_value = ?,
           is_done = ?,
           status = ?,
           completed_at = CASE WHEN ? = 1 THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = ?`,
      [nextProgress, done, status, done, task.id]
    );
  } catch (err) {
    console.error("TASK PROGRESS UPDATE ERROR:", err);
  }
};

/*
Insert or update weak topic in gaps table
*/
export const upsertGap = async ({ userId, subjectId, topic, score }) => {
  try {
    const gapTable = await resolveGapTable();
    const level = Number(score || 0) < 40 ? "Weak" : Number(score || 0) < 70 ? "Average" : "Good";

    if (gapTable === "gaps") {
      await pool.query(
        `INSERT INTO gaps
        (user_id, subject_id, topic, score, level, last_assessed_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          score = VALUES(score),
          level = VALUES(level),
          last_assessed_at = VALUES(last_assessed_at),
          updated_at = NOW()`,
        [userId, subjectId, topic, score, level]
      );
      return;
    }

    const supportsScore = await hasColumn("learning_gaps", "score");
    if (supportsScore) {
      await pool.query(
        `INSERT INTO learning_gaps
        (user_id, subject_id, topic, score, level, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          score = VALUES(score),
          level = VALUES(level),
          updated_at = NOW()`,
        [userId, subjectId, topic, score, level]
      );
    } else {
      await pool.query(
        `INSERT INTO learning_gaps
        (user_id, subject_id, topic, level, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          level = VALUES(level),
          updated_at = NOW()`,
        [userId, subjectId, topic, level]
      );
    }
  } catch (err) {
    console.error("UPSERT GAP ERROR:", err);
  }
};

/*
Calculate overall progress
*/
export const refreshOverallProgress = async (userId) => {
  try {
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_done = 1 OR status = 'Done' THEN 1 ELSE 0 END) AS done
       FROM tasks
       WHERE user_id = ?`,
      [userId]
    );

    const totalTasks = Number(summary?.total || 0);
    const completedTasks = Number(summary?.done || 0);
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return {
      progress,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
    };
  } catch (err) {
    console.error("PROGRESS REFRESH ERROR:", err);

    return {
      progress: 0,
      total_tasks: 0,
      completed_tasks: 0,
    };
  }
};

/*
Clean up old legacy auto-generated pending tasks from earlier flows.
This keeps only meaningful current-cycle tasks visible.
*/
export const cleanupLegacyAutoTasks = async (userId) => {
  try {
    await pool.query(
      `DELETE FROM tasks
       WHERE user_id = ?
         AND IFNULL(is_done, 0) = 0
         AND (
           LOWER(TRIM(COALESCE(topic, ''))) IN ('daily mixed weak topics', 'weekly subject exam')
           OR (${autoTaskTitleWhereSql} AND task_type IS NULL)
         )`,
      [userId, ...autoTaskTitleParams]
    );
  } catch (err) {
    console.error("LEGACY TASK CLEANUP ERROR:", err);
  }
};

/*
Remove pending auto-generated tasks for topics that are no longer weak
in the latest assessment cycle.
*/
export const pruneAutoTasksOutsideTopics = async (userId, allowedTopics = []) => {
  try {
    const normalized = (allowedTopics || [])
      .map((t) => String(t || "").trim().toLowerCase())
      .filter(Boolean);

    if (!normalized.length) {
      await pool.query(
        `DELETE FROM tasks
         WHERE user_id = ?
           AND IFNULL(is_done, 0) = 0
           AND (${autoTaskTitleWhereSql})`,
        [userId, ...autoTaskTitleParams]
      );
      return;
    }

    const notInSql = normalized.map(() => "?").join(",");
    await pool.query(
      `DELETE FROM tasks
       WHERE user_id = ?
         AND IFNULL(is_done, 0) = 0
         AND (${autoTaskTitleWhereSql})
         AND LOWER(TRIM(COALESCE(topic, ''))) NOT IN (${notInSql})`,
      [userId, ...autoTaskTitleParams, ...normalized]
    );
  } catch (err) {
    console.error("STALE TASK PRUNE ERROR:", err);
  }
};
