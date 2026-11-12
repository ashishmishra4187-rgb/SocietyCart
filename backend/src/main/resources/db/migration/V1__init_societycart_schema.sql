-- V1__init_societycart_schema.sql
-- SocietyCart PostgreSQL 18 Initial Schema with Spatial Coordinates & Tiered Pricing

-- 1. Societies
CREATE TABLE IF NOT EXISTS societies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    society_code VARCHAR(50) NOT NULL UNIQUE,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    delivery_gate_note VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_societies_geo ON societies (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_societies_code ON societies (society_code);

-- 2. Pool Windows (Batched Demand Aggregation Cycles)
CREATE TABLE IF NOT EXISTS pool_windows (
    id UUID PRIMARY KEY,
    society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    image_url VARCHAR(500),
    base_price NUMERIC(10, 2) NOT NULL,
    current_unit_price NUMERIC(10, 2) NOT NULL,
    current_total_quantity INTEGER NOT NULL DEFAULT 0,
    target_volume_threshold INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_delivery_date DATE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pool_windows_society_id ON pool_windows (society_id);
CREATE INDEX IF NOT EXISTS idx_pool_windows_status ON pool_windows (status);
CREATE INDEX IF NOT EXISTS idx_pool_windows_end_time ON pool_windows (end_time);

-- 3. Dynamic Price Tiers
CREATE TABLE IF NOT EXISTS price_tiers (
    id UUID PRIMARY KEY,
    pool_window_id UUID NOT NULL REFERENCES pool_windows(id) ON DELETE CASCADE,
    tier_level INTEGER NOT NULL,
    min_quantity INTEGER NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    description VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_price_tiers_pool ON price_tiers (pool_window_id, min_quantity);

-- 4. Pool Orders (Resident Orders)
CREATE TABLE IF NOT EXISTS pool_orders (
    id UUID PRIMARY KEY,
    pool_window_id UUID NOT NULL REFERENCES pool_windows(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    resident_name VARCHAR(255) NOT NULL,
    resident_email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    flat_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    initial_unit_price NUMERIC(10, 2) NOT NULL,
    final_settled_unit_price NUMERIC(10, 2),
    total_paid NUMERIC(10, 2) NOT NULL,
    total_savings NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pool_orders_window ON pool_orders (pool_window_id);
CREATE INDEX IF NOT EXISTS idx_pool_orders_email ON pool_orders (resident_email);
CREATE INDEX IF NOT EXISTS idx_pool_orders_status ON pool_orders (status);

-- 5. Pool Order Items
CREATE TABLE IF NOT EXISTS pool_order_items (
    id UUID PRIMARY KEY,
    pool_order_id UUID NOT NULL REFERENCES pool_orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pool_order_items_order ON pool_order_items (pool_order_id);

-- Sample Data Seeding
INSERT INTO societies (id, name, society_code, address_line, city, state, postal_code, latitude, longitude, geofence_radius_meters, delivery_gate_note, active, created_at, updated_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Prestige Lakeside Habitat', 'PLH-BLR-01', 'Varthur Main Road, Whitefield', 'Bengaluru', 'Karnataka', '560087', 12.9558, 77.7471, 600.0, 'Gate 2 Security Hub - Drop near Tower 12 Clubhouse', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('22222222-2222-2222-2222-222222222222', 'Sobha Dream Acres', 'SDA-BLR-02', 'Panathur Road, Balagere', 'Bengaluru', 'Karnataka', '560087', 12.9365, 77.7289, 500.0, 'Gate 1 Main Gate - Delivery Bay A', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (society_code) DO NOTHING;

-- Seed Sample Pool Window 1 (Aashirvaad Atta 10kg)
INSERT INTO pool_windows (id, society_id, product_id, product_name, product_description, category, unit, image_url, base_price, current_unit_price, current_total_quantity, target_volume_threshold, status, start_time, end_time, expected_delivery_date, version, created_at, updated_at)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'CPG-ATTA-10KG',
    'Aashirvaad Shudh Chakki Atta (10kg)',
    '100% whole wheat flour, fiber-rich. Direct procurement from flour mills.',
    'Staples & Grains',
    '10 kg Bag',
    'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80',
    450.00,
    427.50,
    14,
    50,
    'OPEN',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '24 HOURS',
    CURRENT_DATE + 2,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Seed Price Tiers for Pool Window 1
INSERT INTO price_tiers (id, pool_window_id, tier_level, min_quantity, discount_percentage, unit_price, description)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 1, 0.00, 450.00, 'Tier 1: MSRP (1-9 bags)'),
    ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 10, 5.00, 427.50, 'Tier 2: Community Saver (10-24 bags) - 5% OFF'),
    ('a3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 25, 12.00, 396.00, 'Tier 3: Bulk Power (25-49 bags) - 12% OFF'),
    ('a4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, 50, 20.00, 360.00, 'Tier 4: Wholesale Jackpot (50+ bags) - 20% OFF')
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Pool Window 2 (Fortune Sunflower Oil 5L)
INSERT INTO pool_windows (id, society_id, product_id, product_name, product_description, category, unit, image_url, base_price, current_unit_price, current_total_quantity, target_volume_threshold, status, start_time, end_time, expected_delivery_date, version, created_at, updated_at)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'CPG-OIL-5L',
    'Fortune Sunlite Refined Sunflower Oil (5L Can)',
    'Refined sunflower oil enriched with Vitamins A & D. Direct wholesale distributor pack.',
    'Cooking Oils',
    '5 Liter Can',
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
    750.00,
    690.00,
    28,
    60,
    'OPEN',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '18 HOURS',
    CURRENT_DATE + 2,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Seed Price Tiers for Pool Window 2
INSERT INTO price_tiers (id, pool_window_id, tier_level, min_quantity, discount_percentage, unit_price, description)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 1, 0.00, 750.00, 'Tier 1: Retail Price (1-9 cans)'),
    ('b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 10, 4.00, 720.00, 'Tier 2: Neighborhood Tier (10-24 cans) - 4% OFF'),
    ('b3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 3, 25, 8.00, 690.00, 'Tier 3: Society Bulk (25-49 cans) - 8% OFF'),
    ('b4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, 50, 15.00, 637.50, 'Tier 4: Maximum Distributor Bulk (50+ cans) - 15% OFF')
ON CONFLICT (id) DO NOTHING;
