import { supabase } from '../../lib/supabase'

export type ForecastView = {
  id: string
  collectionCode: string
  collectionName: string
  fitCode: string
  fitName: string
  fitCategory: string | null
  periodMonth: string
  projectedUnits: number
  versionLabel: string
  source: string
  status: 'draft' | 'active' | 'replaced'
  changeReason: string | null
}

export async function listForecasts(): Promise<ForecastView[]> {
  const { data, error } = await supabase
    .from('monthly_fit_forecasts')
    .select(`
      id,
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
    collectionCode: row.collections?.code ?? '-',
    collectionName: row.collections?.name ?? '-',
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
