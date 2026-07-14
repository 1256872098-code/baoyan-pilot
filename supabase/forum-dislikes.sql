-- BaoyanPilot forum dislike tables.
-- Prototype only: current frontend uses localStorage mock user ids.
-- Production must replace this with Supabase Auth, auth.uid() based RLS, and trusted backend functions.
-- Never expose a service_role key in frontend code.

create table if not exists public.forum_post_dislikes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.forum_reply_dislikes (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.forum_replies(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique(reply_id, user_id)
);

create index if not exists idx_forum_post_dislikes_post_id on public.forum_post_dislikes(post_id);
create index if not exists idx_forum_post_dislikes_user_id on public.forum_post_dislikes(user_id);
create index if not exists idx_forum_reply_dislikes_reply_id on public.forum_reply_dislikes(reply_id);
create index if not exists idx_forum_reply_dislikes_user_id on public.forum_reply_dislikes(user_id);

alter table public.forum_post_dislikes enable row level security;
alter table public.forum_reply_dislikes enable row level security;

drop policy if exists "prototype read post dislikes" on public.forum_post_dislikes;
drop policy if exists "prototype insert post dislikes" on public.forum_post_dislikes;
drop policy if exists "prototype delete post dislikes" on public.forum_post_dislikes;
drop policy if exists "prototype read reply dislikes" on public.forum_reply_dislikes;
drop policy if exists "prototype insert reply dislikes" on public.forum_reply_dislikes;
drop policy if exists "prototype delete reply dislikes" on public.forum_reply_dislikes;

create policy "prototype read post dislikes"
on public.forum_post_dislikes
for select
to anon, authenticated
using (true);

create policy "prototype insert post dislikes"
on public.forum_post_dislikes
for insert
to anon, authenticated
with check (user_id is not null and length(trim(user_id)) > 0);

create policy "prototype delete post dislikes"
on public.forum_post_dislikes
for delete
to anon, authenticated
using (true);

create policy "prototype read reply dislikes"
on public.forum_reply_dislikes
for select
to anon, authenticated
using (true);

create policy "prototype insert reply dislikes"
on public.forum_reply_dislikes
for insert
to anon, authenticated
with check (user_id is not null and length(trim(user_id)) > 0);

create policy "prototype delete reply dislikes"
on public.forum_reply_dislikes
for delete
to anon, authenticated
using (true);

create or replace function public.forum_remove_post_dislike_before_like()
returns trigger
language plpgsql
as $$
begin
  delete from public.forum_post_dislikes
  where post_id = new.post_id and user_id = new.user_id;
  return new;
end;
$$;

create or replace function public.forum_remove_post_like_before_dislike()
returns trigger
language plpgsql
as $$
begin
  delete from public.forum_post_likes
  where post_id = new.post_id and user_id = new.user_id;
  return new;
end;
$$;

create or replace function public.forum_remove_reply_dislike_before_like()
returns trigger
language plpgsql
as $$
begin
  delete from public.forum_reply_dislikes
  where reply_id = new.reply_id and user_id = new.user_id;
  return new;
end;
$$;

create or replace function public.forum_remove_reply_like_before_dislike()
returns trigger
language plpgsql
as $$
begin
  delete from public.forum_reply_likes
  where reply_id = new.reply_id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists forum_post_likes_remove_dislikes on public.forum_post_likes;
drop trigger if exists forum_post_dislikes_remove_likes on public.forum_post_dislikes;
drop trigger if exists forum_reply_likes_remove_dislikes on public.forum_reply_likes;
drop trigger if exists forum_reply_dislikes_remove_likes on public.forum_reply_dislikes;

create trigger forum_post_likes_remove_dislikes
before insert on public.forum_post_likes
for each row execute function public.forum_remove_post_dislike_before_like();

create trigger forum_post_dislikes_remove_likes
before insert on public.forum_post_dislikes
for each row execute function public.forum_remove_post_like_before_dislike();

create trigger forum_reply_likes_remove_dislikes
before insert on public.forum_reply_likes
for each row execute function public.forum_remove_reply_dislike_before_like();

create trigger forum_reply_dislikes_remove_likes
before insert on public.forum_reply_dislikes
for each row execute function public.forum_remove_reply_like_before_dislike();
