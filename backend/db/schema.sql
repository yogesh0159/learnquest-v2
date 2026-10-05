PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK(age BETWEEN 4 AND 12),
  age_group TEXT NOT NULL,
  class TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  avatar TEXT NOT NULL DEFAULT '🦊',
  pin TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  overall_level INTEGER NOT NULL DEFAULT 1,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  name_mr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  age_group TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_en TEXT NOT NULL,
  question_hi TEXT NOT NULL,
  question_mr TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation_en TEXT NOT NULL,
  explanation_hi TEXT NOT NULL,
  explanation_mr TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  name_mr TEXT NOT NULL,
  emoji TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_levels (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  name_mr TEXT NOT NULL,
  unlock_type TEXT NOT NULL,
  unlock_value INTEGER,
  gate_subject_id TEXT REFERENCES subjects(id),
  questions_required INTEGER NOT NULL DEFAULT 3,
  is_boss INTEGER NOT NULL DEFAULT 0,
  boss_hp INTEGER DEFAULT 5,
  UNIQUE(world_id, level_number)
);

CREATE TABLE IF NOT EXISTS child_level_progress (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  level_id TEXT NOT NULL REFERENCES game_levels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked',
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE(child_id, level_id)
);

CREATE TABLE IF NOT EXISTS question_log (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level_id TEXT REFERENCES game_levels(id) ON DELETE SET NULL,
  correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_hi TEXT NOT NULL,
  name_mr TEXT NOT NULL,
  type TEXT NOT NULL,
  cost_coins INTEGER NOT NULL,
  emoji TEXT
);

CREATE TABLE IF NOT EXISTS child_rewards (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(child_id, reward_id)
);

CREATE TABLE IF NOT EXISTS parent_tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'coins',
  reward_value INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_activity (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  minutes_learning INTEGER NOT NULL DEFAULT 0,
  minutes_game INTEGER NOT NULL DEFAULT 0,
  daily_quest_done INTEGER NOT NULL DEFAULT 0,
  UNIQUE(child_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_age ON questions(subject_id, age_group);
CREATE INDEX IF NOT EXISTS idx_progress_child ON child_level_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_question_log_child ON question_log(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_child_date ON daily_activity(child_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_tasks_child ON parent_tasks(child_id);
