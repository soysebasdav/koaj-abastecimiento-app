import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import { formatMaterialTypeLabel, normalizeMaterialTypeKey } from '../../utils/materialTypes'
import type {
  ControlDateFormInput,
  ControlDateRecordForAudit,
  GanttOptions,
  MaterialFitStart,
  MaterialSummary,
  MaterialTypeControlDate,
  MaterialTypeOption,
  MaterialTypeProcessDate,
  ProcessDateFormInput,
  ProcessDateRecordForAudit,
} from './ganttTypes'

export async function getGanttOptions(): Promise<GanttOptions> {
  const [materials, controlDates, processDates, fitStarts] = await Promise.all([
    listMaterialsForGantt(),
    listMaterialTypeControlDates(),
    listMaterialTypeProcessDates(),
    listMaterialFitStarts(),
  ])

  return {
    materialTypes: buildMaterialTypeOptions(materials),
    materials,
    controlDates,
    processDates,
    fitStarts,
  }
}

export async function listMaterialsForGantt(): Promise<MaterialSummary[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('id, code, name, material_type, unit, image_url, status')
    .eq('status', 'active')
    .order('material_type', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    materialType: row.material_type || 'other',
    materialTypeLabel: formatMaterialTypeLabel(row.material_type || 'other'),
    unit: row.unit ?? '',
    imageUrl: row.image_url ?? null,
  }))
}

