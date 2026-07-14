-- BaoyanPilot in-app notifications.
--
-- Run this file in Supabase SQL Editor after forum and school review tables exist:
--   supabase/forum-interactions.sql
--   supabase/forum-dislikes.sql
--   supabase/forum-threaded-replies-search.sql
--   supabase/school-ratings.sql
--   supabase/school-review-interactions.sql
--
-- IMPORTANT:
-- 当前模拟登录无法实现真正安全的个人通知隔离。正式上线接入 Supabase Auth 后，
-- 应使用 auth.uid() = recipient_user_id 限制用户只能读取和修改自己的通知。
-- Do not expose a SUPABASE_SERVICE_ROLE_KEY in frontend code.

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id text not null,
  actor_user_id text,
  type text not null,
  entity_type text not null,
  entity_id text not null,
  parent_entity_id text,
  target_title text,
  target_preview text,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_user_notifications_recipient_created
on public.user_notifications(recipient_user_id, created_at desc);

create index if not exists idx_user_notifications_recipient_unread
on public.user_notifications(recipient_user_id, is_read, created_at desc);

create index if not exists idx_user_notifications_entity
on public.user_notifications(entity_type, entity_id);

alter table public.user_notifications enable row level security;

drop policy if exists "prototype read user notifications" on public.user_notifications;
drop policy if exists "prototype update user notifications read state" on public.user_notifications;

create policy "prototype read user notifications"
on public.user_notifications
for select
to anon, authenticated
using (true);

create policy "prototype update user notifications read state"
on public.user_notifications
for update
to anon, authenticated
using (true)
with check (true);

revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to anon, authenticated;
grant update (is_read, read_at) on public.user_notifications to anon, authenticated;

