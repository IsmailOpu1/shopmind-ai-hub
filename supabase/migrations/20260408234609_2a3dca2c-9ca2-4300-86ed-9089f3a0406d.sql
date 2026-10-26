
-- Add chatbot settings columns to businesses
ALTER TABLE public.businesses
ADD COLUMN bot_name text NOT NULL DEFAULT 'ShopMind AI',
ADD COLUMN greeting text NOT NULL DEFAULT 'Hi! How can I help you today?';

-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric,
  image_url text,
  category text,
  stock_status text NOT NULL DEFAULT 'in_stock',
  promo text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their products" ON public.products
FOR SELECT USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can insert their products" ON public.products
FOR INSERT WITH CHECK (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can update their products" ON public.products
FOR UPDATE USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can delete their products" ON public.products
FOR DELETE USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- Create conversations table
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their conversations" ON public.conversations
FOR SELECT USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can insert their conversations" ON public.conversations
FOR INSERT WITH CHECK (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can update their conversations" ON public.conversations
FOR UPDATE USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Owners can delete their conversations" ON public.conversations
FOR DELETE USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- Create messages table
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their messages" ON public.messages
FOR SELECT USING (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = auth.uid()
  )
);
CREATE POLICY "Owners can insert their messages" ON public.messages
FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = auth.uid()
  )
);
CREATE POLICY "Owners can update their messages" ON public.messages
FOR UPDATE USING (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = auth.uid()
  )
);
CREATE POLICY "Owners can delete their messages" ON public.messages
FOR DELETE USING (
  conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = auth.uid()
  )
);
