-- BaoyanPilot user feedback storage.
-- Run this file once in the Supabase SQL Editor.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_name text not null default '游客',
  feedback_type text not null,
  content text not null,
  page_path text not null default '/',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint user_feedback_user_id_length check (user_id is null or char_length(user_id) <= 128),
  constraint user_feedback_user_name_length check (char_length(user_name) between 1 and 80),
  constraint user_feedback_type_allowed check (
    feedback_type in ('功能建议', '页面问题', '数据纠错', '使用体验', '其他')
  ),
  constraint user_feedback_content_length check (char_length(btrim(content)) between 1 and 500),
  constraint user_feedback_page_path_length check (char_length(page_path) between 1 and 500),
  constraint user_feedback_status_allowed check (status in ('pending', 'reviewing', 'resolved', 'closed'))
);

create index if not exists user_feedback_created_at_idx
on public.user_feedback (created_at desc);

create index if not exists user_feedback_status_idx
on public.user_feedback (status, created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists "public submit user feedback" on public.user_feedback;

create policy "public submit user feedback"
on public.user_feedback
for insert
to anon, authenticated
with check (
  status = 'pending'
  and feedback_type in ('功能建议', '页面问题', '数据纠错', '使用体验', '其他')
  and char_length(btrim(content)) between 1 and 500
  and char_length(page_path) between 1 and 500
);

-- Browser clients can only insert the fields below. There is intentionally no
-- SELECT, UPDATE, or DELETE grant/policy for anon or authenticated users.
revoke all on table public.user_feedback from anon, authenticated;

grant insert (user_id, user_name, feedback_type, content, page_path)
on table public.user_feedback
to anon, authenticated;

comment on table public.user_feedback is 'Feedback submitted from the BaoyanPilot contact modal';

