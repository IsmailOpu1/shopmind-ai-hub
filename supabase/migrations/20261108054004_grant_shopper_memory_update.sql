-- Owners update businesses through column grants; the shopper_memory switch
-- was added without one, so saving Chatbot settings was refused.
GRANT UPDATE (shopper_memory) ON public.businesses TO authenticated;
