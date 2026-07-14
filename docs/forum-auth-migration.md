# Forum Auth Migration Notes

BaoyanPilot currently uses a localStorage mock login system. Forum write permissions are enforced by the frontend for prototype testing only. This is not production-grade authorization. A mock user can be forged by editing localStorage, so the current permission model is only suitable for product demos and internal testing.

## Current Prototype

- `author_id` and interaction `user_id` store mock user IDs.
- Guests can browse forum content.
- Phone mock users can publish, reply, like, dislike, bookmark, edit their own posts, and delete permitted content.
- Supabase RLS policies in `supabase/forum-interactions.sql` and `supabase/forum-dislikes.sql` allow prototype reads/writes for `anon` and `authenticated` roles.

## Production Migration

Before production launch:

1. Replace mock login with Supabase Auth.
2. Store `author_id` and `user_id` as the Supabase Auth user UUID.
3. Update RLS so users can only mutate their own rows:
   - `auth.uid() = author_id`
   - `auth.uid() = user_id`
4. Implement post-author moderation of replies through a database function or trusted backend endpoint.
5. Move destructive operations such as delete post/reply into RLS-backed policies or backend functions that verify the current Supabase Auth user.
6. Remove long-term public `insert`, `update`, and `delete` policies.
7. Keep the anon role read-only unless a specific public write surface is intentionally designed and protected.

Do not expose a `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `VITE_` environment variables.
