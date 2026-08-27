-- BaoyanPilot forum category migration.
-- Run this once in the Supabase SQL Editor after the forum_posts table exists.

begin;

-- Remove any older category CHECK constraint before changing stored values.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.forum_posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format(
      'alter table public.forum_posts drop constraint if exists %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

update public.forum_posts
set category = case category
  when '院校信息' then '院校与政策'
  when '材料准备' then '申请准备'
  when '夏令营' then '推免阶段'
  when '预推免' then '推免阶段'
  when '九推' then '推免阶段'
  when '面试经验' then '面试考核'
  else category
end
where category in ('院校信息', '材料准备', '夏令营', '预推免', '九推', '面试经验');

alter table public.forum_posts
add constraint forum_posts_category_allowed
check (
  category in (
    '保研经验',
    '院校与政策',
    '申请准备',
    '推免阶段',
    '面试考核',
    '竞赛科研',
    '答疑求助'
  )
);

commit;