export async function listMaterialTypeControlDates(): Promise<MaterialTypeControlDate[]> {
  const { data, error } = await supabase
    .from('material_type_control_dates')
    .select('id, material_type, period_month, control_number, control_date, label, status, notes, created_at, updated_at')
    .order('period_month', { ascending: true })
    .order('control_number', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(mapControlDateRow)
}

export async function listMaterialTypeProcessDates(): Promise<MaterialTypeProcessDate[]> {
  const { data, error } = await supabase
    .from('material_type_process_dates')
    .select('id, material_type, period_month, process_name, process_date, sequence_order, status, notes, created_at, updated_at')
    .order('period_month', { ascending: true })
    .order('sequence_order', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(mapProcessDateRow)
}

export async function listMaterialFitStarts(): Promise<MaterialFitStart[]> {
  const { data, error } = await supabase
    .from('v_material_gantt_fit_start')
    .select('material_id, material_code, material_name, material_type, unit, first_period_month, fit_codes, required_quantity')
    .order('first_period_month', { ascending: true })

  if (error) {
    return []
  }

  return ((data ?? []) as any[]).map((row) => ({
    materialId: row.material_id,
    materialCode: row.material_code,
    materialName: row.material_name,
    materialType: row.material_type || 'other',
    materialTypeLabel: formatMaterialTypeLabel(row.material_type || 'other'),
    unit: row.unit ?? '',
    firstPeriodMonth: row.first_period_month,
    fitCodes: Array.isArray(row.fit_codes) ? row.fit_codes : [],
    requiredQuantity: Number(row.required_quantity ?? 0),
  }))
}

export async function createControlDate(input: ControlDateFormInput, auditReason: string): Promise<MaterialTypeControlDate> {
  const payload = normalizeControlDatePayload(input)
  await assertControlDateLimit(payload.material_type, payload.period_month, payload.control_number)

  const { data, error } = await supabase
    .from('material_type_control_dates')
    .insert(payload)
    .select('id, material_type, period_month, control_number, control_date, label, status, notes, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'gantt',
    tableName: 'material_type_control_dates',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapControlDateRow(data)
}

export async function updateControlDate(
  id: string,
  previous: ControlDateRecordForAudit,
  input: ControlDateFormInput,
  auditReason: string,
): Promise<MaterialTypeControlDate> {
  const payload = normalizeControlDatePayload(input)
  await assertControlDateLimit(payload.material_type, payload.period_month, payload.control_number, id)

  const { data, error } = await supabase
    .from('material_type_control_dates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, material_type, period_month, control_number, control_date, label, status, notes, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'gantt',
    tableName: 'material_type_control_dates',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapControlDateRow(data)
}

export async function createProcessDate(input: ProcessDateFormInput, auditReason: string): Promise<MaterialTypeProcessDate> {
  const payload = normalizeProcessDatePayload(input)

  const { data, error } = await supabase
    .from('material_type_process_dates')
    .insert(payload)
    .select('id, material_type, period_month, process_name, process_date, sequence_order, status, notes, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'gantt',
    tableName: 'material_type_process_dates',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapProcessDateRow(data)
}

export async function updateProcessDate(
  id: string,
  previous: ProcessDateRecordForAudit,
  input: ProcessDateFormInput,
  auditReason: string,
): Promise<MaterialTypeProcessDate> {
  const payload = normalizeProcessDatePayload(input)

  const { data, error } = await supabase
    .from('material_type_process_dates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, material_type, period_month, process_name, process_date, sequence_order, status, notes, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'gantt',
    tableName: 'material_type_process_dates',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapProcessDateRow(data)
}

async function assertControlDateLimit(materialType: string, periodMonth: string, controlNumber: number, excludeId?: string) {
  let query = supabase
    .from('material_type_control_dates')
    .select('id, control_number', { count: 'exact' })
    .eq('material_type', materialType)
    .eq('period_month', periodMonth)
    .neq('status', 'cancelled')

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, count, error } = await query

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{ id: string; control_number: number }>

  if (rows.some((row) => Number(row.control_number) === controlNumber)) {
    throw new Error('Ya existe una fecha de control con ese número para este tipo de material y mes.')
  }

  if ((count ?? 0) >= 4) {
    throw new Error('Este tipo de material ya tiene 4 fechas de control activas para el mes seleccionado.')
  }
}

function normalizeControlDatePayload(input: ControlDateFormInput) {
  const materialType = normalizeMaterialTypeKey(input.material_type)
  const controlNumber = Number(input.control_number || 1)

  return {
    material_type: materialType,
    period_month: fromMonthInputValue(input.period_month),
    control_number: controlNumber,
    control_date: input.control_date,
    label: input.label.trim() || `Control ${controlNumber}`,
    status: input.status,
    notes: input.notes.trim() || null,
  }
}

function normalizeProcessDatePayload(input: ProcessDateFormInput) {
  const processDate = input.process_date
  const periodMonth = processDate ? `${processDate.slice(0, 7)}-01` : fromMonthInputValue(input.period_month)

  return {
    material_type: normalizeMaterialTypeKey(input.material_type),
    period_month: periodMonth,
    process_name: input.process_name.trim() || 'Proceso',
    process_date: input.process_date,
    sequence_order: Number(input.sequence_order || 1),
    status: input.status,
    notes: input.notes.trim() || null,
  }
}

function mapControlDateRow(row: any): MaterialTypeControlDate {
  return {
    id: row.id,
    materialType: row.material_type,
    materialTypeLabel: formatMaterialTypeLabel(row.material_type),
    periodMonth: row.period_month,
    controlNumber: Number(row.control_number ?? 0),
    controlDate: row.control_date,
    label: row.label ?? `Control ${row.control_number ?? ''}`.trim(),
    status: row.status ?? 'planned',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProcessDateRow(row: any): MaterialTypeProcessDate {
  return {
    id: row.id,
    materialType: row.material_type,
    materialTypeLabel: formatMaterialTypeLabel(row.material_type),
    periodMonth: row.period_month,
    processName: row.process_name,
    processDate: row.process_date,
    sequenceOrder: Number(row.sequence_order ?? 0),
    status: row.status ?? 'planned',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildMaterialTypeOptions(materials: MaterialSummary[]): MaterialTypeOption[] {
  const grouped = materials.reduce<Record<string, MaterialTypeOption>>((acc, material) => {
    const key = material.materialType || 'other'
    const current = acc[key] ?? {
      materialType: key,
      label: formatMaterialTypeLabel(key),
      unit: material.unit,
      materialCount: 0,
      sampleMaterials: [],
    }

    current.materialCount += 1
    if (current.sampleMaterials.length < 4) {
      current.sampleMaterials.push(`${material.code} · ${material.name}`)
    }

    acc[key] = current
    return acc
  }, {})

  return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export function toMonthInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 7)
}

function fromMonthInputValue(value: string) {
  return value ? `${value}-01` : ''
}
