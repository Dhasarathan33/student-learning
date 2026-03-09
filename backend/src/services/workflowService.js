import { pool } from "../config/db.js";

let schemaEnsured = false;

const normalize = (v) => String(v || "").trim().toLowerCase();
const toYmdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const hasTableColumn = async (tableName, columnName) => {
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

const ensureColumn = async (tableName, columnName, definition) => {
  const exists = await hasTableColumn(tableName, columnName);
  if (!exists) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
};

export const getGapTableName = async () => {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('gaps', 'learning_gaps')
     ORDER BY TABLE_NAME = 'gaps' DESC`
  );
  const table = rows[0]?.TABLE_NAME;
  if (!table) {
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
  }
  return String(table);
};

export const scoreToLevel = (score) => {
  if (score < 40) return "Weak";
  if (score < 70) return "Average";
  return "Good";
};

const levelRank = (level) => {
  const lv = normalize(level);
  if (lv === "weak") return 1;
  if (lv === "average") return 2;
  return 3;
};

export const ensureWorkflowSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS recovery_plans (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      topic VARCHAR(255) NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      daily_minutes INT NOT NULL DEFAULT 30,
      target_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_recovery_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await ensureColumn("recovery_plans", "topic", "topic VARCHAR(255) NULL");
  await ensureColumn(
    "recovery_plans",
    "updated_at",
    "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS plan_topics (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      plan_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      topic VARCHAR(255) NOT NULL,
      level VARCHAR(20) NOT NULL DEFAULT 'Average',
      score INT NOT NULL DEFAULT 0,
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_plan_topic (plan_id, topic),
      INDEX idx_plan_topics_plan (plan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS progress_snapshots (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NULL,
      snapshot_date DATE NOT NULL,
      total_tasks INT NOT NULL DEFAULT 0,
      completed_tasks INT NOT NULL DEFAULT 0,
      avg_gap_score INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_progress_daily_subject (user_id, subject_id, snapshot_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS assessment_reminders (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      reminder_date DATE NOT NULL,
      reason VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reminders_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  // Dashboard and assessment history depend on this table.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS assessment_attempts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      subject_id BIGINT NOT NULL,
      topic VARCHAR(255) NOT NULL,
      difficulty VARCHAR(30) NOT NULL DEFAULT 'Mixed',
      total_questions INT NOT NULL DEFAULT 0,
      correct_count INT NOT NULL DEFAULT 0,
      score_percent INT NOT NULL DEFAULT 0,
      level VARCHAR(20) NOT NULL DEFAULT 'Average',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_attempts_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  await ensureColumn("tasks", "topic", "topic VARCHAR(255) NULL");
  await ensureColumn("tasks", "plan_id", "plan_id BIGINT NULL");
  await ensureColumn("tasks", "task_date", "task_date DATE NULL");
  await ensureColumn("tasks", "is_done", "is_done TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("tasks", "status", "status VARCHAR(20) NOT NULL DEFAULT 'Pending'");
  await ensureColumn("tasks", "xp_reward", "xp_reward INT NOT NULL DEFAULT 10");
  await ensureColumn("tasks", "due_date", "due_date DATE NULL");
  await ensureColumn("tasks", "task_type", "task_type VARCHAR(50) NULL");
  await ensureColumn("tasks", "progress_value", "progress_value INT NOT NULL DEFAULT 0");
  await ensureColumn("tasks", "target_value", "target_value INT NOT NULL DEFAULT 1");
  await ensureColumn("tasks", "source", "source VARCHAR(30) DEFAULT 'recovery'");
  await ensureColumn("tasks", "completed_at", "completed_at DATETIME NULL");
  await ensureColumn("tasks", "created_at", "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("tasks", "updated_at", "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  await pool.query(
    `ALTER TABLE tasks
     ADD UNIQUE KEY uq_tasks_plan_topic_title (user_id, plan_id, topic(120), title(120))`
  ).catch(() => {});

  const gapTable = await getGapTableName();
  if (gapTable === "gaps") {
    await ensureColumn("gaps", "score", "score INT NOT NULL DEFAULT 0");
    await ensureColumn("gaps", "last_assessed_at", "last_assessed_at DATETIME NULL");
    await ensureColumn("gaps", "updated_at", "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    await pool.query(
      `ALTER TABLE gaps
       ADD UNIQUE KEY uq_gaps_user_subject_topic (user_id, subject_id, topic)`
    ).catch(() => {});
  }

  await pool.query(
    `ALTER TABLE plan_topics
     ADD CONSTRAINT fk_plan_topics_plan
     FOREIGN KEY (plan_id) REFERENCES recovery_plans(id)
     ON DELETE CASCADE`
  ).catch(() => {});

  await ensureColumn("progress_snapshots", "percent", "percent INT NOT NULL DEFAULT 0");

  schemaEnsured = true;
};

const priorityConfig = (level) => {
  const lv = normalize(level);
  if (lv === "weak") return { priority: "High", minutes: 45, taskCount: 3 };
  if (lv === "average") return { priority: "Medium", minutes: 30, taskCount: 2 };
  return { priority: "Low", minutes: 15, taskCount: 1 };
};

export const generateRecoveryPlans = async (userId) => {
  await ensureWorkflowSchema();
  await reconcileActivePlansWithCurrentGaps(userId);
  const gapTable = await getGapTableName();
  const hasScore = await hasTableColumn(gapTable, "score");
  const hasLastAssessed = await hasTableColumn(gapTable, "last_assessed_at");
  const weakFilter = hasScore
    ? "(LOWER(level) = 'weak' OR IFNULL(score, 0) < 50)"
    : "LOWER(level) = 'weak'";
  const scoreExpr = hasScore ? "IFNULL(score,0)" : `CASE
      WHEN LOWER(level) = 'weak' THEN 25
      WHEN LOWER(level) = 'average' THEN 55
      WHEN LOWER(level) = 'good' THEN 85
      ELSE 0
    END`;
  const assessedExpr = hasLastAssessed ? "IFNULL(last_assessed_at, updated_at)" : "updated_at";

  const [rows] = await pool.query(
    `SELECT subject_id, topic, level, ${scoreExpr} AS score, updated_at, ${assessedExpr} AS last_assessed_at
     FROM ${gapTable}
     WHERE user_id = ?
       AND ${weakFilter}
     ORDER BY
       CASE
         WHEN LOWER(level) = 'weak' THEN 1
         WHEN LOWER(level) = 'average' THEN 2
         ELSE 3
       END,
       IFNULL(score,0) ASC,
       topic ASC`,
    [userId]
  );

  if (!rows.length) {
    // No weak topics in latest state: close any active plans so UI stays consistent.
    await pool.query(
      `UPDATE recovery_plans
       SET status = 'Completed',
           updated_at = NOW()
       WHERE user_id = ?
         AND status = 'Active'`,
      [userId]
    );
    return { plans: [], message: "No weak topics found. Complete an assessment and detect weak topics first." };
  }

  const bySubject = new Map();
  rows.forEach((r) => {
    const sid = Number(r.subject_id);
    if (!bySubject.has(sid)) bySubject.set(sid, []);
    bySubject.get(sid).push(r);
  });

  const plans = [];
  for (const [subjectId, items] of bySubject.entries()) {
    const selected = items
      .filter((x) => normalize(x.level) === "weak" || Number(x.score || 0) < 50)
      .slice(0, 3);
    if (!selected.length) continue;

    selected.sort((a, b) => {
      const rankDiff = levelRank(a.level) - levelRank(b.level);
      if (rankDiff !== 0) return rankDiff;
      const scoreDiff = Number(a.score || 0) - Number(b.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.topic).localeCompare(String(b.topic));
    });

    const highest = selected[0];
    const cfg = priorityConfig(highest.level);
    const planTopicSummary = String(highest.topic || "").trim();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (cfg.priority === "High" ? 14 : cfg.priority === "Medium" ? 10 : 7));
    const targetDateStr = toYmdLocal(targetDate);

    const [existing] = await pool.query(
      `SELECT id FROM recovery_plans
       WHERE user_id = ? AND subject_id = ? AND status = 'Active'
       ORDER BY id DESC LIMIT 1`,
      [userId, subjectId]
    );

    let planId;
    if (existing.length) {
      planId = Number(existing[0].id);
      await pool.query(
        `UPDATE recovery_plans
         SET topic = ?, priority = ?, daily_minutes = ?, target_date = ?
         WHERE id = ? AND user_id = ?`,
        [planTopicSummary, cfg.priority, cfg.minutes, targetDateStr, planId, userId]
      );
      await pool.query(`DELETE FROM plan_topics WHERE plan_id = ?`, [planId]);
    } else {
      const [inserted] = await pool.query(
        `INSERT INTO recovery_plans (user_id, subject_id, topic, priority, daily_minutes, target_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
        [userId, subjectId, planTopicSummary, cfg.priority, cfg.minutes, targetDateStr]
      );
      planId = Number(inserted.insertId);
    }

    for (const topicItem of selected) {
      const topicCfg = priorityConfig(topicItem.level);
      await pool.query(
        `INSERT INTO plan_topics (plan_id, subject_id, topic, level, score, priority)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           level = VALUES(level),
           score = VALUES(score),
           priority = VALUES(priority)`,
        [planId, subjectId, String(topicItem.topic), scoreToLevel(Number(topicItem.score || 0)), Number(topicItem.score || 0), topicCfg.priority]
      );
    }

    plans.push({
      plan_id: planId,
      subject_id: subjectId,
      topics: selected.map((x) => ({
        topic: x.topic,
        score: Number(x.score || 0),
        level: scoreToLevel(Number(x.score || 0)),
      })),
      priority: cfg.priority,
      daily_minutes: cfg.minutes,
      target_date: targetDateStr,
      status: "Active",
    });
  }

  return {
    plans,
    message: "Recovery plan created based on your weakest topics.",
  };
};

