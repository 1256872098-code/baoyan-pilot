-- BaoyanPilot forum author profile fields.
-- Run this in the Supabase SQL Editor to display author school badges in posts and replies.
-- These fields are written by the current mock-login prototype and should be replaced by
-- server-side profile joins after real authentication is available.

alter table public.forum_posts
add column if not exists author_avatar text null;

alter table public.forum_posts
add column if not exists author_school_id text null;

alter table public.forum_posts
add column if not exists author_school_name text null;

alter table public.forum_posts
add column if not exists author_school_level_tags jsonb not null default '[]'::jsonb;

alter table public.forum_replies
add column if not exists author_avatar text null;

alter table public.forum_replies
add column if not exists author_school_id text null;

alter table public.forum_replies
add column if not exists author_school_name text null;

alter table public.forum_replies
add column if not exists author_school_level_tags jsonb not null default '[]'::jsonb;

create index if not exists idx_forum_posts_author_school_id
on public.forum_posts(author_school_id);

create index if not exists idx_forum_replies_author_school_id
on public.forum_replies(author_school_id);
