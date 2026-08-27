-- BaoyanPilot student-status verification workflow.
-- Run this file in the Supabase SQL Editor before enabling the UI in production.

create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null default '保研用户',
  school_id text,
  school_name text not null,
  college_name text not null,
  major_name text not null,
  verification_code text not null,
  report_file_url text,
  ai_review_result text,
  ai_review_reason text,
  status text not null default 'pending',
  admin_note text,
  access_token_hash text not null,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint student_verifications_code_format check (verification_code ~ '^[0-9]{16}$'),
  constraint student_verifications_ai_result_allowed check (
    ai_review_result is null
    or ai_review_result in ('建议通过', '建议人工复核', '建议补充材料')
  ),
  constraint student_verifications_status_allowed check (
    status in ('pending', 'needs_more_info', 'verified', 'rejected')
  ),
  constraint student_verifications_school_length check (char_length(btrim(school_name)) between 1 and 160),
  constraint student_verifications_college_length check (char_length(btrim(college_name)) between 1 and 160),
  constraint student_verifications_major_length check (char_length(btrim(major_name)) between 1 and 160),
  constraint student_verifications_user_length check (char_length(user_id) between 1 and 128),
  constraint student_verifications_token_hash_length check (char_length(access_token_hash) = 64)
);

create index if not exists student_verifications_user_submitted_idx
on public.student_verifications (user_id, submitted_at desc);

create index if not exists student_verifications_status_submitted_idx
on public.student_verifications (status, submitted_at desc);

create or replace function public.set_student_verification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_verifications_set_updated_at on public.student_verifications;
create trigger student_verifications_set_updated_at
before update on public.student_verifications
for each row execute function public.set_student_verification_updated_at();

alter table public.student_verifications enable row level security;

drop policy if exists "authenticated users read own student verifications" on public.student_verifications;
drop policy if exists "authenticated users submit own student verifications" on public.student_verifications;

-- These policies become active when the app switches from mock login to
-- Supabase Auth. The current prototype uses a server endpoint plus a private,
-- per-browser access token; it never grants anon direct table access.
create policy "authenticated users read own student verifications"
on public.student_verifications
for select
to authenticated
using (auth.uid()::text = user_id);

create policy "authenticated users submit own student verifications"
on public.student_verifications
for insert
to authenticated
with check (
  auth.uid()::text = user_id
  and status = 'pending'
  and verified_at is null
  and admin_note is null
);

revoke all on table public.student_verifications from anon, authenticated;
grant select on table public.student_verifications to authenticated;
grant insert (
  user_id,
  user_name,
  school_id,
  school_name,
  college_name,
  major_name,
  verification_code,
  report_file_url,
  access_token_hash
) on table public.student_verifications to authenticated;

-- Private PDF bucket. report_file_url stores an object path, never a public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verification-reports',
  'student-verification-reports',
  false,
  3145728,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated users upload own verification reports" on storage.objects;
drop policy if exists "authenticated users read own verification reports" on storage.objects;

create policy "authenticated users upload own verification reports"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-verification-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users read own verification reports"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-verification-reports'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.student_verifications is
'Student-status verification requests. AI output is advisory; only a protected admin action may set status=verified.';

comment on column public.student_verifications.report_file_url is
'Private storage object path in student-verification-reports; never expose as a public URL.';

