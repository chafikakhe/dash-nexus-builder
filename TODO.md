# TODO

- [ ] Inspect all Supabase migrations/SQL files that define `public.accept_invitation`.
- [ ] Draft a precise edit plan:
  - rename function parameter (token -> p_token)
  - add table aliasing to avoid ambiguous references
  - ensure SECURITY DEFINER + `set search_path = public`
  - preserve invite validation / insert member / dashboard assignment / invite deletion logic
- [ ] After plan approval, implement the SQL fix in the correct migration/SQL file(s) used to deploy.
- [ ] Update any frontend RPC calls if the parameter name is expected to change.
- [ ] Run a quick repo search to confirm no remaining references to the old parameter signature.
- [ ] Provide final verification steps (Supabase SQL editor call / RPC smoke te