-- V2: sign-in (residents), order ownership + idempotency, and per-pool controls.
-- V1 is intentionally untouched (Flyway checksums). Everything here is additive and re-runnable.

-- ---------------------------------------------------------------------------
-- Residents (people who sign in with a phone OTP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS residents (
    id           UUID PRIMARY KEY,
    society_id   UUID         NOT NULL REFERENCES societies (id),
    phone        VARCHAR(15)  NOT NULL,
    name         VARCHAR(120),
    email        VARCHAR(255),
    flat_number  VARCHAR(20),
    role         VARCHAR(30)  NOT NULL DEFAULT 'RESIDENT',
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_residents_phone UNIQUE (phone),
    CONSTRAINT chk_residents_role CHECK (role IN ('RESIDENT', 'SOCIETY_ADMIN', 'PLATFORM_ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_residents_society ON residents (society_id);

-- ---------------------------------------------------------------------------
-- Pool controls used by the admin UI
-- ---------------------------------------------------------------------------
ALTER TABLE pool_windows ADD COLUMN IF NOT EXISTS floor_price             NUMERIC(10, 2);
ALTER TABLE pool_windows ADD COLUMN IF NOT EXISTS max_quantity_per_order  INTEGER NOT NULL DEFAULT 20;
ALTER TABLE pool_windows ADD COLUMN IF NOT EXISTS dispatched_at           TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- Orders belong to a resident; "join" is idempotent and one active order per resident per pool
-- ---------------------------------------------------------------------------
ALTER TABLE pool_orders ADD COLUMN IF NOT EXISTS resident_id      UUID REFERENCES residents (id);
ALTER TABLE pool_orders ADD COLUMN IF NOT EXISTS idempotency_key  VARCHAR(100);

-- Residents sign in by phone and may have no email.
ALTER TABLE pool_orders ALTER COLUMN resident_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pool_orders_resident ON pool_orders (resident_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pool_orders_idempotency
    ON pool_orders (resident_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pool_orders_one_active_per_resident
    ON pool_orders (pool_window_id, resident_id)
    WHERE resident_id IS NOT NULL AND status <> 'CANCELLED';
