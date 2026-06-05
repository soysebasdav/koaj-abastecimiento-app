import { supabase } from '../../lib/supabase'
import type { MaterialRequirementMonthly } from '../supply/supplyService'
import { listMaterialRequirementsMonthly } from '../supply/supplyService'

export type DashboardData = {
  fitCount: number
  materialCount: number
  collectionCount: number
  forecastCount: number
  auditCount: number
  requirements: MaterialRequirementMonthly[]
}

async function getCount(tableName: string) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(error.message)

  return count ?? 0
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [fitCount, materialCount, collectionCount, forecastCount, auditCount, requirements] = await Promise.all([
    getCount('fits'),
    getCount('materials'),
    getCount('collections'),
    getCount('monthly_fit_forecasts'),
    getCount('audit_logs'),
    listMaterialRequirementsMonthly(),
  ])

  return {
    fitCount,
    materialCount,
    collectionCount,
    forecastCount,
    auditCount,
    requirements,
  }
}
