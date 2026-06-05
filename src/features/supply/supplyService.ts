import { supabase } from '../../lib/supabase'

export type MaterialRequirementMonthly = {
  collectionId: string
  collectionCode: string
  periodMonth: string
  materialId: string
  materialCode: string
  materialName: string
  materialType: string
  unit: string
  requiredQuantity: number
}

export async function listMaterialRequirementsMonthly(): Promise<MaterialRequirementMonthly[]> {
  const { data, error } = await supabase
    .from('v_material_requirements_monthly')
    .select(`
      collection_id,
      collection_code,
      period_month,
      material_id,
      material_code,
      material_name,
      material_type,
      unit,
      required_quantity
    `)
    .order('period_month', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    collectionId: row.collection_id,
    collectionCode: row.collection_code,
    periodMonth: row.period_month,
    materialId: row.material_id,
    materialCode: row.material_code,
    materialName: row.material_name,
    materialType: row.material_type,
    unit: row.unit,
    requiredQuantity: Number(row.required_quantity ?? 0),
  }))
}
