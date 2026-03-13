-- Fix latest_prices_view to include source column
CREATE OR REPLACE VIEW public.latest_prices_view AS
WITH ranked AS (
  SELECT
    pd.commodity_id,
    pd.price        AS modal_price,
    pd.min_price,
    pd.max_price,
    pd.mandi_name,
    pd.state,
    pd.recorded_at,
    pd.source,
    ROW_NUMBER() OVER (
      PARTITION BY pd.commodity_id
      ORDER BY pd.recorded_at DESC
    ) AS rn
  FROM public.price_data pd
),
latest AS (SELECT * FROM ranked WHERE rn = 1),
prev   AS (SELECT * FROM ranked WHERE rn = 2)
SELECT
  c.id            AS commodity_id,
  c.name          AS commodity_name,
  c.icon,
  c.unit,
  c.category,
  l.modal_price   AS current_price,
  l.min_price,
  l.max_price,
  l.mandi_name,
  l.state,
  l.recorded_at,
  l.source,
  COALESCE(l.modal_price - p.modal_price, 0) AS price_change,
  CASE
    WHEN p.modal_price > 0
    THEN ROUND(((l.modal_price - p.modal_price) / p.modal_price * 100)::numeric, 2)
    ELSE 0
  END AS change_percent
FROM public.commodities c
LEFT JOIN latest l ON l.commodity_id = c.id
LEFT JOIN prev   p ON p.commodity_id = c.id;

-- Allow service role to insert/update price_data
CREATE POLICY IF NOT EXISTS "Service role full access price_data"
ON public.price_data FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role full access predictions"  
ON public.predictions FOR ALL USING (true) WITH CHECK (true);
