-- Drop the original `artifacts` table and its trigger function.
--
-- It predates every migration in this repo (it was made by hand when Shape
-- first tried Supabase), nothing in the app reads or writes it, and its
-- row-level-security policies let anyone with the public key insert and
-- update rows ("Anyone can publish for now" / "Anyone can update for now") —
-- an open write path on a table nobody uses. It held one row, a "Supabase
-- smoke test" from 2026-05-23, kept by the owner before dropping.
--
-- set_updated_at() existed only for its trigger. `if exists` keeps a fresh
-- replay (where neither was ever created) a no-op.

drop table if exists public.artifacts;
drop function if exists public.set_updated_at();
