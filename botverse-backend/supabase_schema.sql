-- ─── BOTVERSE DATABASE SCHEMA ────────────────────────────────────────────────
-- Run this entire file in Supabase → SQL Editor

-- Safe migration: add columns to existing bots table if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='bots' AND column_name='tools') THEN
        ALTER TABLE public.bots ADD COLUMN tools JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='bots' AND column_name='custom_code') THEN
        ALTER TABLE public.bots ADD COLUMN custom_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='bots' AND column_name='likes') THEN
        ALTER TABLE public.bots ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;
END $$;

-- 1. Users (extends Supabase auth.users)
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-populate users table on Google sign-in
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Bots
create table if not exists public.bots (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid references public.users(id) on delete cascade,
  creator_name text,
  name         text not null,
  emoji        text default '🤖',
  color        text default '#6C63FF',
  prompt       text not null,
  type         text default 'character',  -- 'character' | 'utility' | 'study' | 'presentation' | 'mom'
  tag          text default 'Custom',
  tools        jsonb default '[]'::jsonb, -- ['smartboard', 'ppt', 'docs']
  custom_code  text,
  likes        integer default 0,
  is_public    boolean default true,
  created_at   timestamptz default now()
);

-- 3. Messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  bot_id     uuid references public.bots(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  group_id   uuid,                         -- references groups (no FK here to avoid circular)
  role       text not null,                -- 'user' | 'assistant'
  content    text not null,
  display_name text,                       -- for group messages
  created_at timestamptz default now()
);

-- 4. Groups
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text default '💬',
  creator_id  uuid references public.users(id) on delete cascade,
  bot_ids     text[] default '{}',         -- array of bot IDs (can be builtin string IDs too)
  invite_code text unique,
  created_at  timestamptz default now()
);

-- 5. Group members
create table if not exists public.group_members (
  group_id   uuid references public.groups(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  joined_at  timestamptz default now(),
  primary key (group_id, user_id)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_messages_bot_user on public.messages(bot_id, user_id);
create index if not exists idx_messages_group on public.messages(group_id);
create index if not exists idx_bots_creator on public.bots(creator_id);
create index if not exists idx_group_members_user on public.group_members(user_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.bots enable row level security;
alter table public.messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Drop policies if they exist to prevent errors on repeated runs
do $$
begin
  drop policy if exists "Public bots are viewable by everyone" on public.bots;
  drop policy if exists "Users can create bots" on public.bots;
  drop policy if exists "Users can manage own bots" on public.bots;
  drop policy if exists "Users can read own messages" on public.messages;
  drop policy if exists "Users can insert messages" on public.messages;
  drop policy if exists "Group members can view groups" on public.groups;
  drop policy if exists "Users can create groups" on public.groups;
  drop policy if exists "Public user profiles" on public.users;
  drop policy if exists "Users can update own profile" on public.users;
  drop policy if exists "Users can join groups" on public.group_members;
  drop policy if exists "Group members can view members" on public.group_members;
end $$;

-- Allow all authenticated users to read public bots
create policy "Public bots are viewable by everyone" on public.bots
  for select using (is_public = true or creator_id = auth.uid());

-- Allow users to create bots
create policy "Users can create bots" on public.bots
  for insert with check (creator_id = auth.uid());

-- Allow users to update/delete their own bots
create policy "Users can manage own bots" on public.bots
  for all using (creator_id = auth.uid());

-- Messages: users can read their own bot messages
create policy "Users can read own messages" on public.messages
  for select using (user_id = auth.uid() or group_id in (
    select group_id from public.group_members where user_id = auth.uid()
  ));

create policy "Users can insert messages" on public.messages
  for insert with check (user_id = auth.uid());

-- Groups: users can see groups they're in
create policy "Group members can view groups" on public.groups
  for select using (id in (
    select group_id from public.group_members where user_id = auth.uid()
  ));

create policy "Users can create groups" on public.groups
  for insert with check (creator_id = auth.uid());

-- Users table
create policy "Public user profiles" on public.users
  for select using (true);

create policy "Users can update own profile" on public.users
  for update using (id = auth.uid());

-- Group members: users can insert themselves into a group
create policy "Users can join groups" on public.group_members
  for insert with check (user_id = auth.uid());

-- Group members: users can see members of groups they belong to
create policy "Group members can view members" on public.group_members
  for select using (user_id = auth.uid() or group_id in (
    select group_id from public.group_members where user_id = auth.uid()
  ));

-- NOTE: The backend uses service_role key which bypasses RLS
-- So backend operations work even with strict RLS policies above
