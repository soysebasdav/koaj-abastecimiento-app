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

export type MaterialRequirementDetail = {
  collectionId: string
  collectionCode: string
  periodMonth: string
  fitId: string
  fitCode: string
  fitName: string
  fitVersionId: string
  versionCode: string
  pieceName: string
  materialId: string
  materialCode: string
  materialName: string
  materialType: string
  unit: string
  projectedUnits: number
  sharePercentage: number
  versionUnits: number
  piecesPerUnit: number
  consumptionPerPiece: number
  wastePercentage: number
  effectiveConsumptionPerUnit: number
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

export async function listMaterialRequirementsDetail(): Promise<MaterialRequirementDetail[]> {
  const { data, error } = await supabase
    .from('v_material_requirements_detail')
    .select(`
      collection_id,
      collection_code,
      period_month,
      fit_id,
      fit_code,
      fit_name,
      fit_version_id,
      version_code,
      piece_name,
      material_id,
      material_code,
      material_name,
      material_type,
      unit,
      projected_units,
      share_percentage,
      version_units,
      pieces_per_unit,
      consumption_per_piece,
      waste_percentage,
      effective_consumption_per_unit,
      required_quantity
    `)
    .order('period_month', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    collectionId: row.collection_id,
    collectionCode: row.collection_code,
    periodMonth: row.period_month,
    fitId: row.fit_id,
    fitCode: row.fit_code,
    fitName: row.fit_name,
    fitVersionId: row.fit_version_id,
    versionCode: row.version_code,
    pieceName: row.piece_name,
    materialId: row.material_id,
    materialCode: row.material_code,
    materialName: row.material_name,
    materialType: row.material_type,
    unit: row.unit,
    projectedUnits: Number(row.projected_units ?? 0),
    sharePercentage: Number(row.share_percentage ?? 0),
    versionUnits: Number(row.version_units ?? 0),
    piecesPerUnit: Number(row.pieces_per_unit ?? 0),
    consumptionPerPiece: Number(row.consumption_per_piece ?? 0),
    wastePercentage: Number(row.waste_percentage ?? 0),
    effectiveConsumptionPerUnit: Number(row.effective_consumption_per_unit ?? 0),
    requiredQuantity: Number(row.required_quantity ?? 0),
  }))
}