export const reconcileActivePlansWithCurrentGaps = async (userId) => {
  await ensureWorkflowSchema();
  const gapTable = await getGapTableName();
  const hasScore = await hasTableColumn(gapTable, "score");
  const weakFilter = hasScore
    ? "(LOWER(level) = 'weak' OR IFNULL(score, 0) < 50)"
    : "LOWER(level) = 'weak'";

  // Keep only the latest active plan per subject (safe across MySQL variants).
  const [activePlans] = await pool.query(
    `SELECT id, subject_id
     FROM recovery_plans
     WHERE user_id = ?
       AND status = 'Active'
     ORDER BY subject_id ASC, id DESC`,
    [userId]
  );

  const seenSubjects = new Set();
  const idsToComplete = [];
  for (const p of activePlans) {
    const sid = Number(p.subject_id);
    if (!seenSubjects.has(sid)) {
      seenSubjects.add(sid);
      continue;
    }
    idsToComplete.push(Number(p.id));
  }

  if (idsToComplete.length) {
    await pool.query(
      `UPDATE recovery_plans
       SET status = 'Completed',
           updated_at = NOW()
       WHERE user_id = ?
         AND status = 'Active'
         AND id IN (${idsToComplete.map(() => "?").join(",")})`,
      [userId, ...idsToComplete]
    );
  }

  // Close active plans for subjects that currently have no weak topics.
  await pool.query(
    `UPDATE recovery_plans rp
     SET rp.status = 'Completed',
         rp.updated_at = NOW()
     WHERE rp.user_id = ?
       AND rp.status = 'Active'
       AND NOT EXISTS (
         SELECT 1
         FROM ${gapTable} g
         WHERE g.user_id = rp.user_id
           AND g.subject_id = rp.subject_id
           AND ${weakFilter}
       )`,
    [userId]
  );
};

