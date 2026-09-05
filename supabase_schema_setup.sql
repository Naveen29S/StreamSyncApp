-- StreamSync Database Schema Setup
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create Profiles Table (must exist first so other tables can reference it)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text,
    avatar_url text,
    dob text,
    connected_platforms text[] default '{}',
    api_keys jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 2. Create Analytics Table
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

-- 3. Create Content Table
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

-- 4. Create Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    content_id uuid references public.content(id) on delete cascade not null,
    author_name text not null,
    author_avatar text,
    text text not null,
    created_at timestamp with time zone default now()
);

-- 5. Create Schedule Table
CREATE TABLE IF NOT EXISTS public.schedule (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    platform text not null,
    scheduled_for timestamp with time zone not null,
    status text default 'draft' check (status in ('draft', 'scheduled', 'published'))
);


-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;


-- 7. Create RLS Policies for Authenticated Users

-- Profiles Policy
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

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


-- 8. Auth Trigger to Automatically Create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO UPDATE SET email = excluded.email;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users if any
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- 9. Enable Realtime for Tables
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
