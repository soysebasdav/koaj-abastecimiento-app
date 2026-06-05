import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import type {
  FabricCompositionInput,
  FabricCompositionRecord,
  FitFormInput,
  FitRecord,
  MaterialFormInput,
  MaterialRecord,
} from './catalogTypes'

export async function listFits(): Promise<FitRecord[]> {
  const { data, error } = await supabase
    .from('fits')
    .select('id, code, name, silhouette, category, gender, portfolio, status, created_at, updated_at')
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function listMaterials(): Promise<MaterialRecord[]> {
  const { data, error } = await supabase
    .from('materials')
    .select(
      'id, code, name, material_type, unit, origin, supplier_name, lead_time_days, is_fabric, status, created_at, updated_at',
    )
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function listFabricCompositions(): Promise<FabricCompositionRecord[]> {
  const { data, error } = await supabase
    .from('fabric_compositions')
    .select('id, material_id, component_name, percentage, created_at')
    .order('component_name', { ascending: true })

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function createFit(input: FitFormInput, reason: string): Promise<FitRecord> {
  const payload = normalizeFitPayload(input)

  const { data, error } = await supabase
    .from('fits')
    .insert(payload)
    .select('id, code, name, silhouette, category, gender, portfolio, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'fits',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    reason,
  })

  return data
}

export async function updateFit(id: string, previous: FitRecord, input: FitFormInput, reason: string): Promise<FitRecord> {
  const payload = normalizeFitPayload(input)

  const { data, error } = await supabase
    .from('fits')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, code, name, silhouette, category, gender, portfolio, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'fits',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    reason,
  })

  return data
}

export async function createMaterial(
  input: MaterialFormInput,
  compositions: FabricCompositionInput[],
  reason: string,
): Promise<MaterialRecord> {
  const payload = normalizeMaterialPayload(input)

  const { data, error } = await supabase
    .from('materials')
    .insert(payload)
    .select('id, code, name, material_type, unit, origin, supplier_name, lead_time_days, is_fabric, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await replaceFabricCompositions(data.id, compositions)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'materials',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: { ...payload, compositions },
    changeType: 'create',
    reason,
  })

  return data
}

export async function updateMaterial(
  id: string,
  previous: MaterialRecord,
  input: MaterialFormInput,
  compositions: FabricCompositionInput[],
  reason: string,
): Promise<MaterialRecord> {
  const payload = normalizeMaterialPayload(input)

  const { data, error } = await supabase
    .from('materials')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, code, name, material_type, unit, origin, supplier_name, lead_time_days, is_fabric, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await replaceFabricCompositions(id, compositions)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'materials',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: { ...payload, compositions },
    changeType: 'update',
    reason,
  })

  return data
}

function normalizeFitPayload(input: FitFormInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    silhouette: input.silhouette.trim(),
    category: emptyToNull(input.category),
    gender: emptyToNull(input.gender),
    portfolio: emptyToNull(input.portfolio),
    status: input.status,
  }
}

function normalizeMaterialPayload(input: MaterialFormInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    material_type: input.material_type,
    unit: input.unit,
    origin: input.origin || null,
    supplier_name: emptyToNull(input.supplier_name),
    lead_time_days: input.lead_time_days.trim() ? Number(input.lead_time_days) : null,
    is_fabric: input.is_fabric,
    status: input.status,
  }
}

async function replaceFabricCompositions(materialId: string, compositions: FabricCompositionInput[]) {
  const { error: deleteError } = await supabase
    .from('fabric_compositions')
    .delete()
    .eq('material_id', materialId)

  if (deleteError) throw new Error(deleteError.message)

  const cleanCompositions = compositions
    .map((composition) => ({
      material_id: materialId,
      component_name: composition.component_name.trim(),
      percentage: Number(composition.percentage),
    }))
    .filter((composition) => composition.component_name && !Number.isNaN(composition.percentage))

  if (cleanCompositions.length === 0) return

  const { error: insertError } = await supabase
    .from('fabric_compositions')
    .insert(cleanCompositions)

  if (insertError) throw new Error(insertError.message)
}

function emptyToNull(value: string) {
  const clean = value.trim()
  return clean ? clean : null
}
