-- Cuisine de François : tables et règles d'accès.
-- À coller dans Supabase > SQL Editor, puis « Run ». Peut être relancé sans risque.

do $$
declare t text;
begin
  foreach t in array array['recipes','cookbooks','plan','groceries'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )$f$, t);
    execute format('alter table public.%1$I enable row level security', t);
    execute format('drop policy if exists "mes lignes" on public.%1$I', t);
    execute format($f$
      create policy "mes lignes" on public.%1$I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$f$, t);
    execute format('create index if not exists %1$s_user_idx on public.%1$I (user_id)', t);
    execute format('grant select, insert, update, delete on public.%1$I to authenticated', t);
  end loop;
end $$;
