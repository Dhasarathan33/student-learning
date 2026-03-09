-- Student Learning Recovery Planner - Full database schema
-- Safe to run multiple times (uses IF NOT EXISTS / guarded ALTER).

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  status ENUM('recovery','done') NOT NULL DEFAULT 'recovery',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subjects_user (user_id),
  CONSTRAINT fk_subjects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_gaps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  level ENUM('Weak','Average','Good') NOT NULL DEFAULT 'Average',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_learning_gaps_user_subject_topic (user_id, subject_id, topic),
  INDEX idx_learning_gaps_user_level (user_id, level),
  CONSTRAINT fk_learning_gaps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_learning_gaps_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
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
  INDEX idx_gaps_user_level (user_id, level),
  CONSTRAINT fk_gaps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_gaps_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
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
  INDEX idx_recovery_user_status (user_id, status),
  CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_recovery_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
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
  CONSTRAINT fk_plan_topics_plan FOREIGN KEY (plan_id) REFERENCES recovery_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_topics_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NULL,
  plan_id BIGINT NULL,
  topic VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  task_type VARCHAR(50) NULL,
  target_value INT NOT NULL DEFAULT 1,
  progress_value INT NOT NULL DEFAULT 0,
  task_date DATE NULL,
  due_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  is_done TINYINT(1) NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 10,
  source VARCHAR(30) DEFAULT 'recovery',
  completed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tasks_user_date (user_id, task_date),
  INDEX idx_tasks_plan (plan_id),
  UNIQUE KEY uq_task_plan_topic_title (user_id, plan_id, topic, title),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_plan FOREIGN KEY (plan_id) REFERENCES recovery_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_resources (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  resource_type ENUM('youtube','note') NOT NULL,
  title VARCHAR(255) NOT NULL,
  url VARCHAR(500) NULL,
  content TEXT NULL,
  difficulty ENUM('basic','medium','advanced') NOT NULL DEFAULT 'basic',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resources_user_subject (user_id, subject_id),
  CONSTRAINT fk_resources_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_resources_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_bank (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty ENUM('Easy','Medium','Hard') NOT NULL DEFAULT 'Medium',
  question TEXT NOT NULL,
  opt_a VARCHAR(255) NOT NULL,
  opt_b VARCHAR(255) NOT NULL,
  opt_c VARCHAR(255) NOT NULL,
  opt_d VARCHAR(255) NOT NULL,
  correct_opt ENUM('A','B','C','D') NOT NULL,
  explanation TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qb_subject_topic (subject_id, topic),
  CONSTRAINT fk_qb_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  INDEX idx_attempts_user_created (user_id, created_at),
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_opt ENUM('A','B','C','D') NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_answers_attempt (attempt_id),
  CONSTRAINT fk_answers_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES question_bank(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  test_type VARCHAR(30) NOT NULL DEFAULT 'mini',
  question_count INT NOT NULL DEFAULT 5,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  scheduled_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assess_queue_user (user_id),
  CONSTRAINT fk_queue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_queue_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NULL,
  snapshot_date DATE NOT NULL,
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,
  percent INT NOT NULL DEFAULT 0,
  avg_gap_score INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress_daily_subject (user_id, subject_id, snapshot_date),
  CONSTRAINT fk_snap_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_snap_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_reminders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  reminder_date DATE NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reminders_user_status (user_id, status),
  CONSTRAINT fk_reminder_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
