-- ════════════════════════════════════════════════════════════════════════════
--  MINDEASE DATABASE SETUP (PERMANENT STORAGE)
--  Run this entire script in your Supabase SQL Editor to make features permanent!
-- ════════════════════════════════════════════════════════════════════════════

-- 1. CONSULT REQUESTS TABLE
-- Stores requests sent from students to therapists
CREATE TABLE IF NOT EXISTS public.consult_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    therapist_id UUID NOT NULL,
    student_name TEXT,
    student_email TEXT,
    status TEXT DEFAULT 'pending'::text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for consult_requests (permissive for demo)
ALTER TABLE public.consult_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own requests" 
ON public.consult_requests 
FOR INSERT 
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can view relevant requests" 
ON public.consult_requests 
FOR SELECT 
USING (auth.uid() = student_id OR auth.uid() = therapist_id);

CREATE POLICY "Therapists can update requests" 
ON public.consult_requests 
FOR UPDATE 
USING (auth.uid() = therapist_id);


-- 2. CHAT MESSAGES TABLE
-- Stores real-time chat data between users
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for chat_messages (permissive for demo)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own chat messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view chats they sent or received" 
ON public.chat_messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
