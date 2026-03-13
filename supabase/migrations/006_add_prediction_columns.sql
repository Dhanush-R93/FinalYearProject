-- Add confidence bands and horizon_days to predictions table
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS confidence_lower DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS confidence_upper DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS horizon_days INTEGER DEFAULT 1;

-- Add unique constraint for upsert
ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_commodity_date_unique;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_commodity_date_unique
  UNIQUE (commodity_id, prediction_date);
