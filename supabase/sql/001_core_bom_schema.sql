-- ============================================================
-- KOAJ ABASTECIMIENTO APP
-- Core BOM schema corregido e idempotente
-- FIT -> Versiones -> Piezas -> Materiales -> Proyección -> Necesidad
-- ============================================================
-- Uso recomendado:
-- 1. Supabase -> SQL Editor -> New query
-- 2. Pegar este script completo
-- 3. Ejecutar
--
-- Correcciones incluidas:
-- - Corrige alias f.id -> mf.id en v_material_requirements_detail.
-- - Agrega DROP VIEW para poder recrear vistas.
-- - Agrega DROP POLICY IF EXISTS para que el script pueda re-ejecutarse.
-- ============================================================

create extension if not exists "pgcrypto";

-- =========================
-- 0. LIMPIEZA SEGURA DE VISTAS
-- =========================
-- Se eliminan primero porque dependen de las tablas.
-- No elimina datos de tablas.

drop view if exists public.v_material_requirements_monthly;
drop view if exists public.v_material_requirements_detail;

-- =========================
-- 1. COLECCIONES
-- =========================

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  start_month date not null,
  end_month date not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 2. FITS / SILUETAS
-- =========================

create table if not exists public.fits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  silhouette text not null,
  category text,
  gender text,
  portfolio text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 3. MATERIALES
-- =========================

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  material_type text not null
    check (material_type in (
      'fabric',
      'button',
      'pocket_fabric',
      'label',
      'zipper',
      'thread',
      'packaging',
      'other'
    )),
  unit text not null
    check (unit in ('meter', 'unit', 'kg', 'roll', 'box', 'package')),
  origin text
    check (origin in ('national', 'international')),
  supplier_name text,
  lead_time_days integer,
  is_fabric boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 4. COMPOSICIÓN DE TELAS
-- =========================

create table if not exists public.fabric_compositions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  component_name text not null,
  percentage numeric(6,2) not null check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

-- Nota:
-- La validación de que una tela sume exactamente 100% se hará luego con trigger
-- o en la capa de aplicación para permitir edición gradual.

-- =========================
-- 5. VERSIONES DEL FIT
-- =========================

create table if not exists public.fit_versions (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  fit_id uuid not null references public.fits(id) on delete cascade,
  version_code text not null,
  description text,
  color_range_start integer,
  color_range_end integer,
  main_material_id uuid references public.materials(id),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, fit_id, version_code)
);

-- =========================
-- 6. PORCENTAJE DE PARTICIPACIÓN DE VERSIONES
-- =========================
-- Normalmente definido por colección.
-- Puede cambiar desde un mes específico como caso especial.

create table if not exists public.fit_version_mix (
  id uuid primary key default gen_random_uuid(),
  fit_version_id uuid not null references public.fit_versions(id) on delete cascade,
  valid_from_month date not null,
  valid_to_month date,
  share_percentage numeric(6,2) not null check (share_percentage >= 0 and share_percentage <= 100),
  change_reason text,
  created_at timestamptz not null default now()
);

-- Regla funcional:
-- Para cada FIT + colección + mes, la suma de versiones activas debe ser 100%.
-- Esta regla se validará en aplicación y luego con función SQL.

-- =========================
-- 7. LÍNEAS BOM / PIEZAS POR VERSIÓN
-- =========================
-- Ejemplos de pieza:
-- base, botón, bolsillo, marquilla, cremallera, hilo, empaque.

create table if not exists public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  fit_version_id uuid not null references public.fit_versions(id) on delete cascade,
  piece_name text not null,
  material_id uuid not null references public.materials(id),
  pieces_per_unit numeric(12,4) not null default 1 check (pieces_per_unit > 0),
  consumption_per_piece numeric(12,4) not null check (consumption_per_piece >= 0),
  waste_percentage numeric(6,2) not null default 0 check (waste_percentage >= 0 and waste_percentage <= 100),
  effective_consumption_per_unit numeric(14,6)
    generated always as (
      pieces_per_unit * consumption_per_piece * (1 + waste_percentage / 100)
    ) stored,
  valid_from_month date not null,
  valid_to_month date,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 8. PROYECCIÓN MENSUAL POR FIT
-- =========================

create table if not exists public.monthly_fit_forecasts (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  fit_id uuid not null references public.fits(id) on delete cascade,
  period_month date not null,
  projected_units numeric(14,2) not null check (projected_units >= 0),
  version_label text not null default 'V1',
  source text not null default 'manual'
    check (source in ('manual', 'excel_import', 'commercial', 'internal_adjustment')),
  status text not null default 'active'
    check (status in ('draft', 'active', 'replaced')),
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, fit_id, period_month, version_label)
);

