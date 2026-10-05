-- Website content (impact + partners) and careers.
-- Safe to rerun.

BEGIN;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS impact_stats JSON;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS partners JSON;

CREATE TABLE IF NOT EXISTS job_posts (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  department VARCHAR,
  location VARCHAR,
  employment_type VARCHAR,
  description TEXT,
  requirements TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_applications (
  id VARCHAR PRIMARY KEY,
  job_id VARCHAR NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  phone VARCHAR,
  cover_letter TEXT,
  cv_filename VARCHAR,
  cv_url VARCHAR,
  status VARCHAR DEFAULT 'new',
  created_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_job_applications_job_id ON job_applications (job_id);
CREATE INDEX IF NOT EXISTS ix_job_posts_published ON job_posts (is_published);

COMMIT;
