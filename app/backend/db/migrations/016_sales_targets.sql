ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registered_by_user_id VARCHAR REFERENCES users(id);
CREATE INDEX IF NOT EXISTS ix_organizations_registered_by ON organizations (registered_by_user_id);

CREATE TABLE IF NOT EXISTS sales_agent_targets (
    user_id VARCHAR PRIMARY KEY REFERENCES users(id),
    monthly_target DOUBLE PRECISION NOT NULL DEFAULT 0,
    commission_band VARCHAR NOT NULL DEFAULT 'standard',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