-- =========================
-- 9. FECHAS DE CONTROL POR MATERIAL
-- =========================
-- Las 4 fechas pueden variar según material.

create table if not exists public.material_control_dates (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  period_month date not null,
  control_date date not null,
  sequence_number integer not null check (sequence_number between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  unique (material_id, period_month, sequence_number)
);

-- =========================
-- 10. INPUTS DE KARDEX SEMANAL
-- =========================
-- Aquí guardamos datos manuales o cargados.
-- Los cálculos se harán en vistas o en la aplicación.

create table if not exists public.kardex_weekly_inputs (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  control_date_id uuid not null references public.material_control_dates(id) on delete cascade,
  total_bodega numeric(14,4) not null default 0,
  pedido numeric(14,4) not null default 0,
  transito numeric(14,4) not null default 0,
  stock_seguridad numeric(14,4) not null default 0,
  industrializacion numeric(14,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, control_date_id)
);

-- =========================
-- 11. AUDITORÍA
-- =========================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  module_name text not null,
  table_name text not null,
  record_id uuid,
  field_name text,
  old_value text,
  new_value text,
  change_type text not null
    check (change_type in (
      'create',
      'update',
      'delete',
      'future_change',
      'retroactive_change',
      'month_forward_change'
    )),
  affected_from_month date,
  affected_to_month date,
  reason text,
  created_at timestamptz not null default now()
);

-- =========================
-- 12. VISTA DETALLADA DE NECESIDAD MENSUAL
-- =========================

create or replace view public.v_material_requirements_detail as
select
  mf.id as forecast_id,
  c.id as collection_id,
  c.code as collection_code,
  ft.id as fit_id,
  ft.code as fit_code,
  ft.name as fit_name,
  mf.period_month,
  mf.projected_units,

  fv.id as fit_version_id,
  fv.version_code,
  fvm.share_percentage,
  (mf.projected_units * fvm.share_percentage / 100.0) as version_projected_units,

  bl.id as bom_line_id,
  bl.piece_name,
  m.id as material_id,
  m.code as material_code,
  m.name as material_name,
  m.material_type,
  m.unit,
  bl.pieces_per_unit,
  bl.consumption_per_piece,
  bl.waste_percentage,
  bl.effective_consumption_per_unit,

  (
    (mf.projected_units * fvm.share_percentage / 100.0)
    * bl.effective_consumption_per_unit
  ) as required_quantity

from public.monthly_fit_forecasts mf
join public.collections c
  on c.id = mf.collection_id
join public.fits ft
  on ft.id = mf.fit_id
join public.fit_versions fv
  on fv.collection_id = mf.collection_id
 and fv.fit_id = mf.fit_id
 and fv.status = 'active'
join public.fit_version_mix fvm
  on fvm.fit_version_id = fv.id
 and fvm.valid_from_month <= mf.period_month
 and (fvm.valid_to_month is null or fvm.valid_to_month >= mf.period_month)
join public.bom_lines bl
  on bl.fit_version_id = fv.id
 and bl.status = 'active'
 and bl.valid_from_month <= mf.period_month
 and (bl.valid_to_month is null or bl.valid_to_month >= mf.period_month)
join public.materials m
  on m.id = bl.material_id
where mf.status = 'active';

-- =========================
-- 13. VISTA AGRUPADA POR MATERIAL Y MES
-- =========================

create or replace view public.v_material_requirements_monthly as
select
  collection_id,
  collection_code,
  period_month,
  material_id,
  material_code,
  material_name,
  material_type,
  unit,
  sum(required_quantity) as required_quantity
from public.v_material_requirements_detail
group by
  collection_id,
  collection_code,
  period_month,
  material_id,
  material_code,
  material_name,
  material_type,
  unit;

-- =========================
-- 14. ÍNDICES
-- =========================

create index if not exists idx_fit_versions_collection_fit
  on public.fit_versions(collection_id, fit_id);

create index if not exists idx_fit_version_mix_version_dates
  on public.fit_version_mix(fit_version_id, valid_from_month, valid_to_month);

create index if not exists idx_bom_lines_version_dates
  on public.bom_lines(fit_version_id, valid_from_month, valid_to_month);

create index if not exists idx_forecasts_collection_fit_month
  on public.monthly_fit_forecasts(collection_id, fit_id, period_month);

