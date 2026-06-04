create table if not exists public.knowledge_items (
  id text primary key,
  group_id text not null check (group_id in ('hero', 'troop', 'building', 'combat', 'resource', 'unlock')),
  title text not null,
  category text not null,
  keywords text[] not null default '{}',
  content text not null default '',
  summary text not null default '',
  steps text[] not null default '{}',
  risk text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_items_group_id_idx
  on public.knowledge_items (group_id);

create index if not exists knowledge_items_title_idx
  on public.knowledge_items (title);

create or replace function public.set_knowledge_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_items_set_updated_at on public.knowledge_items;
create trigger knowledge_items_set_updated_at
before update on public.knowledge_items
for each row
execute function public.set_knowledge_items_updated_at();

alter table public.knowledge_items enable row level security;

-- Demo policy: allows the browser admin page to manage knowledge with the anon key.
-- Production should replace this with authenticated admin-only policies.
drop policy if exists "knowledge_items_read" on public.knowledge_items;
create policy "knowledge_items_read"
on public.knowledge_items
for select
to anon, authenticated
using (true);

drop policy if exists "knowledge_items_insert" on public.knowledge_items;
create policy "knowledge_items_insert"
on public.knowledge_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "knowledge_items_update" on public.knowledge_items;
create policy "knowledge_items_update"
on public.knowledge_items
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "knowledge_items_delete" on public.knowledge_items;
create policy "knowledge_items_delete"
on public.knowledge_items
for delete
to anon, authenticated
using (true);
