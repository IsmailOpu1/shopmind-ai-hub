-- Human handoff (PRD v1.0 Phase 3): a chat can be handed to the store's team.
-- 'open': the team owns the chat and the bot stays quiet; 'closed': handed
-- back to the bot; 'none': never handed off.
ALTER TABLE public.conversations
  ADD COLUMN handoff_status text NOT NULL DEFAULT 'none',
  ADD COLUMN handoff_at timestamptz,
  ADD COLUMN handoff_reason text;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_handoff_status_check
  CHECK (handoff_status IN ('none', 'open', 'closed'));
ALTER TABLE public.conversations ADD CONSTRAINT conversations_handoff_reason_check
  CHECK (handoff_reason IS NULL OR char_length(handoff_reason) <= 500);
CREATE INDEX conversations_handoff_open_idx ON public.conversations (business_id, handoff_at DESC)
  WHERE handoff_status <> 'none';

-- Team replies are "agent" messages.
ALTER TABLE public.messages DROP CONSTRAINT messages_role_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'agent'));
ALTER TABLE public.messages ADD CONSTRAINT messages_agent_content_check
  CHECK (role <> 'agent' OR char_length(btrim(content)) BETWEEN 1 AND 2000);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at);

-- Owners reply in their own store's chats (agent messages only) ...
GRANT INSERT (conversation_id, role, content) ON public.messages TO authenticated;
CREATE POLICY "Owners can reply in their conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'agent'
    AND conversation_id IN (
      SELECT c.id FROM public.conversations c
      JOIN public.businesses b ON b.id = c.business_id
      WHERE b.owner_id = (SELECT auth.uid())
    )
  );

-- ... and open or close the handoff on them.
GRANT UPDATE (handoff_status) ON public.conversations TO authenticated;
CREATE POLICY "Owners can update their conversations' handoff" ON public.conversations
  FOR UPDATE TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())))
  WITH CHECK (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

-- An owner who replies takes the chat over (the bot goes quiet).
CREATE FUNCTION public.on_agent_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET handoff_status = 'open', handoff_at = coalesce(handoff_at, now())
  WHERE id = NEW.conversation_id AND handoff_status <> 'open';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.on_agent_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_agent_takes_over AFTER INSERT ON public.messages
  FOR EACH ROW WHEN (NEW.role = 'agent') EXECUTE FUNCTION public.on_agent_message();

-- Opening a handoff records when it started.
CREATE FUNCTION public.on_handoff_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.handoff_status = 'open' AND OLD.handoff_status IS DISTINCT FROM 'open' THEN
    NEW.handoff_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.on_handoff_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER conversations_handoff_change BEFORE UPDATE OF handoff_status ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.on_handoff_change();
