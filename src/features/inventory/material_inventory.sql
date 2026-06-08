-- Tabla requerida para persistir el inventario de bodega por material en Supabase.
-- Ejecutar en SQL Editor si todavía no existe.

create table if not exists public.material_inventory (
  material_id uuid primary key references public.materials(id) on delete cascade,
  total_bodega numeric not null default 0 check (total_bodega >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_inventory enable row level security;

drop policy if exists material_inventory_select_authenticated on public.material_inventory;
create policy material_inventory_select_authenticated
  on public.material_inventory
  for select
  to authenticated
  using (true);

drop policy if exists material_inventory_insert_authenticated on public.material_inventory;
create policy material_inventory_insert_authenticated
  on public.material_inventory
  for insert
  to authenticated
  with check (true);

drop policy if exists material_inventory_update_authenticated on public.material_inventory;
create policy material_inventory_update_authenticated
  on public.material_inventory
  for update
  to authenticated
  using (true)
  with check (true);