const taskTemplatesForLevel = (level, topic) => {
  const lv = normalize(level);
  if (lv === "weak") {
    return [
      { title: `Learn concept: ${topic}`, xp: 20, offset: 0 },
      { title: `Practice MCQs: ${topic}`, xp: 15, offset: 1 },
      { title: `Mini test: ${topic}`, xp: 25, offset: 3 },
    ];
  }
  if (lv === "average") {
    return [
      { title: `Practice concept: ${topic}`, xp: 12, offset: 1 },
      { title: `Quick test: ${topic}`, xp: 16, offset: 3 },
    ];
  }
  return [{ title: `Revision: ${topic}`, xp: 8, offset: 2 }];
};

export const createTasksFromPlan = async (userId, planId = null) => {
  await ensureWorkflowSchema();

  const [plans] = await pool.query(
    `SELECT id, subject_id, topic, target_date, status
     FROM recovery_plans
     WHERE user_id = ?
       AND status = 'Active'
       ${planId ? "AND id = ?" : ""}
     ORDER BY id DESC`,
    planId ? [userId, Number(planId)] : [userId]
  );

  if (!plans.length) {
    return { created: 0, reused: 0, message: "No active recovery plan found." };
  }

  let created = 0;
  let reused = 0;

  for (const plan of plans) {
    const [topicsFromPlanTable] = await pool.query(
      `SELECT topic, level, score
       FROM plan_topics
       WHERE plan_id = ?
       ORDER BY
         CASE
           WHEN LOWER(level) = 'weak' THEN 1
           WHEN LOWER(level) = 'average' THEN 2
           ELSE 3
         END, score ASC, topic ASC`,
      [Number(plan.id)]
    );
    const topics =
      topicsFromPlanTable.length > 0
        ? topicsFromPlanTable
        : [{ topic: String(plan.topic || "").trim(), level: "Average", score: 55 }].filter((x) => x.topic);

    for (const t of topics) {
      const templates = taskTemplatesForLevel(t.level, t.topic);
      for (const tpl of templates) {
        const due = new Date();
        due.setDate(due.getDate() + tpl.offset);
        const dueDate = toYmdLocal(due);
        const [exists] = await pool.query(
          `SELECT id FROM tasks
           WHERE user_id = ? AND plan_id = ? AND LOWER(TRIM(topic)) = ? AND LOWER(TRIM(title)) = ?
           LIMIT 1`,
          [userId, Number(plan.id), normalize(t.topic), normalize(tpl.title)]
        );
        if (exists.length) {
          reused += 1;
          continue;
        }

        await pool.query(
          `INSERT INTO tasks
           (user_id, subject_id, topic, title, due_date, task_date, status, is_done, xp_reward, plan_id)
           VALUES (?, ?, ?, ?, ?, ?, 'Pending', 0, ?, ?)`,
          [userId, Number(plan.subject_id), String(t.topic), tpl.title, dueDate, dueDate, Number(tpl.xp), Number(plan.id)]
        );
        created += 1;
      }
    }
  }

  return {
    created,
    reused,
    message:
      created > 0
        ? `Tasks created from recovery plan. Created: ${created}, already existed: ${reused}.`
        : `No new tasks created. Already existed: ${reused}.`,
  };
};

