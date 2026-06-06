import { supabase } from '../../lib/supabase'
import {
  findMaterialTypeProfile,
  mergeMaterialTypeProfiles,
  normalizeMaterialTypeKey,
  predefinedMaterialTypeProfiles,
  type MaterialTypeProfile,
} from '../../utils/materialTypes'
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
    .select('id, code, name, silhouette, category, gender, portfolio, image_url, status, created_at, updated_at')
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function listMaterials(): Promise<MaterialRecord[]> {
  const { data, error } = await supabase
    .from('materials')
    .select(
      'id, code, name, material_type, unit, origin, supplier_name, lead_time_days, image_url, is_fabric, status, created_at, updated_at',
    )
    .order('code', { ascending: true })

  if (error) throw new Error(error.message)

  return data ?? []
}

export async function listMaterialTypeProfiles(): Promise<MaterialTypeProfile[]> {
  const { data, error } = await supabase
    .from('material_type_profiles')
    .select('type_key, type_label, default_unit, requires_composition, composition_label, status, created_at, updated_at')
    .eq('status', 'active')
    .order('type_label', { ascending: true })

  if (error) {
    // Permite que la pantalla siga funcionando si todavía no se ejecutó la migración.
    return predefinedMaterialTypeProfiles
  }

  return mergeMaterialTypeProfiles((data ?? []) as MaterialTypeProfile[])
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
    .select('id, code, name, silhouette, category, gender, portfolio, image_url, status, created_at, updated_at')
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
    .select('id, code, name, silhouette, category, gender, portfolio, image_url, status, created_at, updated_at')
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
  await upsertMaterialTypeProfile(input)
  const payload = normalizeMaterialPayload(input)

  const { data, error } = await supabase
    .from('materials')
    .insert(payload)
    .select('id, code, name, material_type, unit, origin, supplier_name, lead_time_days, image_url, is_fabric, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await replaceFabricCompositions(data.id, compositions)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'materials',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: { ...payload, material_type_label: input.material_type_label, compositions },
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
  await upsertMaterialTypeProfile(input)
  const payload = normalizeMaterialPayload(input)

  const { data, error } = await supabase
    .from('materials')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, code, name, material_type, unit, origin, supplier_name, lead_time_days, image_url, is_fabric, status, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)

  await replaceFabricCompositions(id, compositions)

  await createAuditLog({
    moduleName: 'catalog',
    tableName: 'materials',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: { ...payload, material_type_label: input.material_type_label, compositions },
    changeType: 'update',
    reason,
  })

  return data
}

async function upsertMaterialTypeProfile(input: MaterialFormInput) {
  const typeLabel = input.material_type_label.trim() || input.material_type.trim() || 'Otro'
  const existingProfile = findMaterialTypeProfile(typeLabel)
  const typeKey = existingProfile?.type_key ?? normalizeMaterialTypeKey(typeLabel)
  const compositionLabel = input.is_fabric
    ? existingProfile?.composition_label ?? `Composición ${typeLabel.toLowerCase()}`
    : null

  const { error } = await supabase
    .from('material_type_profiles')
    .upsert(
      {
        type_key: typeKey,
        type_label: typeLabel,
        default_unit: input.unit,
        requires_composition: input.is_fabric,
        composition_label: compositionLabel,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'type_key' },
    )

  // Si la migración de perfiles aún no existe, no bloqueamos el guardado del material.
  if (error && !error.message.toLowerCase().includes('material_type_profiles')) {
    throw new Error(error.message)
  }
}

function normalizeFitPayload(input: FitFormInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    silhouette: input.silhouette.trim(),
    category: emptyToNull(input.category),
    gender: emptyToNull(input.gender),
    portfolio: emptyToNull(input.portfolio),
    image_url: emptyToNull(input.image_url),
    status: input.status,
  }
}

function normalizeMaterialPayload(input: MaterialFormInput) {
  const typeLabel = input.material_type_label.trim() || input.material_type.trim() || 'Otro'
  const existingProfile = findMaterialTypeProfile(typeLabel)
  const materialTypeKey = existingProfile?.type_key ?? (input.material_type || normalizeMaterialTypeKey(typeLabel))

  return {
    code: input.code.trim(),
    name: input.name.trim(),
    material_type: materialTypeKey,
    unit: input.unit,
    origin: input.origin || null,
    supplier_name: emptyToNull(input.supplier_name),
    lead_time_days: input.lead_time_days.trim() ? Number(input.lead_time_days) : null,
    image_url: emptyToNull(input.image_url),
    // Nombre heredado en BD. En la app ahora significa: requiere composición técnica.
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
