import { supabase } from '../../lib/supabase'

export type BomLineView = {
  id: string
  collectionCode: string
  collectionName: string
  fitCode: string
  fitName: string
  versionCode: string
  pieceName: string
  materialCode: string
  materialName: string
  materialUnit: string
  piecesPerUnit: number
  consumptionPerPiece: number
  wastePercentage: number
  effectiveConsumptionPerUnit: number
  validFromMonth: string
  validToMonth: string | null
  status: 'active' | 'inactive'
}

export type VersionMixView = {
  id: string
  collectionCode: string
  fitCode: string
  fitName: string
  versionCode: string
  colorRange: string
  mainMaterialName: string
  sharePercentage: number
  validFromMonth: string
  validToMonth: string | null
  changeReason: string | null
  status: 'active' | 'inactive'
}

export async function listBomLines(): Promise<BomLineView[]> {
  const { data, error } = await supabase
    .from('bom_lines')
    .select(`
      id,
      piece_name,
      pieces_per_unit,
      consumption_per_piece,
      waste_percentage,
      effective_consumption_per_unit,
      valid_from_month,
      valid_to_month,
      status,
      materials (
        code,
        name,
        unit
      ),
      fit_versions (
        version_code,
        collections (
          code,
          name
        ),
        fits (
          code,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    collectionCode: row.fit_versions?.collections?.code ?? '-',
    collectionName: row.fit_versions?.collections?.name ?? '-',
    fitCode: row.fit_versions?.fits?.code ?? '-',
    fitName: row.fit_versions?.fits?.name ?? '-',
    versionCode: row.fit_versions?.version_code ?? '-',
    pieceName: row.piece_name,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    materialUnit: row.materials?.unit ?? '',
    piecesPerUnit: Number(row.pieces_per_unit ?? 0),
    consumptionPerPiece: Number(row.consumption_per_piece ?? 0),
    wastePercentage: Number(row.waste_percentage ?? 0),
    effectiveConsumptionPerUnit: Number(row.effective_consumption_per_unit ?? 0),
    validFromMonth: row.valid_from_month,
    validToMonth: row.valid_to_month,
    status: row.status,
  }))
}

export async function listVersionMix(): Promise<VersionMixView[]> {
  const { data, error } = await supabase
    .from('fit_version_mix')
    .select(`
      id,
      valid_from_month,
      valid_to_month,
      share_percentage,
      change_reason,
      fit_versions (
        version_code,
        color_range_start,
        color_range_end,
        status,
        collections (
          code
        ),
        fits (
          code,
          name
        ),
        materials (
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => {
    const version = row.fit_versions
    const start = version?.color_range_start
    const end = version?.color_range_end

    return {
      id: row.id,
      collectionCode: version?.collections?.code ?? '-',
      fitCode: version?.fits?.code ?? '-',
      fitName: version?.fits?.name ?? '-',
      versionCode: version?.version_code ?? '-',
      colorRange: start && end ? `${start}-${end}` : '-',
      mainMaterialName: version?.materials?.name ?? 'No definido',
      sharePercentage: Number(row.share_percentage ?? 0),
      validFromMonth: row.valid_from_month,
      validToMonth: row.valid_to_month,
      changeReason: row.change_reason,
      status: version?.status ?? 'active',
    }
  })
}
