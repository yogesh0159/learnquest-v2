CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, settings_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS school_memberships (
  id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','teacher')), display_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(school_id, account_id)
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL, leaderboard_enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS class_memberships (
  id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, child_id)
);
CREATE TABLE IF NOT EXISTS curriculum_skills (
  id TEXT PRIMARY KEY, framework TEXT NOT NULL, grade_band TEXT NOT NULL, subject_id TEXT NOT NULL, label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_assignments (
  id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, mission_id TEXT NOT NULL,
  skill_id TEXT REFERENCES curriculum_skills(id), assigned_by_membership_id TEXT NOT NULL REFERENCES school_memberships(id),
  due_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS skill_mastery (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES curriculum_skills(id), evidence_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0, mastery_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(child_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_class ON class_memberships(class_id);
