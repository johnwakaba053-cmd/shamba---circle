-- Security hardening: public.handle_new_user() is a trigger-only function
-- (AFTER INSERT ON auth.users). Because it lives in the public schema,
-- PostgREST otherwise exposes it as a callable RPC endpoint to anyone,
-- signed in or not. Revoking EXECUTE closes that exposed-API path.
--
-- This does NOT affect the trigger itself: Postgres invokes trigger
-- functions directly as part of the triggering DML statement, not via a
-- privilege-checked call from the session role, so on_auth_user_created
-- keeps firing normally regardless of these grants.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
