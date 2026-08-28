-- BaoyanPilot migration from mock IDs/public prototype policies to Supabase Auth.
-- Run AFTER auth-profiles.sql and the existing feature SQL files.
-- This migration keeps all existing rows; old mock/test rows remain readable but
-- cannot be claimed or modified by a newly authenticated user.

do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'forum_posts', 'forum_replies',
    'forum_post_likes', 'forum_post_dislikes', 'forum_post_bookmarks',
    'forum_reply_likes', 'forum_reply_dislikes', 'forum_reply_bookmarks',
    'school_reviews', 'school_review_likes', 'school_review_dislikes',
    'user_notifications', 'user_feedback', 'student_verifications'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      for policy_row in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
      end loop;
    end if;
  end loop;
end $$;

-- Forum: public reading, authenticated writes, owners alone may modify/delete.
create policy "public read forum posts"
on public.forum_posts for select to anon, authenticated using (true);
create policy "authenticated create own forum posts"
on public.forum_posts for insert to authenticated
with check (author_id = auth.uid()::text);
create policy "authors update own forum posts"
on public.forum_posts for update to authenticated
using (author_id = auth.uid()::text)
with check (author_id = auth.uid()::text);
create policy "authors delete own forum posts"
on public.forum_posts for delete to authenticated
using (author_id = auth.uid()::text);

create policy "public read forum replies"
on public.forum_replies for select to anon, authenticated using (true);
create policy "authenticated create own forum replies"
on public.forum_replies for insert to authenticated
with check (author_id = auth.uid()::text);
create policy "authors update own forum replies"
on public.forum_replies for update to authenticated
using (author_id = auth.uid()::text)
with check (author_id = auth.uid()::text);
create policy "authors delete own forum replies"
on public.forum_replies for delete to authenticated
using (author_id = auth.uid()::text);

grant select on public.forum_posts, public.forum_replies to anon, authenticated;
grant insert, update, delete on public.forum_posts, public.forum_replies to authenticated;
revoke insert, update, delete on public.forum_posts, public.forum_replies from anon;

-- Likes/dislikes are public aggregate signals; each authenticated user controls only their row.
create policy "public read forum post likes" on public.forum_post_likes for select to anon, authenticated using (true);
create policy "users insert own forum post likes" on public.forum_post_likes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum post likes" on public.forum_post_likes for delete to authenticated using (user_id = auth.uid()::text);
create policy "public read forum post dislikes" on public.forum_post_dislikes for select to anon, authenticated using (true);
create policy "users insert own forum post dislikes" on public.forum_post_dislikes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum post dislikes" on public.forum_post_dislikes for delete to authenticated using (user_id = auth.uid()::text);
create policy "public read forum reply likes" on public.forum_reply_likes for select to anon, authenticated using (true);
create policy "users insert own forum reply likes" on public.forum_reply_likes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum reply likes" on public.forum_reply_likes for delete to authenticated using (user_id = auth.uid()::text);
create policy "public read forum reply dislikes" on public.forum_reply_dislikes for select to anon, authenticated using (true);
create policy "users insert own forum reply dislikes" on public.forum_reply_dislikes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum reply dislikes" on public.forum_reply_dislikes for delete to authenticated using (user_id = auth.uid()::text);

-- Bookmarks are private: authenticated users can only see and control their own rows.
create policy "users read own forum post bookmarks" on public.forum_post_bookmarks for select to authenticated using (user_id = auth.uid()::text);
create policy "users insert own forum post bookmarks" on public.forum_post_bookmarks for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum post bookmarks" on public.forum_post_bookmarks for delete to authenticated using (user_id = auth.uid()::text);
create policy "users read own forum reply bookmarks" on public.forum_reply_bookmarks for select to authenticated using (user_id = auth.uid()::text);
create policy "users insert own forum reply bookmarks" on public.forum_reply_bookmarks for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own forum reply bookmarks" on public.forum_reply_bookmarks for delete to authenticated using (user_id = auth.uid()::text);

grant select on
  public.forum_post_likes, public.forum_post_dislikes, public.forum_post_bookmarks,
  public.forum_reply_likes, public.forum_reply_dislikes, public.forum_reply_bookmarks
