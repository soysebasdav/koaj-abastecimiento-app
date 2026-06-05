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
  notes: string | null
}

export type VersionMixView = {
  id: string
  fitVersionId: string
  collectionId: string
  collectionCode: string
  fitId: string
  fitCode: string
  fitName: string
  versionCode: string
  description: string | null
  colorRangeStart: number | null
  colorRangeEnd: number | null
  colorRange: string
  mainMaterialId: string | null
  mainMaterialName: string
  sharePercentage: number
  validFromMonth: string
  validToMonth: string | null
  changeReason: string | null
  status: 'active' | 'inactive'
}

export type CollectionOption = {
  id: string
  code: string
  name: string
}

export type FitOption = {
  id: string
  code: string
  name: string
}

export type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  material_type: string
}

export type FitVersionOption = {
  id: string
  collectionCode: string
  fitName: string
  versionCode: string
}

export type BomFormOptions = {
  collections: CollectionOption[]
  fits: FitOption[]
  materials: MaterialOption[]
  fitVersions: FitVersionOption[]
}

export type VersionMixFormInput = {
  collection_id: string
  fit_id: string
  version_code: string
  description: string
  color_range_start: string
  color_range_end: string
  main_material_id: string
  share_percentage: string
  valid_from_month: string
  valid_to_month: string
  change_reason: string
  status: 'active' | 'inactive'
}

export type BomLineFormInput = {
  fit_version_id: string
  piece_name: string
  material_id: string
  pieces_per_unit: string
  consumption_per_piece: string
  waste_percentage: string
  valid_from_month: string
  valid_to_month: string
  status: 'active' | 'inactive'
  notes: string
}

export type FitVersionRecordForAudit = {
  id: string
  collection_id: string
  fit_id: string
  version_code: string
  description: string | null
  color_range_start: number | null
  color_range_end: number | null
  main_material_id: string | null
  status: 'active' | 'inactive'
}

export type FitVersionMixRecordForAudit = {
  id: string
  fit_version_id: string
  valid_from_month: string
  valid_to_month: string | null
  share_percentage: number
  change_reason: string | null
}

export type BomLineRecordForAudit = {
  id: string
  fit_version_id: string
  piece_name: string
  material_id: string
  pieces_per_unit: number
  consumption_per_piece: number
  waste_percentage: number
  valid_from_month: string
  valid_to_month: string | null
  status: 'active' | 'inactive'
  notes: string | null
}
