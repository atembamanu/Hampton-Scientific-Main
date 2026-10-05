-- Facility organization schema (Phase 1-2)

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    facility_type VARCHAR NOT NULL,
    registration_number VARCHAR,
    tax_number VARCHAR,
    phone VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    website VARCHAR,
    address_line VARCHAR NOT NULL,
    county VARCHAR,
    country VARCHAR DEFAULT 'Kenya',
    is_multi_branch BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(id),
    name VARCHAR NOT NULL,
    branch_code VARCHAR NOT NULL,
    contact_name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    physical_address VARCHAR NOT NULL,
    delivery_address VARCHAR,
    county VARCHAR,
    status VARCHAR DEFAULT 'active',
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (organization_id, branch_code)
);

CREATE TABLE IF NOT EXISTS user_branch_assignments (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    branch_id VARCHAR NOT NULL REFERENCES branches(id),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS delivery_locations (
    id VARCHAR PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(id),
    branch_id VARCHAR REFERENCES branches(id),
    label VARCHAR NOT NULL,
    contact_name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    address_line VARCHAR NOT NULL,
    county VARCHAR,
    country VARCHAR DEFAULT 'Kenya',
    delivery_instructions TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ordered_by_user_id VARCHAR REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ordered_for_branch_id VARCHAR REFERENCES branches(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_location_id VARCHAR REFERENCES delivery_locations(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_snapshot JSONB;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR REFERENCES branches(id);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR PRIMARY KEY,
    order_number VARCHAR UNIQUE NOT NULL,
    organization_id VARCHAR NOT NULL REFERENCES organizations(id),
    ordered_by_user_id VARCHAR NOT NULL REFERENCES users(id),
    ordered_for_branch_id VARCHAR NOT NULL REFERENCES branches(id),
    delivery_location_id VARCHAR REFERENCES delivery_locations(id),
    quote_id VARCHAR REFERENCES quotes(id),
    status VARCHAR DEFAULT 'quote_requested',
    delivery_snapshot JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR PRIMARY KEY,
    order_id VARCHAR NOT NULL REFERENCES orders(id),
    product_id VARCHAR,
    product_name VARCHAR NOT NULL,
    category VARCHAR,
    quantity INTEGER DEFAULT 1,
    unit_price FLOAT DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);
