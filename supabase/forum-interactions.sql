-- BaoyanPilot forum interaction tables.
-- Run this file in the Supabase SQL Editor before enabling forum likes/bookmarks.
--
-- IMPORTANT:
-- The policies below are only for the current mock-login prototype.
-- In production, replace mock login with Supabase Auth and restrict writes with auth.uid(),
-- for example auth.uid() = user_id, auth.uid() = author_id, or secure backend functions.
-- Do not keep public update/delete policies for production.

alter table public.forum_posts
add column if not exists updated_at timestamptz not null default now();

-- Prototype update/delete policies for existing forum tables.
-- These are needed because the current mock-login frontend cannot use auth.uid().
-- Production must replace them with strict Supabase Auth policies or backend functions.
drop policy if exists "prototype update forum posts" on public.forum_posts;
drop policy if exists "prototype delete forum posts" on public.forum_posts;
drop policy if exists "prototype delete forum replies" on public.forum_replies;

create policy "prototype update forum posts"
on public.forum_posts for update
to anon, authenticated
using (true)
with check (true);

create policy "prototype delete forum posts"
on public.forum_posts for delete
to anon, authenticated
using (true);

create policy "prototype delete forum replies"
on public.forum_replies for delete
to anon, authenticated
using (true);

create table if not exists public.forum_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.forum_posts(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.forum_post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.forum_posts(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.forum_reply_likes (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null
    references public.forum_replies(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create table if not exists public.forum_reply_bookmarks (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null
    references public.forum_replies(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create index if not exists idx_forum_post_likes_post_id
on public.forum_post_likes(post_id);

create index if not exists idx_forum_post_bookmarks_post_id
on public.forum_post_bookmarks(post_id);

create index if not exists idx_forum_reply_likes_reply_id
on public.forum_reply_likes(reply_id);

create index if not exists idx_forum_reply_bookmarks_reply_id
on public.forum_reply_bookmarks(reply_id);

create index if not exists idx_forum_post_likes_user_id
on public.forum_post_likes(user_id);

create index if not exists idx_forum_post_bookmarks_user_id
on public.forum_post_bookmarks(user_id);

create index if not exists idx_forum_reply_likes_user_id
on public.forum_reply_likes(user_id);

create index if not exists idx_forum_reply_bookmarks_user_id
on public.forum_reply_bookmarks(user_id);

alter table public.forum_post_likes enable row level security;
alter table public.forum_post_bookmarks enable row level security;
alter table public.forum_reply_likes enable row level security;
alter table public.forum_reply_bookmarks enable row level security;

drop policy if exists "prototype read forum post likes" on public.forum_post_likes;
drop policy if exists "prototype insert forum post likes" on public.forum_post_likes;
drop policy if exists "prototype delete forum post likes" on public.forum_post_likes;

drop policy if exists "prototype read forum post bookmarks" on public.forum_post_bookmarks;
drop policy if exists "prototype insert forum post bookmarks" on public.forum_post_bookmarks;
drop policy if exists "prototype delete forum post bookmarks" on public.forum_post_bookmarks;

drop policy if exists "prototype read forum reply likes" on public.forum_reply_likes;
drop policy if exists "prototype insert forum reply likes" on public.forum_reply_likes;
drop policy if exists "prototype delete forum reply likes" on public.forum_reply_likes;

drop policy if exists "prototype read forum reply bookmarks" on public.forum_reply_bookmarks;
drop policy if exists "prototype insert forum reply bookmarks" on public.forum_reply_bookmarks;
drop policy if exists "prototype delete forum reply bookmarks" on public.forum_reply_bookmarks;

create policy "prototype read forum post likes"
on public.forum_post_likes for select
to anon, authenticated
using (true);

create policy "prototype insert forum post likes"
on public.forum_post_likes for insert
to anon, authenticated
with check (true);

create policy "prototype delete forum post likes"
on public.forum_post_likes for delete
to anon, authenticated
using (true);

create policy "prototype read forum post bookmarks"
on public.forum_post_bookmarks for select
to anon, authenticated
using (true);

create policy "prototype insert forum post bookmarks"
on public.forum_post_bookmarks for insert
to anon, authenticated
with check (true);

create policy "prototype delete forum post bookmarks"
on public.forum_post_bookmarks for delete
to anon, authenticated
using (true);

create policy "prototype read forum reply likes"
on public.forum_reply_likes for select
to anon, authenticated
using (true);

create policy "prototype insert forum reply likes"
on public.forum_reply_likes for insert
to anon, authenticated
with check (true);

create policy "prototype delete forum reply likes"
on public.forum_reply_likes for delete
to anon, authenticated
using (true);

create policy "prototype read forum reply bookmarks"
on public.forum_reply_bookmarks for select
to anon, authenticated
using (true);

create policy "prototype insert forum reply bookmarks"
on public.forum_reply_bookmarks for insert
to anon, authenticated
with check (true);

create policy "prototype delete forum reply bookmarks"
on public.forum_reply_bookmarks for delete
to anon, authenticated
using (true);
