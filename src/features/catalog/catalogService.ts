import { supabase } from '../../lib/supabase'
import type { FabricCompositionRecord, FitRecord, MaterialRecord } from './catalogTypes'

export async function listFits(): Promise<FitRecord[]> {
  const { data, error } = await supabase
    .from('fits')
    .select('id, code, name, silhouette, category, gender, portfolio, status, created_at, updated_at')
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listMaterials(): Promise<MaterialRecord[]> {
  const { data, error } = await supabase
    .from('materials')
    .select(
      'id, code, name, material_type, unit, origin, supplier_name, lead_time_days, is_fabric, status, created_at, updated_at',
    )
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listFabricCompositions(): Promise<FabricCompositionRecord[]> {
  const { data, error } = await supabase
    .from('fabric_compositions')
    .select('id, material_id, component_name, percentage, created_at')
    .order('component_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
