-- Ticket #12: Task completion logging, history, and one-off todos.
-- Column shape mirrors packages/domain/src/oneOffTodo.ts's OneOffTodoRow — keep them in sync.

create table if not exists public.one_off_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  text text not null check (char_length(trim(text)) > 0),
  done boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists one_off_todos_user_id_idx on public.one_off_todos (user_id);

alter table public.one_off_todos enable row level security;

-- Owned directly by the account, not via any Plant/Planting join — a
-- One-off todo lives outside the Care task template system entirely, per
-- CONTEXT.md.
create policy "One-off todos are selectable by their owner"
  on public.one_off_todos for select
  using (auth.uid () = user_id);

create policy "One-off todos are insertable by their owner"
  on public.one_off_todos for insert
  with check (auth.uid () = user_id);

create policy "One-off todos are updatable by their owner"
  on public.one_off_todos for update
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

create policy "One-off todos are deletable by their owner"
  on public.one_off_todos for delete
  using (auth.uid () = user_id);
