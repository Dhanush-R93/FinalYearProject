-- market_news table
CREATE TABLE IF NOT EXISTS public.market_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  source TEXT DEFAULT 'AgriPrice',
  category TEXT DEFAULT 'general',
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- marketplace_listings table
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  commodity_id UUID REFERENCES public.commodities(id),
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  quantity DECIMAL(10,2),
  unit TEXT DEFAULT 'kg',
  location TEXT,
  state TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- price_alerts table
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  commodity_id UUID REFERENCES public.commodities(id),
  alert_type TEXT DEFAULT 'above',
  threshold_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'farmer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: allow public read on market_news
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone can read news" ON public.market_news FOR SELECT USING (true);

-- Seed some sample news
INSERT INTO public.market_news (title, summary, source, category, published_at) VALUES
('Tomato prices surge 20% in Tamil Nadu markets', 'Heavy rains in Kolar district affected tomato supply leading to price increase across Tamil Nadu mandis.', 'AgriPrice', 'price_alert', now() - interval '1 day'),
('Onion procurement drive by Tamil Nadu government', 'State government announces procurement of onion at minimum support price to protect farmer interests.', 'The Hindu', 'policy', now() - interval '2 days'),
('Koyambedu APMC records highest vegetable arrivals this season', 'Chennai wholesale market sees 15% increase in vegetable arrivals compared to last month.', 'AgriPrice', 'market', now() - interval '3 days'),
('New cold storage facility opens in Coimbatore', 'Farmers can now store vegetables for up to 30 days reducing post-harvest losses significantly.', 'AgriPrice', 'infrastructure', now() - interval '4 days'),
('IMD predicts normal monsoon for Tamil Nadu 2026', 'Normal monsoon expected to boost kharif crop production across the state.', 'IMD', 'weather', now() - interval '5 days'),
('Digital mandi platform launched for direct farmer sales', 'New platform allows farmers to sell directly to consumers bypassing middlemen.', 'AgriPrice', 'technology', now() - interval '6 days')
ON CONFLICT DO NOTHING;
