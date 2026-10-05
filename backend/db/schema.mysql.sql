CREATE TABLE IF NOT EXISTS parents (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS children (
  id VARCHAR(64) PRIMARY KEY,
  parent_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  age INT NOT NULL,
  age_group VARCHAR(10) NOT NULL,
  class VARCHAR(80) NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  avatar VARCHAR(32) NOT NULL DEFAULT '🦊',
  pin VARCHAR(255) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  overall_level INT NOT NULL DEFAULT 1,
  streak_count INT NOT NULL DEFAULT 0,
  last_active_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_children_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
  INDEX idx_children_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(120) NOT NULL,
  name_hi VARCHAR(120) NOT NULL,
  name_mr VARCHAR(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(64) PRIMARY KEY,
  subject_id VARCHAR(64) NOT NULL,
  topic VARCHAR(120) NOT NULL,
  age_group VARCHAR(10) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  question_en TEXT NOT NULL,
  question_hi TEXT NOT NULL,
  question_mr TEXT NOT NULL,
  options_json LONGTEXT NOT NULL,
  correct_index INT NOT NULL,
  explanation_en TEXT NOT NULL,
  explanation_hi TEXT NOT NULL,
  explanation_mr TEXT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 10,
  CONSTRAINT fk_questions_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_questions_subject_age (subject_id, age_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS worlds (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(120) NOT NULL,
  name_hi VARCHAR(120) NOT NULL,
  name_mr VARCHAR(120) NOT NULL,
  emoji VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_levels (
  id VARCHAR(64) PRIMARY KEY,
  world_id VARCHAR(64) NOT NULL,
  level_number INT NOT NULL,
  name_en VARCHAR(160) NOT NULL,
  name_hi VARCHAR(160) NOT NULL,
  name_mr VARCHAR(160) NOT NULL,
  unlock_type VARCHAR(30) NOT NULL,
  unlock_value INT NULL,
  gate_subject_id VARCHAR(64) NULL,
  questions_required INT NOT NULL DEFAULT 3,
  is_boss TINYINT(1) NOT NULL DEFAULT 0,
  boss_hp INT NULL DEFAULT 5,
  CONSTRAINT fk_levels_world FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
  CONSTRAINT fk_levels_subject FOREIGN KEY (gate_subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  UNIQUE KEY uq_world_level (world_id, level_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_level_progress (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  level_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'locked',
  attempts INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  CONSTRAINT fk_progress_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_level FOREIGN KEY (level_id) REFERENCES game_levels(id) ON DELETE CASCADE,
  UNIQUE KEY uq_child_level (child_id, level_id),
  INDEX idx_progress_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_log (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  level_id VARCHAR(64) NULL,
  correct TINYINT(1) NOT NULL,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qlog_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_qlog_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_qlog_level FOREIGN KEY (level_id) REFERENCES game_levels(id) ON DELETE SET NULL,
  INDEX idx_question_log_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rewards (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(160) NOT NULL,
  name_hi VARCHAR(160) NOT NULL,
  name_mr VARCHAR(160) NOT NULL,
  type VARCHAR(40) NOT NULL,
  cost_coins INT NOT NULL,
  emoji VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_rewards (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  reward_id VARCHAR(64) NOT NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_child_rewards_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_child_rewards_reward FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  UNIQUE KEY uq_child_reward (child_id, reward_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_tasks (
  id VARCHAR(64) PRIMARY KEY,
  parent_id VARCHAR(64) NOT NULL,
  child_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  reward_type VARCHAR(30) NOT NULL DEFAULT 'coins',
  reward_value INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_tasks_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_activity (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  activity_date DATE NOT NULL,
  questions_attempted INT NOT NULL DEFAULT 0,
  questions_correct INT NOT NULL DEFAULT 0,
  minutes_learning INT NOT NULL DEFAULT 0,
  minutes_game INT NOT NULL DEFAULT 0,
  daily_quest_done TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_daily_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE KEY uq_child_activity_date (child_id, activity_date),
  INDEX idx_daily_activity_child_date (child_id, activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Three.js Jungle Runner telemetry, stars and loadout
CREATE TABLE IF NOT EXISTS game_runs (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  level_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  integrity_token_hash CHAR(64) NOT NULL,
  event_sequence INT NOT NULL DEFAULT 0,
  verified_coins INT NOT NULL DEFAULT 0,
  verified_keys INT NOT NULL DEFAULT 0,
  verified_obstacles INT NOT NULL DEFAULT 0,
  last_event_elapsed_ms INT NULL,
  last_event_type VARCHAR(16) NULL,
  distance_run INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  run_coins INT NOT NULL DEFAULT 0,
  keys_collected INT NOT NULL DEFAULT 0,
  obstacles_dodged INT NOT NULL DEFAULT 0,
  max_combo INT NOT NULL DEFAULT 0,
  stars_earned INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  CONSTRAINT fk_game_runs_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_game_runs_level FOREIGN KEY (level_id) REFERENCES game_levels(id) ON DELETE CASCADE,
  INDEX idx_game_runs_child_level (child_id, level_id),
  INDEX idx_game_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_run_answers (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  selected_index INT NOT NULL,
  correct TINYINT(1) NOT NULL,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_run_answers_run FOREIGN KEY (run_id) REFERENCES game_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_run_answers_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_run_question (run_id, question_id),
  INDEX idx_run_answers_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_run_think_time (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  started_at_ms BIGINT NOT NULL,
  paid_seconds INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  ended_at DATETIME NULL,
  CONSTRAINT fk_think_time_run FOREIGN KEY (run_id) REFERENCES game_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_think_time_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_think_time_run_question (run_id, question_id),
  INDEX idx_think_time_run (run_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS level_run_stats (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  level_id VARCHAR(64) NOT NULL,
  best_score INT NOT NULL DEFAULT 0,
  best_stars INT NOT NULL DEFAULT 0,
  best_distance INT NOT NULL DEFAULT 0,
  best_coins INT NOT NULL DEFAULT 0,
  best_combo INT NOT NULL DEFAULT 0,
  best_accuracy INT NOT NULL DEFAULT 0,
  runs_completed INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_level_stats_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_level_stats_level FOREIGN KEY (level_id) REFERENCES game_levels(id) ON DELETE CASCADE,
  UNIQUE KEY uq_level_stats_child_level (child_id, level_id),
  INDEX idx_level_stats_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_equipped_rewards (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  slot VARCHAR(32) NOT NULL,
  reward_id VARCHAR(64) NOT NULL,
  equipped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipped_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  CONSTRAINT fk_equipped_reward FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  UNIQUE KEY uq_equipped_child_slot (child_id, slot),
  INDEX idx_equipped_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RealWorld learning evidence stays independent from runner/cosmetic rewards.
CREATE TABLE IF NOT EXISTS mission_sessions (
  id VARCHAR(64) PRIMARY KEY,
  child_id VARCHAR(64) NOT NULL,
  mission_id VARCHAR(32) NOT NULL,
  age_group VARCHAR(16) NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 3,
  attempts INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  mistakes INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  CONSTRAINT fk_mission_sessions_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_mission_sessions_child (child_id, mission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mission_attempts (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  child_id VARCHAR(64) NOT NULL,
  mission_id VARCHAR(32) NOT NULL,
  age_group VARCHAR(16) NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  step_index INT NOT NULL,
  skill VARCHAR(64) NOT NULL,
  answer_id VARCHAR(64) NOT NULL,
  correct TINYINT(1) NOT NULL,
  attempt_number INT NOT NULL,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mission_attempts_session FOREIGN KEY (session_id) REFERENCES mission_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_mission_attempts_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE KEY uq_mission_step_attempt (session_id, step_index, attempt_number),
  INDEX idx_mission_attempts_child (child_id, mission_id, skill)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
