-- Drop and recreate view with correct column mapping
DROP VIEW IF EXISTS latest_prices_view;

CREATE VIEW latest_prices_view AS
WITH ranked AS (
  SELECT
    commodity_id,
    price,
    min_price,
    max_price,
    mandi_name,
    mandi_location,
    state,
    recorded_at,
    source,
    ROW_NUMBER() OVER (PARTITION BY commodity_id ORDER BY recorded_at DESC) AS rn
  FROM price_data
  WHERE price > 0
),
latest AS (
  SELECT * FROM ranked WHERE rn = 1
),
prev_day AS (
  SELECT
    commodity_id,
    price AS prev_price,
    ROW_NUMBER() OVER (PARTITION BY commodity_id ORDER BY recorded_at DESC) AS rn
  FROM price_data
  WHERE price > 0
    AND recorded_at < CURRENT_DATE
),
prev AS (
  SELECT * FROM prev_day WHERE rn = 1
)
SELECT
  c.id            AS commodity_id,
  c.name          AS commodity_name,
  c.icon,
  c.unit,
  c.category,
  COALESCE(l.price, 0)                                              AS current_price,
  COALESCE(l.min_price, 0)                                          AS min_price,
  COALESCE(l.max_price, 0)                                          AS max_price,
  COALESCE(l.price - p.prev_price, 0)                               AS price_change,
  CASE
    WHEN COALESCE(p.prev_price, 0) > 0
    THEN ROUND(((l.price - p.prev_price) / p.prev_price * 100)::numeric, 2)
    ELSE 0
  END                                                               AS change_percent,
  COALESCE(l.mandi_name, 'N/A')                                    AS mandi_name,
  COALESCE(l.mandi_location, '')                                    AS mandi_location,
  COALESCE(l.state, 'Tamil Nadu')                                   AS state,
  l.recorded_at,
  COALESCE(l.source, 'unknown')                                     AS source
FROM commodities c
LEFT JOIN latest l ON l.commodity_id = c.id
LEFT JOIN prev   p ON p.commodity_id = c.id;

-- Allow public read
ALTER VIEW latest_prices_view OWNER TO postgres;

-- Verify
SELECT commodity_name, current_price, mandi_name, source
FROM latest_prices_view
ORDER BY commodity_name
LIMIT 5;