export const generatePlansAndTasksFromWeak = async (userId) => {
  const planData = await generateRecoveryPlans(userId);
  const createdPlanIds = (planData?.plans || [])
    .map((p) => Number(p.plan_id || 0))
    .filter((id) => Number.isInteger(id) && id > 0);

  let tasksCreated = 0;
  let tasksReused = 0;
  for (const pid of createdPlanIds) {
    const out = await createTasksFromPlan(userId, pid);
    tasksCreated += Number(out?.created || 0);
    tasksReused += Number(out?.reused || 0);
  }

  return {
    message: planData?.message || "Recovery plan generated.",
    plans: planData?.plans || [],
    tasks_created: tasksCreated,
    tasks_reused: tasksReused,
  };
};

export const saveProgressSnapshot = async (userId) => {
  await ensureWorkflowSchema();

  const [totals] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) AS completed
     FROM tasks WHERE user_id = ?`,
    [userId]
  );
  const total = Number(totals[0]?.total || 0);
  const completed = Number(totals[0]?.completed || 0);

  const gapTable = await getGapTableName();
  const hasScore = await hasTableColumn(gapTable, "score");
  const avgScoreExpr = hasScore
    ? "AVG(IFNULL(score, 0))"
    : `AVG(CASE
        WHEN LOWER(level) = 'weak' THEN 25
        WHEN LOWER(level) = 'average' THEN 55
        WHEN LOWER(level) = 'good' THEN 85
        ELSE 0
      END)`;
  const [gaps] = await pool.query(
    `SELECT subject_id, ${avgScoreExpr} AS avg_score
     FROM ${gapTable}
     WHERE user_id = ?
     GROUP BY subject_id`,
    [userId]
  );

  if (!gaps.length) {
    await pool.query(
      `INSERT INTO progress_snapshots (user_id, subject_id, snapshot_date, total_tasks, completed_tasks, avg_gap_score)
       VALUES (?, NULL, CURDATE(), ?, ?, 0)
       ON DUPLICATE KEY UPDATE total_tasks = VALUES(total_tasks), completed_tasks = VALUES(completed_tasks), avg_gap_score = VALUES(avg_gap_score)`,
      [userId, total, completed]
    );
    return;
  }

  for (const g of gaps) {
    await pool.query(
      `INSERT INTO progress_snapshots (user_id, subject_id, snapshot_date, total_tasks, completed_tasks, avg_gap_score)
       VALUES (?, ?, CURDATE(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_tasks = VALUES(total_tasks), completed_tasks = VALUES(completed_tasks), avg_gap_score = VALUES(avg_gap_score)`,
      [userId, Number(g.subject_id), total, completed, Math.round(Number(g.avg_score || 0))]
    );
  }
};
