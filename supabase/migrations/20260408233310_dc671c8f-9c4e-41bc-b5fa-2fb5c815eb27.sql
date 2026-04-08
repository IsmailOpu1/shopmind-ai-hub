
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own businesses"
ON public.businesses FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own businesses"
ON public.businesses FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own businesses"
ON public.businesses FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own businesses"
ON public.businesses FOR DELETE
USING (auth.uid() = owner_id);
