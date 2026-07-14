-- BaoyanPilot school review and rating table.
--
-- IMPORTANT:
-- 当前策略仅适用于模拟登录体验版。正式上线改用 Supabase Auth 后，
-- 必须使用 auth.uid() 限制用户只能修改或删除自己的评价。
-- Do not expose a SUPABASE_SERVICE_ROLE_KEY in frontend code.

create table if not exists public.school_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  user_id text not null,
  user_name text not null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create index if not exists idx_school_reviews_school_id
on public.school_reviews(school_id);

create index if not exists idx_school_reviews_user_id
on public.school_reviews(user_id);

create index if not exists idx_school_reviews_created_at
on public.school_reviews(created_at desc);

alter table public.school_reviews enable row level security;

drop policy if exists "prototype read school reviews" on public.school_reviews;
drop policy if exists "prototype insert school reviews" on public.school_reviews;
drop policy if exists "prototype update school reviews" on public.school_reviews;
drop policy if exists "prototype delete school reviews" on public.school_reviews;

create policy "prototype read school reviews"
on public.school_reviews
for select
to anon, authenticated
using (true);

create policy "prototype insert school reviews"
on public.school_reviews
for insert
to anon, authenticated
with check (true);

create policy "prototype update school reviews"
on public.school_reviews
for update
to anon, authenticated
using (true)
with check (true);

create policy "prototype delete school reviews"
on public.school_reviews
for delete
to anon, authenticated
using (true);
