-- Ticket #5: Property + aerial base map.
-- Column shape mirrors packages/domain/src/property.ts's PropertyRow — keep them in sync.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  address text not null check (char_length(trim(address)) > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- Highest zoom confirmed to have imagery, or null if none was available
  -- anywhere probed (CONTEXT.md's Property still exists in that case — it
  -- just falls back to a photographed-plan or in-app-drawn base map, a
  -- later ticket).
  imagery_zoom smallint,
  imagery_available boolean not null default false,

  created_at timestamptz not null default now(),

  -- One Property per account for MVP (ticket #5's acceptance criteria).
  -- A plain column constraint, not a schema redesign, so relaxing this to
  -- allow more than one later needs only `drop constraint`, no migration
  -- of the table shape itself.
  constraint properties_one_per_user unique (user_id)
);

create index if not exists properties_user_id_idx on public.properties (user_id);

alter table public.properties enable row level security;

create policy "Properties are selectable by their owner"
  on public.properties for select
  using (auth.uid () = user_id);

create policy "Properties are insertable by their owner"
  on public.properties for insert
  with check (auth.uid () = user_id);

create policy "Properties are updatable by their owner"
  on public.properties for update
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

create policy "Properties are deletable by their owner"
  on public.properties for delete
  using (auth.uid () = user_id);
