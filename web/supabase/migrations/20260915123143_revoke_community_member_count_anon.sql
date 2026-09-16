-- Follow-up hardening for community_member_count(): verification after
-- the previous migration showed `anon` could still execute the function
-- despite `revoke ... from public`. Supabase's project-level default
-- privileges grant `anon` a direct EXECUTE grant on new public functions,
-- independent of the PUBLIC pseudo-role revoke, so it must be revoked
-- explicitly. No other change.
revoke execute on function public.community_member_count(text) from anon;
