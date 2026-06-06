import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import type {
  BomFormOptions,
  BomLineFormInput,
  BomLineRecordForAudit,
  BomLineView,
  FitVersionMixRecordForAudit,
  FitVersionRecordForAudit,
  VersionMixFormInput,
  VersionMixView,
} from './bomTypes'

export async function listBomLines(): Promise<BomLineView[]> {
  const { data, error } = await supabase
    .from('bom_lines')
    .select(`
      id,
      fit_version_id,
      material_id,
      piece_name,
      image_url,
      pieces_per_unit,
      consumption_per_piece,
      waste_percentage,
      effective_consumption_per_unit,
      valid_from_month,
      valid_to_month,
      status,
      notes,
      materials (
        code,
        name,
        material_type,
        unit
      ),
      fit_versions (
        version_code,
        image_url,
        collections (
          code,
          name
        ),
        fits (
          code,
          name,
          image_url
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    fitVersionId: row.fit_version_id,
    materialId: row.material_id,
    collectionCode: row.fit_versions?.collections?.code ?? '-',
    collectionName: row.fit_versions?.collections?.name ?? '-',
    fitCode: row.fit_versions?.fits?.code ?? '-',
    fitName: row.fit_versions?.fits?.name ?? '-',
    fitImageUrl: row.fit_versions?.fits?.image_url ?? null,
    versionCode: row.fit_versions?.version_code ?? '-',
    versionImageUrl: row.fit_versions?.image_url ?? null,
    pieceName: row.piece_name,
    pieceImageUrl: row.image_url ?? null,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    materialType: row.materials?.material_type ?? 'other',
    materialUnit: row.materials?.unit ?? '',
    piecesPerUnit: Number(row.pieces_per_unit ?? 0),
    consumptionPerPiece: Number(row.consumption_per_piece ?? 0),
    wastePercentage: Number(row.waste_percentage ?? 0),
    effectiveConsumptionPerUnit: Number(row.effective_consumption_per_unit ?? 0),
    validFromMonth: row.valid_from_month,
    validToMonth: row.valid_to_month,
    status: row.status,
    notes: row.notes,
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
        id,
        collection_id,
        fit_id,
        version_code,
        image_url,
        description,
        color_range_start,
        color_range_end,
        main_material_id,
        status,
        collections (
          code
        ),
        fits (
          code,
          name,
          image_url
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
      fitVersionId: version?.id ?? '',
      collectionId: version?.collection_id ?? '',
      collectionCode: version?.collections?.code ?? '-',
      fitId: version?.fit_id ?? '',
      fitCode: version?.fits?.code ?? '-',
      fitName: version?.fits?.name ?? '-',
      fitImageUrl: version?.fits?.image_url ?? null,
      versionCode: version?.version_code ?? '-',
      versionImageUrl: version?.image_url ?? null,
      description: version?.description ?? null,
      colorRangeStart: start ?? null,
      colorRangeEnd: end ?? null,
      colorRange: start && end ? `${start}-${end}` : '-',
      mainMaterialId: version?.main_material_id ?? null,
      mainMaterialName: version?.materials?.name ?? 'No definido',
      sharePercentage: Number(row.share_percentage ?? 0),
      validFromMonth: row.valid_from_month,
      validToMonth: row.valid_to_month,
      changeReason: row.change_reason,
      status: version?.status ?? 'active',
    }
  })
}

export async function getBomFormOptions(): Promise<BomFormOptions> {
  const [collectionsResult, fitsResult, materialsResult, versionsResult] = await Promise.all([
    supabase.from('collections').select('id, code, name').order('code', { ascending: true }),
    supabase.from('fits').select('id, code, name, silhouette, category, image_url').eq('status', 'active').order('code', { ascending: true }),
    supabase.from('materials').select('id, code, name, unit, material_type').eq('status', 'active').order('code', { ascending: true }),
    supabase
      .from('fit_versions')
      .select(`
        id,
        fit_id,
        version_code,
        image_url,
        collections (
          code
        ),
        fits (
          name
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  if (collectionsResult.error) throw new Error(collectionsResult.error.message)
  if (fitsResult.error) throw new Error(fitsResult.error.message)
  if (materialsResult.error) throw new Error(materialsResult.error.message)
  if (versionsResult.error) throw new Error(versionsResult.error.message)

  return {
    collections: collectionsResult.data ?? [],
    fits: ((fitsResult.data ?? []) as any[]).map((fit) => ({
      id: fit.id,
      code: fit.code,
      name: fit.name,
      silhouette: fit.silhouette ?? null,
      category: fit.category ?? null,
      imageUrl: fit.image_url ?? null,
    })),
    materials: materialsResult.data ?? [],
    fitVersions: ((versionsResult.data ?? []) as any[]).map((version) => ({
      id: version.id,
      fitId: version.fit_id,
      collectionCode: version.collections?.code ?? '-',
      fitName: version.fits?.name ?? '-',
      versionCode: version.version_code,
      imageUrl: version.image_url ?? null,
    })),
  }
}

export async function createVersionWithMix(input: VersionMixFormInput, auditReason: string) {
  const versionPayload = normalizeVersionPayload(input)

  const { data: version, error: versionError } = await supabase
    .from('fit_versions')
    .insert(versionPayload)
    .select('id, collection_id, fit_id, version_code, description, color_range_start, color_range_end, main_material_id, image_url, status')
    .single()

  if (versionError) throw new Error(versionError.message)

  const mixPayload = normalizeMixPayload(input, version.id)

  const { data: mix, error: mixError } = await supabase
    .from('fit_version_mix')
    .insert(mixPayload)
    .select('id, fit_version_id, valid_from_month, valid_to_month, share_percentage, change_reason')
    .single()

  if (mixError) throw new Error(mixError.message)

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'fit_versions',
    recordId: version.id,
    fieldName: 'record',
    oldValue: null,
    newValue: versionPayload,
    changeType: 'create',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'fit_version_mix',
    recordId: mix.id,
    fieldName: 'record',
    oldValue: null,
    newValue: mixPayload,
    changeType: 'create',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  return { version, mix }
}

export async function updateVersionWithMix(
  versionId: string,
  mixId: string,
  previousVersion: FitVersionRecordForAudit,
  previousMix: FitVersionMixRecordForAudit,
  input: VersionMixFormInput,
  auditReason: string,
) {
  const versionPayload = normalizeVersionPayload(input)

  const { data: version, error: versionError } = await supabase
    .from('fit_versions')
    .update({
      ...versionPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId)
    .select('id, collection_id, fit_id, version_code, description, color_range_start, color_range_end, main_material_id, image_url, status')
    .single()

  if (versionError) throw new Error(versionError.message)

  const mixPayload = normalizeMixPayload(input, versionId)

  const { data: mix, error: mixError } = await supabase
    .from('fit_version_mix')
    .update(mixPayload)
    .eq('id', mixId)
    .select('id, fit_version_id, valid_from_month, valid_to_month, share_percentage, change_reason')
    .single()

  if (mixError) throw new Error(mixError.message)

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'fit_versions',
    recordId: versionId,
    fieldName: 'record',
    oldValue: previousVersion,
    newValue: versionPayload,
    changeType: 'update',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'fit_version_mix',
    recordId: mixId,
    fieldName: 'record',
    oldValue: previousMix,
    newValue: mixPayload,
    changeType: 'update',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  return { version, mix }
}

export async function createBomLine(input: BomLineFormInput, auditReason: string) {
  const payload = normalizeBomLinePayload(input)

  const { data, error } = await supabase
    .from('bom_lines')
    .insert(payload)
    .select('id, fit_version_id, piece_name, material_id, pieces_per_unit, consumption_per_piece, waste_percentage, image_url, valid_from_month, valid_to_month, status, notes')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'bom_lines',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  return data
}

export async function updateBomLine(
  id: string,
  previous: BomLineRecordForAudit,
  input: BomLineFormInput,
  auditReason: string,
) {
  const payload = normalizeBomLinePayload(input)

  const { data, error } = await supabase
    .from('bom_lines')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, fit_version_id, piece_name, material_id, pieces_per_unit, consumption_per_piece, waste_percentage, image_url, valid_from_month, valid_to_month, status, notes')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'bom',
    tableName: 'bom_lines',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: input.valid_from_month,
    affectedToMonth: input.valid_to_month || null,
    reason: auditReason,
  })

  return data
}

function normalizeVersionPayload(input: VersionMixFormInput) {
  return {
    collection_id: input.collection_id,
    fit_id: input.fit_id,
    version_code: input.version_code.trim(),
    description: emptyToNull(input.description),
    color_range_start: input.color_range_start.trim() ? Number(input.color_range_start) : null,
    color_range_end: input.color_range_end.trim() ? Number(input.color_range_end) : null,
    main_material_id: input.main_material_id || null,
    image_url: emptyToNull(input.image_url),
    status: input.status,
  }
}

function normalizeMixPayload(input: VersionMixFormInput, fitVersionId: string) {
  return {
    fit_version_id: fitVersionId,
    valid_from_month: input.valid_from_month,
    valid_to_month: input.valid_to_month || null,
    share_percentage: Number(input.share_percentage),
    change_reason: emptyToNull(input.change_reason),
  }
}

function normalizeBomLinePayload(input: BomLineFormInput) {
  return {
    fit_version_id: input.fit_version_id,
    piece_name: input.piece_name.trim(),
    material_id: input.material_id,
    pieces_per_unit: Number(input.pieces_per_unit),
    consumption_per_piece: Number(input.consumption_per_piece),
    waste_percentage: Number(input.waste_percentage || 0),
    image_url: emptyToNull(input.image_url),
    valid_from_month: input.valid_from_month,
    valid_to_month: input.valid_to_month || null,
    status: input.status,
    notes: emptyToNull(input.notes),
  }
}

function emptyToNull(value: string) {
  const clean = value.trim()
  return clean ? clean : null
}
