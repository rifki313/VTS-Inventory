/*
# Create branch-admin chat messages

1. New Tables
- `chat_messages`
- `id` (text, primary key): unique message identifier.
- `branch_id` (text, not null): branch conversation identifier.
- `branch_name` (text, not null): branch label shown in the admin inbox.
- `sender_role` (text, not null): either `branch` or `admin`.
- `sender_name` (text, not null): display name of the sender.
- `message` (text, not null): chat content.
- `created_at` (timestamptz): message creation time.

2. Security
- Enable row level security on `chat_messages`.
- Allow the current demo-login application to read and write chat messages through the anon key.
- The frontend scopes branch views to the logged-in demo branch and admin views to the full inbox.

3. Important Notes
- The existing application uses local demo credentials rather than Supabase Auth, so database-level identity enforcement is not possible without changing the login system.
- No existing tables or user data are modified.
*/

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text PRIMARY KEY,
  branch_id text NOT NULL,
  branch_name text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('branch', 'admin')),
  sender_name text NOT NULL,
  message text NOT NULL CHECK (length(trim(message)) > 0 AND length(message) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select_demo_app" ON public.chat_messages;
CREATE POLICY "chat_messages_select_demo_app" ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "chat_messages_insert_demo_app" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_demo_app" ON public.chat_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "chat_messages_update_demo_app" ON public.chat_messages;
CREATE POLICY "chat_messages_update_demo_app" ON public.chat_messages
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chat_messages_delete_demo_app" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_demo_app" ON public.chat_messages
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS chat_messages_branch_created_at_idx
  ON public.chat_messages (branch_id, created_at);
