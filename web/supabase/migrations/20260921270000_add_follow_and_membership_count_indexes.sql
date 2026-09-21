-- Social-layer batch: two additive performance indexes only. No table,
-- column, constraint, or RLS policy is touched -- this migration exists
-- purely so the two existing security-definer count functions stay fast
-- as real data accumulates.
--
-- follower_count(p_profile_id) filters `where followed_profile_id = ...`,
-- and community_member_count(p_community_id) filters
-- `where community_id = ...` -- both are the SECOND column of an
-- existing composite primary key (follows(follower_profile_id,
-- followed_profile_id) and community_memberships(profile_id,
-- community_id) respectively). A composite btree index cannot serve an
-- efficient search on its trailing column alone, so both functions
-- currently fall back to scanning every row in the table rather than
-- using an index range scan. Invisible today (both tables hold very
-- few real rows), but a popular profile's follower count or a popular
-- community's member count would otherwise degrade to a full scan as
-- real usage grows.
create index follows_followed_profile_id_idx
  on public.follows (followed_profile_id);

create index community_memberships_community_id_idx
  on public.community_memberships (community_id);
