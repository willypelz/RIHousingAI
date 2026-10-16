-- RIHousingAI initial schema

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('developer','architect_engineer','contractor','consultant','municipal_staff','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE municipalities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'RI',
  website TEXT,
  coverage_status TEXT NOT NULL DEFAULT 'planned' CHECK (coverage_status IN ('verified','partial','planned'))
);

CREATE TABLE agencies (
  id SERIAL PRIMARY KEY,
  municipality_id INT REFERENCES municipalities(id),
  level TEXT NOT NULL CHECK (level IN ('municipal','state','federal','utility')),
  name TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT
);

CREATE TABLE official_sources (
  id SERIAL PRIMARY KEY,
  agency_id INT REFERENCES agencies(id),
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  doc_version TEXT,
  published_date DATE,
  effective_date DATE,
  last_verified_at DATE,
  summary TEXT,
  content TEXT,              -- extracted/curated text used for RAG grounding
  fees_note TEXT,            -- published fees with citation context, if any
  processing_estimate TEXT,  -- published processing estimate (NOT an actual timeline)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE source_changes (
  id SERIAL PRIMARY KEY,
  source_id INT NOT NULL REFERENCES official_sources(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_note TEXT NOT NULL,
  changed_by INT REFERENCES users(id)
);

CREATE TABLE approval_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('planning','building','fire','utility','environmental','state','inspection')),
  description TEXT,
  agency_id INT REFERENCES agencies(id),
  -- JSON applicability rules evaluated against project details.
  -- e.g. {"min_units":2, "municipality":"Cumberland", "construction_kinds":["new_construction"], "conditional":true, "condition_note":"..."}
  applicability_rules JSONB NOT NULL DEFAULT '{}',
  source_id INT REFERENCES official_sources(id)
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  municipality_id INT NOT NULL REFERENCES municipalities(id),
  dev_type TEXT NOT NULL,  -- e.g. multi_family, single_family, townhouse, mixed_residential
  units INT NOT NULL CHECK (units > 0),
  construction_kind TEXT NOT NULL CHECK (construction_kind IN ('new_construction','conversion','addition')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pre_application',
  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  applicant_phone TEXT,
  representative_name TEXT,
  representative_email TEXT,
  existing_application_numbers TEXT,
  sewer_service TEXT CHECK (sewer_service IN ('public_sewer','septic','unknown')) DEFAULT 'unknown',
  water_service TEXT CHECK (water_service IN ('public_water','well','unknown')) DEFAULT 'unknown',
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner','member','reviewer')),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_approvals (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  approval_type_id INT NOT NULL REFERENCES approval_types(id),
  applicability TEXT NOT NULL DEFAULT 'applicable' CHECK (applicability IN ('applicable','conditional','not_applicable')),
  applicability_note TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  submitted_at DATE,
  verified_due_date DATE,        -- only set when a verified deadline exists
  due_date_source_id INT REFERENCES official_sources(id),
  UNIQUE (project_id, approval_type_id)
);

CREATE TABLE checklist_items (
  id SERIAL PRIMARY KEY,
  project_approval_id INT NOT NULL REFERENCES project_approvals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('form','document','plan','certification','fee','instruction','prerequisite','referral','hearing')),
  description TEXT,
  responsible_authority TEXT,
  fee_amount TEXT,               -- stored as published text; never invented
  fee_source_id INT REFERENCES official_sources(id),
  fee_verified_date DATE,
  submission_link TEXT,
  source_id INT REFERENCES official_sources(id),
  depends_on_item_id INT REFERENCES checklist_items(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','complete','not_applicable')),
  completed_at TIMESTAMPTZ,
  completed_by INT REFERENCES users(id),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  checklist_item_id INT REFERENCES checklist_items(id),
  category TEXT NOT NULL DEFAULT 'uncategorized',
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  extracted_text TEXT,
  uploaded_by INT NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE TABLE review_stages (
  id SERIAL PRIMARY KEY,
  project_approval_id INT NOT NULL REFERENCES project_approvals(id) ON DELETE CASCADE,
  code TEXT NOT NULL,            -- preparation, submission, completeness_review, technical_review, rai, revisions, hearing, decision, conditions, permits, inspections, final_signoff
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','waiting_on_agency','waiting_on_applicant','complete','skipped')),
  responsible_authority TEXT,
  required_documents TEXT,
  submitted_at DATE,
  verified_due_date DATE,
  due_date_source_id INT REFERENCES official_sources(id),
  next_action TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (project_approval_id, code)
);

CREATE TABLE stage_dependencies (
  stage_id INT NOT NULL REFERENCES review_stages(id) ON DELETE CASCADE,
  depends_on_stage_id INT NOT NULL REFERENCES review_stages(id) ON DELETE CASCADE,
  PRIMARY KEY (stage_id, depends_on_stage_id)
);

CREATE TABLE review_comments (
  id SERIAL PRIMARY KEY,
  project_approval_id INT NOT NULL REFERENCES project_approvals(id) ON DELETE CASCADE,
  stage_id INT REFERENCES review_stages(id),
  author_user_id INT REFERENCES users(id),
  agency_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment','rai','condition_note')),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','responded','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comment_responses (
  id SERIAL PRIMARY KEY,
  comment_id INT NOT NULL REFERENCES review_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE decisions (
  id SERIAL PRIMARY KEY,
  project_approval_id INT NOT NULL REFERENCES project_approvals(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved','approved_with_conditions','denied','continued')),
  decided_on DATE NOT NULL,
  decided_by TEXT NOT NULL,
  notes TEXT,
  recorded_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conditions (
  id SERIAL PRIMARY KEY,
  decision_id INT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','satisfied','waived')),
  satisfied_at DATE
);

CREATE TABLE inspections (
  id SERIAL PRIMARY KEY,
  project_approval_id INT NOT NULL REFERENCES project_approvals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inspector_agency TEXT,
  scheduled_for DATE,
  result TEXT CHECK (result IN ('passed','failed','pending')),
  notes TEXT
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_approval_id INT REFERENCES project_approvals(id),
  title TEXT NOT NULL,
  description TEXT,
  waiting_on TEXT NOT NULL DEFAULT 'applicant' CHECK (waiting_on IN ('applicant','agency')),
  assignee_user_id INT REFERENCES users(id),
  verified_due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE completeness_checks (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_approval_id INT REFERENCES project_approvals(id),
  run_by INT NOT NULL REFERENCES users(id),
  engine TEXT NOT NULL,      -- 'anthropic' | 'fallback'
  disclaimer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE completeness_findings (
  id SERIAL PRIMARY KEY,
  check_id INT NOT NULL REFERENCES completeness_checks(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL CHECK (finding_type IN ('missing_document','incomplete_field','missing_signature','inconsistency','missing_attachment','open_question')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','blocker')),
  title TEXT NOT NULL,
  detail TEXT,
  evidence TEXT,             -- excerpt or basis supporting the finding
  document_version_id INT REFERENCES document_versions(id),
  checklist_item_id INT REFERENCES checklist_items(id),
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE assistant_conversations (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  cited_source_ids INT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id SERIAL PRIMARY KEY,
  actor_user_id INT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_municipality ON projects(municipality_id);
CREATE INDEX idx_checklist_pa ON checklist_items(project_approval_id);
CREATE INDEX idx_stages_pa ON review_stages(project_approval_id);
CREATE INDEX idx_docs_project ON documents(project_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
