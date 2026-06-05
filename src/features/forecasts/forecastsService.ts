import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import type {
  ForecastFormInput,
  ForecastFormOptions,
  ForecastView,
  MonthForwardForecastInput,
} from './forecastsTypes'

export async function listForecasts(): Promise<ForecastView[]> {
  const { data, error } = await supabase
    .from('monthly_fit_forecasts')
    .select(`
      id,
      collection_id,
      fit_id,
      period_month,
      projected_units,
      version_label,
      source,
      status,
      change_reason,
      collections (
        code,
        name
      ),
      fits (
        code,
        name,
        category
      )
    `)
    .order('period_month', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    collectionCode: row.collections?.code ?? '-',
    collectionName: row.collections?.name ?? '-',
    fitId: row.fit_id,
    fitCode: row.fits?.code ?? '-',
    fitName: row.fits?.name ?? '-',
    fitCategory: row.fits?.category ?? null,
    periodMonth: row.period_month,
    projectedUnits: Number(row.projected_units ?? 0),
    versionLabel: row.version_label,
    source: row.source,
    status: row.status,
    changeReason: row.change_reason,
  }))
}

export async function getForecastFormOptions(): Promise<ForecastFormOptions> {
  const [collectionsResult, fitsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('id, code, name, start_month, end_month')
      .order('code', { ascending: true }),
    supabase
      .from('fits')
      .select('id, code, name, category')
      .eq('status', 'active')
      .order('code', { ascending: true }),
  ])

  if (collectionsResult.error) throw new Error(collectionsResult.error.message)
  if (fitsResult.error) throw new Error(fitsResult.error.message)

  return {
    collections: collectionsResult.data ?? [],
    fits: fitsResult.data ?? [],
  }
}

export async function createForecast(input: ForecastFormInput, auditReason: string): Promise<ForecastView> {
  const payload = normalizeForecastPayload(input)

  const { data, error } = await supabase
    .from('monthly_fit_forecasts')
    .insert(payload)
    .select(`
      id,
      collection_id,
      fit_id,
      period_month,
      projected_units,
      version_label,
      source,
      status,
      change_reason,
      collections (
        code,
        name
      ),
      fits (
        code,
        name,
        category
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'forecasts',
    tableName: 'monthly_fit_forecasts',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapForecastRow(data)
}

export async function updateForecast(
  id: string,
  previous: ForecastView,
  input: ForecastFormInput,
  auditReason: string,
): Promise<ForecastView> {
  const payload = normalizeForecastPayload(input)

  const { data, error } = await supabase
    .from('monthly_fit_forecasts')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      collection_id,
      fit_id,
      period_month,
      projected_units,
      version_label,
      source,
      status,
      change_reason,
      collections (
        code,
        name
      ),
      fits (
        code,
        name,
        category
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'forecasts',
    tableName: 'monthly_fit_forecasts',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: payload.period_month,
    affectedToMonth: payload.period_month,
    reason: auditReason,
  })

  return mapForecastRow(data)
}

export async function applyForecastFromMonth(input: MonthForwardForecastInput, auditReason: string) {
  const fromMonth = fromMonthInputValue(input.from_month)
  const toMonth = fromMonthInputValue(input.to_month)

  if (!fromMonth || !toMonth) {
    throw new Error('Mes inicial y mes final son obligatorios.')
  }

  if (toMonth < fromMonth) {
    throw new Error('El mes final no puede ser anterior al mes inicial.')
  }

  const months = buildMonthRange(fromMonth, toMonth)
  const projectedUnits = Number(input.projected_units)

  if (Number.isNaN(projectedUnits) || projectedUnits < 0) {
    throw new Error('Las unidades proyectadas deben ser un número mayor o igual a 0.')
  }

  const { data: previousActive, error: selectError } = await supabase
    .from('monthly_fit_forecasts')
    .select('id, period_month, projected_units, version_label, status')
    .eq('collection_id', input.collection_id)
    .eq('fit_id', input.fit_id)
    .eq('status', 'active')
    .gte('period_month', fromMonth)
    .lte('period_month', toMonth)

  if (selectError) throw new Error(selectError.message)

  if (previousActive && previousActive.length > 0) {
    const { error: replaceError } = await supabase
      .from('monthly_fit_forecasts')
      .update({
        status: 'replaced',
        updated_at: new Date().toISOString(),
      })
      .in('id', previousActive.map((row) => row.id))

    if (replaceError) throw new Error(replaceError.message)
  }

  const rows = months.map((month) => ({
    collection_id: input.collection_id,
    fit_id: input.fit_id,
    period_month: month,
    projected_units: projectedUnits,
    version_label: input.version_label.trim(),
    source: input.source,
    status: 'active',
    change_reason: input.change_reason.trim() || null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('monthly_fit_forecasts')
    .upsert(rows, {
      onConflict: 'collection_id,fit_id,period_month,version_label',
    })
    .select('id')

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'forecasts',
    tableName: 'monthly_fit_forecasts',
    recordId: data?.[0]?.id ?? null,
    fieldName: 'projected_units',
    oldValue: previousActive ?? [],
    newValue: rows,
    changeType: 'month_forward_change',
    affectedFromMonth: fromMonth,
    affectedToMonth: toMonth,
    reason: auditReason,
  })

  return data ?? []
}

function normalizeForecastPayload(input: ForecastFormInput) {
  return {
    collection_id: input.collection_id,
    fit_id: input.fit_id,
    period_month: fromMonthInputValue(input.period_month),
    projected_units: Number(input.projected_units),
    version_label: input.version_label.trim(),
    source: input.source,
    status: input.status,
    change_reason: input.change_reason.trim() || null,
  }
}

function mapForecastRow(row: any): ForecastView {
  return {
    id: row.id,
    collectionId: row.collection_id,
    collectionCode: row.collections?.code ?? '-',
    collectionName: row.collections?.name ?? '-',
    fitId: row.fit_id,
    fitCode: row.fits?.code ?? '-',
    fitName: row.fits?.name ?? '-',
    fitCategory: row.fits?.category ?? null,
    periodMonth: row.period_month,
    projectedUnits: Number(row.projected_units ?? 0),
    versionLabel: row.version_label,
    source: row.source,
    status: row.status,
    changeReason: row.change_reason,
  }
}

export function toMonthInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 7)
}

export function fromMonthInputValue(value: string) {
  return value ? `${value}-01` : ''
}

function buildMonthRange(fromMonth: string, toMonth: string) {
  const months: string[] = []
  const cursor = new Date(`${fromMonth.slice(0, 10)}T00:00:00`)
  const end = new Date(`${toMonth.slice(0, 10)}T00:00:00`)

  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    months.push(`${year}-${month}-01`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}
