-- BaoyanPilot forum threaded replies and post search migration.
-- This migration keeps existing forum_posts/forum_replies rows and only adds compatible columns/indexes.

alter table public.forum_replies
add column if not exists parent_reply_id uuid null;

alter table public.forum_replies
add column if not exists root_reply_id uuid null;

alter table public.forum_replies
add column if not exists reply_to_author_id text null;

alter table public.forum_replies
add column if not exists reply_to_author_name text null;

alter table public.forum_replies
add column if not exists depth integer not null default 0;

alter table public.forum_replies
drop constraint if exists forum_replies_parent_reply_id_fkey;

alter table public.forum_replies
add constraint forum_replies_parent_reply_id_fkey
foreign key (parent_reply_id)
references public.forum_replies(id)
on delete cascade;

create index if not exists idx_forum_replies_post_id_created_at
on public.forum_replies(post_id, created_at);

create index if not exists idx_forum_replies_parent_reply_id
on public.forum_replies(parent_reply_id);

create index if not exists idx_forum_replies_root_reply_id
on public.forum_replies(root_reply_id);

create extension if not exists pg_trgm;

create index if not exists idx_forum_posts_title_trgm
on public.forum_posts
using gin (title gin_trgm_ops);

create index if not exists idx_forum_posts_content_trgm
on public.forum_posts
using gin (content gin_trgm_ops);

create or replace function public.search_forum_posts(
  p_query text,
  p_category text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.forum_posts
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.forum_posts p
  where
    (
      nullif(trim(p_query), '') is null
      or p.title ilike '%' || trim(p_query) || '%'
      or p.content ilike '%' || trim(p_query) || '%'
    )
    and
    (
      p_category is null
      or p_category = ''
      or p_category = '全部'
      or p.category = p_category
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_forum_posts(
  text,
  text,
  integer,
  integer
) to anon, authenticated;
