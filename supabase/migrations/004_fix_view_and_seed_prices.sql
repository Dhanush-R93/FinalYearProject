-- Migration: 004_fix_view_and_seed_prices.sql
-- ─────────────────────────────────────────────────────────────
-- 1. Add `source` column to price_data (if missing)
-- 2. Recreate latest_prices_view to include `source` column
--    (fixes "source is always null" bug in PriceDashboard)
-- 3. Seed sample price_data so the dashboard shows data
--    before the daily pipeline has run
-- ─────────────────────────────────────────────────────────────

-- ── 1. Ensure source column exists ───────────────────────────
ALTER TABLE public.price_data
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'agmarknet';

-- ── 2. Recreate view with source column ──────────────────────
CREATE OR REPLACE VIEW public.latest_prices_view AS
WITH ranked AS (
  SELECT
    pd.commodity_id,
    pd.price        AS modal_price,
    pd.min_price,
    pd.max_price,
    pd.mandi_name,
    pd.state,
    pd.source,
    pd.recorded_at,
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
  l.source,                            -- ✅ Fixed: source column now exposed
  l.recorded_at,
  COALESCE(l.modal_price - p.modal_price, 0)                        AS price_change,
  CASE
    WHEN p.modal_price > 0
    THEN ROUND(((l.modal_price - p.modal_price) / p.modal_price * 100)::numeric, 2)
    ELSE 0
  END                                                                AS change_percent
FROM public.commodities c
LEFT JOIN latest l ON l.commodity_id = c.id
LEFT JOIN prev   p ON p.commodity_id = c.id;

-- ── 3. Seed sample price data (2 days: yesterday + today) ────
-- This ensures the dashboard shows data even before the
-- automated daily pipeline has fetched from data.gov.in.
-- The `source` is marked as 'simulated' so the UI shows the
-- amber "Simulated" badge until real data arrives.

DO $$
DECLARE
  v_commodity RECORD;
  v_today     TIMESTAMP WITH TIME ZONE := NOW();
  v_yesterday TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '1 day';

  -- Base prices (INR/quintal) — approximate market prices
  base_prices JSONB := '{
    "Tomato":       2000,
    "Onion":        1500,
    "Potato":       1200,
    "Brinjal":      1800,
    "Cabbage":       800,
    "Cauliflower":  1500,
    "Carrot":       2000,
    "Beans":        3000,
    "Capsicum":     3500,
    "Lady Finger":  2500,
    "Bitter Gourd": 2800,
    "Bottle Gourd":  800,
    "Drumstick":    2200,
    "Pumpkin":       900,
    "Spinach":      1000
  }';

  v_base      NUMERIC;
  v_today_p   NUMERIC;
  v_yest_p    NUMERIC;

BEGIN
  FOR v_commodity IN SELECT id, name FROM public.commodities LOOP
    v_base    := COALESCE((base_prices ->> v_commodity.name)::NUMERIC, 1500);
    -- Add slight random variation (±5%) — deterministic based on commodity name length
    v_today_p := ROUND(v_base * (1 + (LENGTH(v_commodity.name) % 10 - 5) * 0.01), 2);
    v_yest_p  := ROUND(v_base * (1 + (LENGTH(v_commodity.name) % 7  - 3) * 0.01), 2);

    -- Yesterday's price
    INSERT INTO public.price_data
      (commodity_id, price, min_price, max_price, mandi_name, mandi_location, state, recorded_at, source)
    VALUES (
      v_commodity.id,
      v_yest_p,
      ROUND(v_yest_p * 0.85, 2),
      ROUND(v_yest_p * 1.15, 2),
      'Koyambedu',
      'Chennai',
      'Tamil Nadu',
      v_yesterday,
      'simulated'
    )
    ON CONFLICT (commodity_id, mandi_name, recorded_at) DO NOTHING;

    -- Today's price
    INSERT INTO public.price_data
      (commodity_id, price, min_price, max_price, mandi_name, mandi_location, state, recorded_at, source)
    VALUES (
      v_commodity.id,
      v_today_p,
      ROUND(v_today_p * 0.85, 2),
      ROUND(v_today_p * 1.15, 2),
      'Koyambedu',
      'Chennai',
      'Tamil Nadu',
      v_today,
      'simulated'
    )
    ON CONFLICT (commodity_id, mandi_name, recorded_at) DO NOTHING;

  END LOOP;
END $$;
