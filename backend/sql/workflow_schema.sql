-- Student Learning Recovery Planner workflow schema
-- Safe to run multiple times (uses IF NOT EXISTS / guarded ALTER).

CREATE TABLE IF NOT EXISTS assessment_attempts (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gaps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  level VARCHAR(20) NOT NULL DEFAULT 'Average',
  last_assessed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gaps_user_subject_topic (user_id, subject_id, topic),
  INDEX idx_gaps_user_level (user_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recovery_plans (
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
  INDEX idx_recovery_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_topics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  level VARCHAR(20) NOT NULL DEFAULT 'Average',
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_topic (plan_id, topic),
  INDEX idx_plan_topics_subject (subject_id),
  CONSTRAINT fk_plan_topics_plan FOREIGN KEY (plan_id) REFERENCES recovery_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NULL,
  plan_id BIGINT NULL,
  topic VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  task_date DATE NULL,
  due_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  is_done TINYINT(1) NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 10,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tasks_user_date (user_id, task_date),
  INDEX idx_tasks_plan (plan_id),
  UNIQUE KEY uq_task_plan_topic_title (user_id, plan_id, topic, title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NULL,
  snapshot_date DATE NOT NULL,
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,
  avg_gap_score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress_daily_subject (user_id, subject_id, snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_reminders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  reminder_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reminders_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
