-- BaoyanPilot school review like/dislike tables.
--
-- 当前策略仅适用于模拟登录体验版。正式上线接入 Supabase Auth 后，
-- 必须使用 auth.uid() 限制用户只能操作自己的点赞和点踩记录。
-- Do not expose a SUPABASE_SERVICE_ROLE_KEY in frontend code.

create table if not exists public.school_review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null
    references public.school_reviews(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create table if not exists public.school_review_dislikes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null
    references public.school_reviews(id)
    on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists idx_school_review_likes_review_id
on public.school_review_likes(review_id);

create index if not exists idx_school_review_likes_user_id
on public.school_review_likes(user_id);

create index if not exists idx_school_review_dislikes_review_id
on public.school_review_dislikes(review_id);

create index if not exists idx_school_review_dislikes_user_id
on public.school_review_dislikes(user_id);

alter table public.school_review_likes enable row level security;
alter table public.school_review_dislikes enable row level security;

drop policy if exists "prototype read school review likes" on public.school_review_likes;
drop policy if exists "prototype insert school review likes" on public.school_review_likes;
drop policy if exists "prototype delete school review likes" on public.school_review_likes;
drop policy if exists "prototype read school review dislikes" on public.school_review_dislikes;
drop policy if exists "prototype insert school review dislikes" on public.school_review_dislikes;
drop policy if exists "prototype delete school review dislikes" on public.school_review_dislikes;

create policy "prototype read school review likes"
on public.school_review_likes
for select
to anon, authenticated
using (true);

create policy "prototype insert school review likes"
on public.school_review_likes
for insert
to anon, authenticated
with check (true);

create policy "prototype delete school review likes"
on public.school_review_likes
for delete
to anon, authenticated
using (true);

create policy "prototype read school review dislikes"
on public.school_review_dislikes
for select
to anon, authenticated
using (true);

create policy "prototype insert school review dislikes"
on public.school_review_dislikes
for insert
to anon, authenticated
with check (true);

create policy "prototype delete school review dislikes"
on public.school_review_dislikes
for delete
to anon, authenticated
using (true);

create or replace function public.get_school_reviews(
  p_school_id text,
  p_sort text default 'newest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  school_id text,
  user_id text,
  user_name text,
  rating smallint,
  content text,
  created_at timestamptz,
  like_count bigint,
  dislike_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id,
    r.school_id,
    r.user_id,
    r.user_name,
    r.rating,
    r.content,
    r.created_at,
    count(distinct l.id) as like_count,
    count(distinct d.id) as dislike_count
  from public.school_reviews r
  left join public.school_review_likes l
    on l.review_id = r.id
  left join public.school_review_dislikes d
    on d.review_id = r.id
  where r.school_id = p_school_id
  group by r.id
  order by
    case
      when p_sort = 'most-liked'
      then count(distinct l.id)
    end desc,
    case
      when p_sort = 'oldest'
      then r.created_at
    end asc,
    case
      when p_sort in ('newest', 'most-liked')
      then r.created_at
    end desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.get_school_reviews(
  text,
  text,
  integer,
  integer
) to anon, authenticated;
