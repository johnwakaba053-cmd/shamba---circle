-- Optional farming topics on posts -- a single, curated classification
-- per post (e.g. "Livestock", "Irrigation"), distinct from hashtags
-- (unbounded, user-generated, many-per-post, not built yet) and from
-- community_id (which controls visibility/membership, not just
-- classification). Nullable so choosing a topic is never mandatory to
-- create a post.
--
-- text + CHECK, not a new table -- matches this schema's existing
-- convention for small, code-owned closed sets (communities.group_name,
-- comment_reactions.reaction_type, post_media.media_type, alerts.severity,
-- listings.listing_type, user_roles.role). No RLS changes: topic carries
-- no access-control meaning, so every existing posts policy (own-row
-- INSERT/UPDATE/DELETE, open SELECT) already covers it unchanged.

alter table public.posts add column topic text;

alter table public.posts add constraint posts_topic_check
  check (
    topic is null
    or topic = any (array[
      'Crops',
      'Livestock',
      'Machinery',
      'Irrigation',
      'Harvesting',
      'Farming Business',
      'Farming Tips',
      'Farm Tours',
      'Farm Life'
    ])
  );
