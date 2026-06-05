import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import type {
  ControlDateFormInput,
  ControlDateRecordForAudit,
  KardexInputFormInput,
  KardexInputRecordForAudit,
  KardexInputView,
  KardexOptions,
  MaterialControlDateView,
} from './kardexTypes'

export async function listKardexInputs(): Promise<KardexInputView[]> {
  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .select(`
      id,
      material_id,
      control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        unit
      ),
      material_control_dates (
        period_month,
        control_date,
        sequence_number
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(mapKardexInputRow)
}

export async function listControlDates(): Promise<MaterialControlDateView[]> {
  const { data, error } = await supabase
    .from('material_control_dates')
    .select(`
      id,
      material_id,
      period_month,
      control_date,
      sequence_number,
      created_at,
      materials (
        code,
        name,
        unit
      )
    `)
    .order('period_month', { ascending: false })
    .order('sequence_number', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(mapControlDateRow)
}

export async function getKardexOptions(): Promise<KardexOptions> {
  const [materialsResult, controlDates] = await Promise.all([
    supabase
      .from('materials')
      .select('id, code, name, unit')
      .eq('status', 'active')
      .order('code', { ascending: true }),
    listControlDates(),
  ])

  if (materialsResult.error) throw new Error(materialsResult.error.message)

  return {
    materials: materialsResult.data ?? [],
    controlDates,
  }
}

export async function createControlDate(input: ControlDateFormInput, auditReason: string) {
  const payload = normalizeControlDatePayload(input)

  const { data, error } = await supabase
    .from('material_control_dates')
    .insert(payload)
    .select(`
      id,
      material_id,
      period_month,
      control_date,
      sequence_number,
      created_at,
      materials (
        code,
        name,
        unit
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'material_control_dates',
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
) {
  const payload = normalizeControlDatePayload(input)

  const { data, error } = await supabase
    .from('material_control_dates')
    .update(payload)
    .eq('id', id)
    .select(`
      id,
      material_id,
      period_month,
      control_date,
      sequence_number,
      created_at,
      materials (
        code,
        name,
        unit
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'material_control_dates',
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

export async function createKardexInput(input: KardexInputFormInput, auditReason: string) {
  const payload = normalizeKardexInputPayload(input)

  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .insert(payload)
    .select(`
      id,
      material_id,
      control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        unit
      ),
      material_control_dates (
        period_month,
        control_date,
        sequence_number
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'kardex_weekly_inputs',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: data.material_control_dates?.period_month ?? null,
    affectedToMonth: data.material_control_dates?.period_month ?? null,
    reason: auditReason,
  })

  return mapKardexInputRow(data)
}

export async function updateKardexInput(
  id: string,
  previous: KardexInputRecordForAudit,
  input: KardexInputFormInput,
  auditReason: string,
) {
  const payload = normalizeKardexInputPayload(input)

  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      material_id,
      control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        unit
      ),
      material_control_dates (
        period_month,
        control_date,
        sequence_number
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'kardex_weekly_inputs',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: data.material_control_dates?.period_month ?? null,
    affectedToMonth: data.material_control_dates?.period_month ?? null,
    reason: auditReason,
  })

  return mapKardexInputRow(data)
}

function normalizeControlDatePayload(input: ControlDateFormInput) {
  return {
    material_id: input.material_id,
    period_month: fromMonthInputValue(input.period_month),
    control_date: input.control_date,
    sequence_number: Number(input.sequence_number),
  }
}

function normalizeKardexInputPayload(input: KardexInputFormInput) {
  return {
    material_id: input.material_id,
    control_date_id: input.control_date_id,
    total_bodega: Number(input.total_bodega || 0),
    pedido: Number(input.pedido || 0),
    transito: Number(input.transito || 0),
    stock_seguridad: Number(input.stock_seguridad || 0),
    industrializacion: Number(input.industrializacion || 0),
    notes: input.notes.trim() || null,
  }
}

function mapKardexInputRow(row: any): KardexInputView {
  const totalBodega = Number(row.total_bodega ?? 0)
  const pedido = Number(row.pedido ?? 0)
  const transito = Number(row.transito ?? 0)
  const stockSeguridad = Number(row.stock_seguridad ?? 0)
  const industrializacion = Number(row.industrializacion ?? 0)

  return {
    id: row.id,
    materialId: row.material_id,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    unit: row.materials?.unit ?? '',
    controlDateId: row.control_date_id,
    periodMonth: row.material_control_dates?.period_month ?? '',
    controlDate: row.material_control_dates?.control_date ?? '',
    sequenceNumber: Number(row.material_control_dates?.sequence_number ?? 0),
    totalBodega,
    pedido,
    transito,
    stockSeguridad,
    industrializacion,
    availableBalance: totalBodega + pedido + transito - stockSeguridad - industrializacion,
    notes: row.notes,
  }
}

function mapControlDateRow(row: any): MaterialControlDateView {
  return {
    id: row.id,
    materialId: row.material_id,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    unit: row.materials?.unit ?? '',
    periodMonth: row.period_month,
    controlDate: row.control_date,
    sequenceNumber: Number(row.sequence_number ?? 0),
    createdAt: row.created_at,
  }
}

export function toMonthInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 7)
}

export function fromMonthInputValue(value: string) {
  return value ? `${value}-01` : ''
}