create index if not exists idx_material_control_dates_material_month
  on public.material_control_dates(material_id, period_month);

-- =========================
-- 15. RLS BÁSICO
-- =========================
-- Por ahora permitimos lectura/escritura a usuarios autenticados.
-- Cuando creemos roles reales, refinamos estas políticas.

alter table public.collections enable row level security;
alter table public.fits enable row level security;
alter table public.materials enable row level security;
alter table public.fabric_compositions enable row level security;
alter table public.fit_versions enable row level security;
alter table public.fit_version_mix enable row level security;
alter table public.bom_lines enable row level security;
alter table public.monthly_fit_forecasts enable row level security;
alter table public.material_control_dates enable row level security;
alter table public.kardex_weekly_inputs enable row level security;
alter table public.audit_logs enable row level security;

-- =========================
-- 16. POLÍTICAS RLS
-- =========================
-- Se eliminan antes de recrearlas para permitir re-ejecutar el script.

drop policy if exists "authenticated_read_collections" on public.collections;
drop policy if exists "authenticated_write_collections" on public.collections;

drop policy if exists "authenticated_read_fits" on public.fits;
drop policy if exists "authenticated_write_fits" on public.fits;

drop policy if exists "authenticated_read_materials" on public.materials;
drop policy if exists "authenticated_write_materials" on public.materials;

drop policy if exists "authenticated_read_fabric_compositions" on public.fabric_compositions;
drop policy if exists "authenticated_write_fabric_compositions" on public.fabric_compositions;

drop policy if exists "authenticated_read_fit_versions" on public.fit_versions;
drop policy if exists "authenticated_write_fit_versions" on public.fit_versions;

drop policy if exists "authenticated_read_fit_version_mix" on public.fit_version_mix;
drop policy if exists "authenticated_write_fit_version_mix" on public.fit_version_mix;

drop policy if exists "authenticated_read_bom_lines" on public.bom_lines;
drop policy if exists "authenticated_write_bom_lines" on public.bom_lines;

drop policy if exists "authenticated_read_monthly_fit_forecasts" on public.monthly_fit_forecasts;
drop policy if exists "authenticated_write_monthly_fit_forecasts" on public.monthly_fit_forecasts;

drop policy if exists "authenticated_read_material_control_dates" on public.material_control_dates;
drop policy if exists "authenticated_write_material_control_dates" on public.material_control_dates;

drop policy if exists "authenticated_read_kardex_weekly_inputs" on public.kardex_weekly_inputs;
drop policy if exists "authenticated_write_kardex_weekly_inputs" on public.kardex_weekly_inputs;

drop policy if exists "authenticated_read_audit_logs" on public.audit_logs;
drop policy if exists "authenticated_write_audit_logs" on public.audit_logs;

create policy "authenticated_read_collections"
on public.collections for select
to authenticated
using (true);

create policy "authenticated_write_collections"
on public.collections for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_fits"
on public.fits for select
to authenticated
using (true);

create policy "authenticated_write_fits"
on public.fits for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_materials"
on public.materials for select
to authenticated
using (true);

create policy "authenticated_write_materials"
on public.materials for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_fabric_compositions"
on public.fabric_compositions for select
to authenticated
using (true);

create policy "authenticated_write_fabric_compositions"
on public.fabric_compositions for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_fit_versions"
on public.fit_versions for select
to authenticated
using (true);

create policy "authenticated_write_fit_versions"
on public.fit_versions for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_fit_version_mix"
on public.fit_version_mix for select
to authenticated
using (true);

create policy "authenticated_write_fit_version_mix"
on public.fit_version_mix for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_bom_lines"
on public.bom_lines for select
to authenticated
using (true);

create policy "authenticated_write_bom_lines"
on public.bom_lines for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_monthly_fit_forecasts"
on public.monthly_fit_forecasts for select
to authenticated
using (true);

create policy "authenticated_write_monthly_fit_forecasts"
on public.monthly_fit_forecasts for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_material_control_dates"
on public.material_control_dates for select
to authenticated
using (true);

create policy "authenticated_write_material_control_dates"
on public.material_control_dates for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_kardex_weekly_inputs"
on public.kardex_weekly_inputs for select
to authenticated
using (true);

create policy "authenticated_write_kardex_weekly_inputs"
on public.kardex_weekly_inputs for all
to authenticated
using (true)
with check (true);

create policy "authenticated_read_audit_logs"
on public.audit_logs for select
to authenticated
using (true);

create policy "authenticated_write_audit_logs"
on public.audit_logs for insert
to authenticated
with check (true);
