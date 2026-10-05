ALTER TABLE sales_visits ALTER COLUMN check_in_latitude DROP NOT NULL;
ALTER TABLE sales_visits ALTER COLUMN check_in_longitude DROP NOT NULL;

CREATE TABLE IF NOT EXISTS sales_workdays (
    id VARCHAR PRIMARY KEY,
    agent_id VARCHAR NOT NULL REFERENCES users(id),
    work_date DATE NOT NULL,
    checked_in_at TIMESTAMP NOT NULL,
    checked_out_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sales_workday UNIQUE (agent_id, work_date)
);
CREATE INDEX IF NOT EXISTS ix_sales_workdays_agent ON sales_workdays (agent_id);