create or replace function public.upsert_user_notification(
  p_recipient_user_id text,
  p_actor_user_id text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_parent_entity_id text,
  p_target_title text,
  p_target_preview text,
  p_link text,
  p_metadata jsonb,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_user_id is null or length(trim(p_recipient_user_id)) = 0 then
    return;
  end if;

  if p_actor_user_id is not null and p_actor_user_id = p_recipient_user_id then
    return;
  end if;

  insert into public.user_notifications (
    recipient_user_id,
    actor_user_id,
    type,
    entity_type,
    entity_id,
    parent_entity_id,
    target_title,
    target_preview,
    link,
    metadata,
    dedupe_key,
    is_read,
    created_at,
    read_at
  )
  values (
    p_recipient_user_id,
    p_actor_user_id,
    p_type,
    p_entity_type,
    p_entity_id,
    p_parent_entity_id,
    left(coalesce(p_target_title, ''), 120),
    left(coalesce(p_target_preview, ''), 100),
    p_link,
    coalesce(p_metadata, '{}'::jsonb),
    p_dedupe_key,
    false,
    now(),
    null
  )
  on conflict (dedupe_key) do update
  set
    target_title = excluded.target_title,
    target_preview = excluded.target_preview,
    link = excluded.link,
    metadata = excluded.metadata,
    is_read = false,
    created_at = now(),
    read_at = null;
end;
$$;

create or replace function public.notify_forum_reply_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id text;
  v_post_title text;
  v_parent_author_id text;
  v_root_reply_id uuid;
  v_link text;
begin
  select p.author_id, p.title
  into v_post_author_id, v_post_title
  from public.forum_posts p
  where p.id = new.post_id;

  if new.parent_reply_id is null then
    v_link := '/forum?post=' || new.post_id::text || '&reply=' || new.id::text;

    perform public.upsert_user_notification(
      v_post_author_id,
      new.author_id,
      'forum_post_reply',
      'forum_reply',
      new.id::text,
      new.post_id::text,
      v_post_title,
      new.content,
      v_link,
      jsonb_build_object('postId', new.post_id, 'replyId', new.id),
      'forum_reply_created:' || new.id::text
    );
  else
    select r.author_id
    into v_parent_author_id
    from public.forum_replies r
    where r.id = new.parent_reply_id;

    v_root_reply_id := coalesce(new.root_reply_id, new.parent_reply_id);
    v_link :=
      '/forum?post=' || new.post_id::text ||
      '&reply=' || new.id::text ||
      '&root=' || v_root_reply_id::text;

    perform public.upsert_user_notification(
      v_parent_author_id,
      new.author_id,
      'forum_reply_reply',
      'forum_reply',
      new.id::text,
      new.parent_reply_id::text,
      v_post_title,
      new.content,
      v_link,
      jsonb_build_object(
        'postId', new.post_id,
        'replyId', new.id,
        'parentReplyId', new.parent_reply_id,
        'rootReplyId', v_root_reply_id
      ),
      'forum_reply_created:' || new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_forum_post_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id text;
  v_post_title text;
  v_type text := tg_argv[0];
  v_preview text := tg_argv[1];
begin
  select p.author_id, p.title
  into v_post_author_id, v_post_title
  from public.forum_posts p
  where p.id = new.post_id;

  perform public.upsert_user_notification(
    v_post_author_id,
    new.user_id,
    v_type,
    'forum_post',
    new.post_id::text,
    null,
    v_post_title,
    v_preview,
    '/forum?post=' || new.post_id::text,
    jsonb_build_object('postId', new.post_id),
    v_type || ':' || new.post_id::text || ':' || new.user_id
  );

  return new;
end;
$$;

create or replace function public.notify_forum_reply_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply public.forum_replies%rowtype;
  v_post_title text;
  v_root_reply_id uuid;
  v_type text := tg_argv[0];
  v_preview text := tg_argv[1];
  v_link text;
begin
  select *
  into v_reply
  from public.forum_replies r
  where r.id = new.reply_id;

  if v_reply.id is null then
    return new;
  end if;

  select p.title
  into v_post_title
  from public.forum_posts p
  where p.id = v_reply.post_id;

  v_root_reply_id := coalesce(v_reply.root_reply_id, v_reply.id);
  v_link :=
    '/forum?post=' || v_reply.post_id::text ||
    '&reply=' || v_reply.id::text ||
    case
      when v_root_reply_id is not null and v_root_reply_id <> v_reply.id
      then '&root=' || v_root_reply_id::text
      else ''
    end;

  perform public.upsert_user_notification(
    v_reply.author_id,
    new.user_id,
    v_type,
    'forum_reply',
    new.reply_id::text,
    v_reply.post_id::text,
    v_post_title,
    coalesce(v_preview || '：', '') || left(coalesce(v_reply.content, ''), 80),
    v_link,
    jsonb_build_object('postId', v_reply.post_id, 'replyId', v_reply.id, 'rootReplyId', v_root_reply_id),
    v_type || ':' || new.reply_id::text || ':' || new.user_id
  );

  return new;
end;
$$;

create or replace function public.notify_school_review_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.school_reviews%rowtype;
  v_type text := tg_argv[0];
  v_preview text := tg_argv[1];
begin
  select *
  into v_review
  from public.school_reviews r
  where r.id = new.review_id;

  if v_review.id is null then
    return new;
  end if;

  perform public.upsert_user_notification(
    v_review.user_id,
    new.user_id,
    v_type,
    'school_review',
    new.review_id::text,
    v_review.school_id,
    '院校评价',
    coalesce(v_preview || '：', '') || left(coalesce(v_review.content, ''), 80),
    '/schools/' || v_review.school_id || '?section=reviews&review=' || new.review_id::text,
    jsonb_build_object('schoolId', v_review.school_id, 'reviewId', v_review.id),
    v_type || ':' || new.review_id::text || ':' || new.user_id
  );

  return new;
end;
$$;

drop trigger if exists user_notifications_forum_reply_insert on public.forum_replies;
drop trigger if exists user_notifications_forum_post_like on public.forum_post_likes;
drop trigger if exists user_notifications_forum_post_dislike on public.forum_post_dislikes;
drop trigger if exists user_notifications_forum_reply_like on public.forum_reply_likes;
drop trigger if exists user_notifications_forum_reply_dislike on public.forum_reply_dislikes;
drop trigger if exists user_notifications_school_review_like on public.school_review_likes;
drop trigger if exists user_notifications_school_review_dislike on public.school_review_dislikes;

create trigger user_notifications_forum_reply_insert
after insert on public.forum_replies
for each row execute function public.notify_forum_reply_insert();

create trigger user_notifications_forum_post_like
after insert on public.forum_post_likes
for each row execute function public.notify_forum_post_vote('forum_post_like', '有人点赞了你的帖子');

create trigger user_notifications_forum_post_dislike
after insert on public.forum_post_dislikes
for each row execute function public.notify_forum_post_vote('forum_post_dislike', '有人点踩了你的帖子');

create trigger user_notifications_forum_reply_like
after insert on public.forum_reply_likes
for each row execute function public.notify_forum_reply_vote('forum_reply_like', '有人点赞了你的评论');

create trigger user_notifications_forum_reply_dislike
after insert on public.forum_reply_dislikes
for each row execute function public.notify_forum_reply_vote('forum_reply_dislike', '有人点踩了你的评论');

create trigger user_notifications_school_review_like
after insert on public.school_review_likes
for each row execute function public.notify_school_review_vote('school_review_like', '有人点赞了你的院校评价');

create trigger user_notifications_school_review_dislike
after insert on public.school_review_dislikes
for each row execute function public.notify_school_review_vote('school_review_dislike', '有人点踩了你的院校评价');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_notifications'
    )
  then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;
