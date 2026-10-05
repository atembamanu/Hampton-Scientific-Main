CREATE TABLE IF NOT EXISTS sales_agent_counties (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    county VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales_agent_county UNIQUE (user_id, county)
);

CREATE INDEX IF NOT EXISTS ix_sales_agent_counties_user_id ON sales_agent_counties (user_id);

CREATE TABLE IF NOT EXISTS sales_prospects (
    id VARCHAR PRIMARY KEY,
    agent_id VARCHAR NOT NULL REFERENCES users(id),
    organization_id VARCHAR REFERENCES organizations(id),
    facility_name VARCHAR NOT NULL,
    facility_name_key VARCHAR NOT NULL,
    facility_type VARCHAR NOT NULL DEFAULT 'other',
    county VARCHAR NOT NULL,
    address TEXT,
    facility_phone VARCHAR,
    facility_email VARCHAR,
    contact_name VARCHAR,
    contact_title VARCHAR,
    contact_phone VARCHAR,
    contact_email VARCHAR,
    notes TEXT,
    probability INTEGER,
    visit_count INTEGER NOT NULL DEFAULT 0,
    last_visited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_sales_prospects_agent_id ON sales_prospects (agent_id);
CREATE INDEX IF NOT EXISTS ix_sales_prospects_organization_id ON sales_prospects (organization_id);
CREATE INDEX IF NOT EXISTS ix_sales_prospects_name_key ON sales_prospects (facility_name_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_prospect_name
    ON sales_prospects (agent_id, facility_name_key, county);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_prospect_org
    ON sales_prospects (agent_id, organization_id)
    WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_visits (
    id VARCHAR PRIMARY KEY,
    prospect_id VARCHAR NOT NULL REFERENCES sales_prospects(id),
    agent_id VARCHAR NOT NULL REFERENCES users(id),
    checked_in_at TIMESTAMP NOT NULL,
    check_in_latitude DOUBLE PRECISION NOT NULL,
    check_in_longitude DOUBLE PRECISION NOT NULL,
    check_in_accuracy_m DOUBLE PRECISION,
    checked_out_at TIMESTAMP,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    check_out_accuracy_m DOUBLE PRECISION,
    facility_name VARCHAR NOT NULL,
    facility_type VARCHAR NOT NULL DEFAULT 'other',
    county VARCHAR NOT NULL,
    address TEXT,
    facility_phone VARCHAR,
    facility_email VARCHAR,
    contact_name VARCHAR,
    contact_title VARCHAR,
    contact_phone VARCHAR,
    contact_email VARCHAR,
    notes TEXT,
    probability INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_sales_visits_prospect_id ON sales_visits (prospect_id);
CREATE INDEX IF NOT EXISTS ix_sales_visits_agent_id ON sales_visits (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_open_visit
    ON sales_visits (agent_id)
    WHERE checked_out_at IS NULL;
