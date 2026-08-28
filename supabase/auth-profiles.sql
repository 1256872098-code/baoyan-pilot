-- BaoyanPilot Supabase Auth profile and cloud school binding tables.
-- Run this file first. It is additive and does not delete legacy/test rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '保研用户',
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists nickname text not null default '保研用户';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.user_school_bindings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id text,
  school_name text not null,
  college_id text,
  college_name text not null default '',
  major_id text,
  major_name text not null default '',
  grade text not null default '',
  graduation_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_school_bindings_school_name_length check (char_length(btrim(school_name)) between 1 and 160),
  constraint user_school_bindings_graduation_year_range check (
    graduation_year is null or graduation_year between 2000 and 2200
  )
);

create or replace function public.set_auth_owned_row_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_auth_owned_row_updated_at();

drop trigger if exists user_school_bindings_set_updated_at on public.user_school_bindings;
create trigger user_school_bindings_set_updated_at
before update on public.user_school_bindings
for each row execute function public.set_auth_owned_row_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '保研用户'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill a profile for Auth users that existed before this migration.
insert into public.profiles (id, nickname)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'nickname'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '保研用户'
  )
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_school_bindings enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_row.policyname);
  end loop;
  for policy_row in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'user_school_bindings'
  loop
    execute format('drop policy if exists %I on public.user_school_bindings', policy_row.policyname);
  end loop;
end $$;

create policy "users read own profile"
on public.profiles for select to authenticated
using (auth.uid()::text = id::text);

create policy "users insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid()::text = id::text);

create policy "users update own profile"
on public.profiles for update to authenticated
using (auth.uid()::text = id::text)
with check (auth.uid()::text = id::text);

create policy "users read own school binding"
on public.user_school_bindings for select to authenticated
using (auth.uid()::text = user_id::text);

create policy "users insert own school binding"
on public.user_school_bindings for insert to authenticated
with check (auth.uid()::text = user_id::text);

create policy "users update own school binding"
on public.user_school_bindings for update to authenticated
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

create policy "users delete own school binding"
on public.user_school_bindings for delete to authenticated
using (auth.uid()::text = user_id::text);

revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
revoke all on public.user_school_bindings from anon, authenticated;
grant select, insert, update, delete on public.user_school_bindings to authenticated;

-- Public avatar files; users may only write inside their own UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "users upload own avatars" on storage.objects;
drop policy if exists "users update own avatars" on storage.objects;
drop policy if exists "users delete own avatars" on storage.objects;

create policy "public read avatars"
on storage.objects for select to anon, authenticated
using (bucket_id = 'avatars');

create policy "users upload own avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.profiles is 'Cloud profile for a Supabase Auth user.';
comment on table public.user_school_bindings is 'Cross-device My School binding owned by a Supabase Auth user.';
