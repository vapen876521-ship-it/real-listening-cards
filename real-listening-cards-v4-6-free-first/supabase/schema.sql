create table if not exists public.wordbook_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  analysis jsonb not null,
  samples jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  notes text not null default '',
  category text not null default '默认生词库',
  status text not null default 'new',
  mistake_count integer not null default 0,
  source_type text not null default 'search',
  import_batch_id text,
  due_at timestamptz not null default now(),
  reviews jsonb not null default '[]'::jsonb,
  feedback jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.wordbook_items enable row level security;

drop policy if exists "Users can read own wordbook items" on public.wordbook_items;
create policy "Users can read own wordbook items"
on public.wordbook_items for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own wordbook items" on public.wordbook_items;
create policy "Users can insert own wordbook items"
on public.wordbook_items for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own wordbook items" on public.wordbook_items;
create policy "Users can update own wordbook items"
on public.wordbook_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wordbook items" on public.wordbook_items;
create policy "Users can delete own wordbook items"
on public.wordbook_items for delete
using (auth.uid() = user_id);