to anon, authenticated;
grant insert, delete on
  public.forum_post_likes, public.forum_post_dislikes, public.forum_post_bookmarks,
  public.forum_reply_likes, public.forum_reply_dislikes, public.forum_reply_bookmarks
to authenticated;
revoke insert, delete on
  public.forum_post_likes, public.forum_post_dislikes, public.forum_post_bookmarks,
  public.forum_reply_likes, public.forum_reply_dislikes, public.forum_reply_bookmarks
from anon;

-- School reviews remain public to read, while all writes are bound to auth.uid().
create policy "public read school reviews" on public.school_reviews for select to anon, authenticated using (true);
create policy "users insert own school reviews" on public.school_reviews for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users update own school reviews" on public.school_reviews for update to authenticated using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy "users delete own school reviews" on public.school_reviews for delete to authenticated using (user_id = auth.uid()::text);

create policy "public read school review likes" on public.school_review_likes for select to anon, authenticated using (true);
create policy "users insert own school review likes" on public.school_review_likes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own school review likes" on public.school_review_likes for delete to authenticated using (user_id = auth.uid()::text);
create policy "public read school review dislikes" on public.school_review_dislikes for select to anon, authenticated using (true);
create policy "users insert own school review dislikes" on public.school_review_dislikes for insert to authenticated with check (user_id = auth.uid()::text);
create policy "users delete own school review dislikes" on public.school_review_dislikes for delete to authenticated using (user_id = auth.uid()::text);

grant select on public.school_reviews, public.school_review_likes, public.school_review_dislikes to anon, authenticated;
grant insert, update, delete on public.school_reviews to authenticated;
grant insert, delete on public.school_review_likes, public.school_review_dislikes to authenticated;
revoke insert, update, delete on public.school_reviews from anon;
revoke insert, delete on public.school_review_likes, public.school_review_dislikes from anon;

-- Notifications are private to their recipient. Inserts are created by protected triggers.
create policy "users read own notifications"
on public.user_notifications for select to authenticated
using (recipient_user_id = auth.uid()::text);
create policy "users update own notification read state"
on public.user_notifications for update to authenticated
using (recipient_user_id = auth.uid()::text)
with check (recipient_user_id = auth.uid()::text);
revoke all on public.user_notifications from anon, authenticated;
grant select, update (is_read, read_at) on public.user_notifications to authenticated;

-- Feedback remains available to guests. Signed-in users may only submit their actual UUID.
create policy "guests and users submit feedback"
on public.user_feedback for insert to anon, authenticated
with check (
  status = 'pending'
  and ((auth.uid() is null and user_id is null) or user_id = auth.uid()::text)
  and feedback_type in ('功能建议', '页面问题', '数据纠错', '使用体验', '其他')
  and char_length(btrim(content)) between 1 and 500
);
revoke all on public.user_feedback from anon, authenticated;
grant insert (user_id, user_name, feedback_type, content, page_path) on public.user_feedback to anon, authenticated;

-- Student verification is private. Users can submit/read their own request but cannot update status.
alter table public.student_verifications alter column access_token_hash drop not null;
create policy "users read own student verifications"
on public.student_verifications for select to authenticated
using (user_id = auth.uid()::text);
create policy "users submit own student verifications"
on public.student_verifications for insert to authenticated
with check (
  user_id = auth.uid()::text
  and status = 'pending'
  and verified_at is null
  and admin_note is null
);
revoke all on public.student_verifications from anon, authenticated;
grant select on public.student_verifications to authenticated;
grant insert (
  user_id, user_name, school_id, school_name, college_name, major_name,
  verification_code, report_file_url, ai_review_result, ai_review_reason
) on public.student_verifications to authenticated;

-- The private PDF bucket uses the user's UUID as its first folder segment.
drop policy if exists "authenticated users upload own verification reports" on storage.objects;
drop policy if exists "authenticated users read own verification reports" on storage.objects;
create policy "users upload own verification reports"
on storage.objects for insert to authenticated
with check (bucket_id = 'student-verification-reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own verification reports"
on storage.objects for select to authenticated
using (bucket_id = 'student-verification-reports' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
