-- Fix latest_prices_view to use price column (not modal_price)
DROP VIEW IF EXISTS latest_prices_view;

CREATE OR REPLACE VIEW latest_prices_view AS
WITH latest AS (
  SELECT DISTINCT ON (commodity_id)
    commodity_id,
    price          AS current_price,
    min_price,
    max_price,
    mandi_name,
    mandi_location,
    state,
    recorded_at,
    source
  FROM price_data
  ORDER BY commodity_id, recorded_at DESC
),
prev AS (
  SELECT DISTINCT ON (commodity_id)
    commodity_id,
    price AS prev_price
  FROM price_data
  WHERE recorded_at < CURRENT_DATE
  ORDER BY commodity_id, recorded_at DESC
)
SELECT
  c.id            AS commodity_id,
  c.name          AS commodity_name,
  c.icon,
  c.unit,
  c.category,
  l.current_price,
  l.min_price,
  l.max_price,
  COALESCE(l.current_price - p.prev_price, 0) AS price_change,
  CASE
    WHEN p.prev_price > 0
    THEN ROUND(((l.current_price - p.prev_price) / p.prev_price * 100)::numeric, 2)
    ELSE 0
  END AS change_percent,
  l.mandi_name,
  l.mandi_location,
  l.state,
  l.recorded_at,
  l.source
FROM commodities c
LEFT JOIN latest l ON l.commodity_id = c.id
LEFT JOIN prev   p ON p.commodity_id = c.id;
