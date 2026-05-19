create table if not exists public.pulselog_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pulselog_state enable row level security;

drop policy if exists "Users can read their own PulseLog state" on public.pulselog_state;
create policy "Users can read their own PulseLog state"
on public.pulselog_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own PulseLog state" on public.pulselog_state;
create policy "Users can insert their own PulseLog state"
on public.pulselog_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own PulseLog state" on public.pulselog_state;
create policy "Users can update their own PulseLog state"
on public.pulselog_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.pulselog_state;
