-- V3: per-society product catalog, so deals are opened by picking a product instead of retyping it.
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY,
    society_id  UUID          NOT NULL REFERENCES societies (id),
    sku         VARCHAR(100)  NOT NULL,
    name        VARCHAR(255)  NOT NULL,
    image_url   VARCHAR(500),
    category    VARCHAR(100)  NOT NULL DEFAULT 'General',
    unit        VARCHAR(50)   NOT NULL DEFAULT 'unit',
    base_price  NUMERIC(10, 2) NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_products_society_sku UNIQUE (society_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_society ON products (society_id);

-- Start the catalog from the products that already have deals, so nothing disappears from the admin's view.
INSERT INTO products (id, society_id, sku, name, image_url, category, unit, base_price)
SELECT gen_random_uuid(),
       society_id,
       product_id,
       MAX(product_name),
       MAX(image_url),
       COALESCE(MAX(category), 'General'),
       COALESCE(MAX(unit), 'unit'),
       MAX(base_price)
FROM pool_windows
GROUP BY society_id, product_id
ON CONFLICT (society_id, sku) DO NOTHING;
