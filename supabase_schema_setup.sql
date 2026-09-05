-- 1. Create Tables

-- Analytics Table
CREATE TABLE IF NOT EXISTS public.analytics (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    platform text not null,
    total_views bigint default 0,
    total_followers bigint default 0,
    engagement_rate numeric default 0,
    estimated_revenue numeric default 0,
    updated_at timestamp with time zone default now(),
    UNIQUE(user_id, platform) -- Ensure one active row per platform per user
);

-- Content Table
CREATE TABLE IF NOT EXISTS public.content (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    platform text not null,
    views bigint default 0,
    engagement numeric default 0,
    thumbnail_url text,
    published_at timestamp with time zone default now()
);

-- Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    content_id uuid references public.content(id) on delete cascade not null,
    author_name text not null,
    author_avatar text,
    text text not null,
    created_at timestamp with time zone default now()
);

-- Schedule Table
CREATE TABLE IF NOT EXISTS public.schedule (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    platform text not null,
    scheduled_for timestamp with time zone not null,
    status text default 'draft' check (status in ('draft', 'scheduled', 'published'))
);


-- 2. Enable Row Level Security (RLS)

ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;


-- 3. Create RLS Policies for Authenticated Users

-- Analytics Policy
CREATE POLICY "Users can manage their own analytics" ON public.analytics
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Content Policy
CREATE POLICY "Users can manage their own content" ON public.content
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Comments Policy
CREATE POLICY "Users can manage their own comments" ON public.comments
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Schedule Policy
CREATE POLICY "Users can manage their own schedule" ON public.schedule
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- 4. Enable Realtime for these tables
-- Add tables to the supabase_realtime publication
begin;
  -- Note: We use exception handling block implicitly by just executing, 
  -- but standard ALTER PUBLICATION usually works cleanly if tables aren't already there.
  -- In case they are, you might get a warning which is safe to ignore.
  alter publication supabase_realtime add table public.analytics;
  alter publication supabase_realtime add table public.content;
  alter publication supabase_realtime add table public.comments;
  alter publication supabase_realtime add table public.schedule;
commit;
