-- Migration: 003_latest_prices_view.sql
-- Adds latest_prices_view (fixes N+1 query bug) and arrivals column

-- ── Add missing columns to price_data ─────────────────────────────
ALTER TABLE public.price_data
  ADD COLUMN IF NOT EXISTS min_price       DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_price       DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS arrivals_tonnes DECIMAL(10,2);

-- ── Unique constraint to enable UPSERT ────────────────────────────
ALTER TABLE public.price_data
  DROP CONSTRAINT IF EXISTS price_data_unique_mandi_date;

ALTER TABLE public.price_data
  ADD CONSTRAINT price_data_unique_mandi_date
  UNIQUE (commodity_id, mandi_name, recorded_at);

-- ── latest_prices_view — replaces N+1 queries ─────────────────────
-- Returns one row per commodity: latest modal price and change % 
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
  COALESCE(l.modal_price - p.modal_price, 0)                        AS price_change,
  CASE
    WHEN p.modal_price > 0
    THEN ROUND(((l.modal_price - p.modal_price) / p.modal_price * 100)::numeric, 2)
    ELSE 0
  END                                                                AS change_percent
FROM public.commodities c
LEFT JOIN latest l ON l.commodity_id = c.id
LEFT JOIN prev   p ON p.commodity_id = c.id;

-- ── unique constraint on predictions for upsert ───────────────────
ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_unique_commodity_date;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_unique_commodity_date
  UNIQUE (commodity_id, prediction_date);

-- ── Index for fast date-range queries ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_price_data_commodity_date
  ON public.price_data (commodity_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_data_state
  ON public.price_data (state);

CREATE INDEX IF NOT EXISTS idx_predictions_date
  ON public.predictions (prediction_date, commodity_id);

-- ── Seed commodities table with tracked vegetables ─────────────────
INSERT INTO public.commodities (name, name_hi, name_ta, name_te, category, unit, icon)
VALUES
  ('Tomato',        'टमाटर',     'தக்காளி',    'టమాట',      'Vegetable', 'kg', '🍅'),
  ('Onion',         'प्याज',      'வெங்காயம்',  'ఉల్లి',      'Vegetable', 'kg', '🧅'),
  ('Potato',        'आलू',        'உருளைக்கிழங்கு', 'బంగాళదుంప', 'Vegetable', 'kg', '🥔'),
  ('Brinjal',       'बैंगन',      'கத்திரிக்காய்', 'వంకాయ',  'Vegetable', 'kg', '🍆'),
  ('Cabbage',       'पत्ता गोभी',  'முட்டைக்கோஸ்', 'క్యాబేజీ', 'Vegetable', 'kg', '🥬'),
  ('Cauliflower',   'फूल गोभी',   'காளிஃப்ளவர்',  'కాలీఫ్లవర్', 'Vegetable', 'kg', '🥦'),
  ('Carrot',        'गाजर',       'கேரட்',       'క్యారెట్',  'Vegetable', 'kg', '🥕'),
  ('Beans',         'बीन्स',      'பீன்ஸ்',      'బీన్స్',     'Vegetable', 'kg', '🫘'),
  ('Capsicum',      'शिमला मिर्च', 'குடைமிளகாய்', 'క్యాప్సికమ్', 'Vegetable', 'kg', '🫑'),
  ('Lady Finger',   'भिंडी',      'வெண்டைக்காய்', 'బెండకాయ', 'Vegetable', 'kg', '🫛'),
  ('Bitter Gourd',  'करेला',      'பாவக்காய்',   'కారేళ్ళు',   'Vegetable', 'kg', '🥒'),
  ('Bottle Gourd',  'लौकी',       'சுரைக்காய்',  'సొరకాయ',    'Vegetable', 'kg', '🍾'),
  ('Drumstick',     'सहजन',       'முருங்கைக்காய்', 'మునగకాయ', 'Vegetable', 'kg', '🌿'),
  ('Pumpkin',       'कद्दू',      'பூசணிக்காய்', 'గుమ్మడికాయ', 'Vegetable', 'kg', '🎃'),
  ('Spinach',       'पालक',       'பசலைக்கீரை',  'పాలకూర',    'Vegetable', 'kg', '🌿')
ON CONFLICT (name) DO NOTHING;
