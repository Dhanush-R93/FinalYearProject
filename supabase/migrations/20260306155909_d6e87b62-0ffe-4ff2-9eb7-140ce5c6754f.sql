CREATE POLICY "Authenticated users can insert news"
ON public.market_news
FOR INSERT
TO authenticated
WITH CHECK (true);