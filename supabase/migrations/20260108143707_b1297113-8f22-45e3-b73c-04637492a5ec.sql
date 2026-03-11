-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  avatar_url TEXT,
  role TEXT DEFAULT 'farmer' CHECK (role IN ('farmer', 'trader', 'consumer', 'admin')),
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create commodities table
CREATE TABLE public.commodities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_hi TEXT,
  name_te TEXT,
  name_ta TEXT,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_data table for historical and current prices
CREATE TABLE public.price_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity_id UUID REFERENCES public.commodities(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  mandi_name TEXT NOT NULL,
  mandi_location TEXT,
  state TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'agmarknet'
);

-- Create predictions table for LSTM model predictions
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity_id UUID REFERENCES public.commodities(id) ON DELETE CASCADE NOT NULL,
  predicted_price DECIMAL(10,2) NOT NULL,
  confidence_score DECIMAL(5,2),
  prediction_date DATE NOT NULL,
  prediction_horizon TEXT DEFAULT '7_days',
  model_version TEXT DEFAULT 'lstm_v1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_alerts table
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  commodity_id UUID REFERENCES public.commodities(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below', 'crash', 'spike')),
  threshold_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_news table
CREATE TABLE public.market_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  category TEXT DEFAULT 'general',
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mandi_arbitrage table for arbitrage opportunities
CREATE TABLE public.mandi_arbitrage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity_id UUID REFERENCES public.commodities(id) ON DELETE CASCADE NOT NULL,
  source_mandi TEXT NOT NULL,
  source_price DECIMAL(10,2) NOT NULL,
  destination_mandi TEXT NOT NULL,
  destination_price DECIMAL(10,2) NOT NULL,
  price_difference DECIMAL(10,2) NOT NULL,
  distance_km INTEGER,
  transport_cost_estimate DECIMAL(10,2),
  profit_potential DECIMAL(10,2),
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create marketplace_listings table for farmer marketplace
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  commodity_id UUID REFERENCES public.commodities(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  images TEXT[],
  quality_grade TEXT CHECK (quality_grade IN ('A', 'B', 'C')),
  harvest_date DATE,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_arbitrage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Commodities are public read
CREATE POLICY "Anyone can view commodities" ON public.commodities FOR SELECT USING (true);

-- Price data is public read
CREATE POLICY "Anyone can view price data" ON public.price_data FOR SELECT USING (true);

-- Predictions are public read
CREATE POLICY "Anyone can view predictions" ON public.predictions FOR SELECT USING (true);

-- Price alerts policies
CREATE POLICY "Users can view their own alerts" ON public.price_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own alerts" ON public.price_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own alerts" ON public.price_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own alerts" ON public.price_alerts FOR DELETE USING (auth.uid() = user_id);

-- Market news is public read
CREATE POLICY "Anyone can view market news" ON public.market_news FOR SELECT USING (true);

-- Mandi arbitrage is public read
CREATE POLICY "Anyone can view arbitrage opportunities" ON public.mandi_arbitrage FOR SELECT USING (true);

-- Marketplace listings policies
CREATE POLICY "Anyone can view available listings" ON public.marketplace_listings FOR SELECT USING (is_available = true);
CREATE POLICY "Users can view their own listings" ON public.marketplace_listings FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Users can create listings" ON public.marketplace_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update their own listings" ON public.marketplace_listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Users can delete their own listings" ON public.marketplace_listings FOR DELETE USING (auth.uid() = seller_id);

-- Chat conversations policies
CREATE POLICY "Users can view their own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anonymous can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (user_id IS NULL);
CREATE POLICY "Anonymous can view anonymous conversations" ON public.chat_conversations FOR SELECT USING (user_id IS NULL);

-- Chat messages policies
CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.chat_conversations WHERE id = conversation_id AND (user_id = auth.uid() OR user_id IS NULL)));
CREATE POLICY "Users can insert messages in their conversations" ON public.chat_messages FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_conversations WHERE id = conversation_id AND (user_id = auth.uid() OR user_id IS NULL)));

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for price updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;