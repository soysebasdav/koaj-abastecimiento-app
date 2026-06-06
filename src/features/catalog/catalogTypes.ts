import type { MaterialTypeProfile, MaterialUnit } from '../../utils/materialTypes'

export type FitRecord = {
  id: string
  code: string
  name: string
  silhouette: string
  category: string | null
  gender: string | null
  portfolio: string | null
  image_url: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type FitFormInput = {
  code: string
  name: string
  silhouette: string
  category: string
  gender: string
  portfolio: string
  image_url: string
  status: 'active' | 'inactive'
}

export type MaterialRecord = {
  id: string
  code: string
  name: string
  material_type: string
  unit: MaterialUnit
  origin: 'national' | 'international' | null
  supplier_name: string | null
  lead_time_days: number | null
  image_url: string | null
  is_fabric: boolean
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type MaterialFormInput = {
  code: string
  name: string
  material_type: string
  material_type_label: string
  unit: MaterialUnit
  origin: 'national' | 'international' | ''
  supplier_name: string
  lead_time_days: string
  image_url: string
  is_fabric: boolean
  status: 'active' | 'inactive'
}

export type FabricCompositionRecord = {
  id: string
  material_id: string
  component_name: string
  percentage: number
  created_at: string
}

export type FabricCompositionInput = {
  component_name: string
  percentage: string
}

export type MaterialTypeProfileRecord = MaterialTypeProfile

export type MaterialWithComposition = MaterialRecord & {
  composition_label: string
  compositions: FabricCompositionRecord[]
}
