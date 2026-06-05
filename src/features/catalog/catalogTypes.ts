export type FitRecord = {
  id: string
  code: string
  name: string
  silhouette: string
  category: string | null
  gender: string | null
  portfolio: string | null
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
  status: 'active' | 'inactive'
}

export type MaterialRecord = {
  id: string
  code: string
  name: string
  material_type:
    | 'fabric'
    | 'button'
    | 'pocket_fabric'
    | 'label'
    | 'zipper'
    | 'thread'
    | 'packaging'
    | 'other'
  unit: 'meter' | 'unit' | 'kg' | 'roll' | 'box' | 'package'
  origin: 'national' | 'international' | null
  supplier_name: string | null
  lead_time_days: number | null
  is_fabric: boolean
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type MaterialFormInput = {
  code: string
  name: string
  material_type: MaterialRecord['material_type']
  unit: MaterialRecord['unit']
  origin: 'national' | 'international' | ''
  supplier_name: string
  lead_time_days: string
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

export type MaterialWithComposition = MaterialRecord & {
  composition_label: string
  compositions: FabricCompositionRecord[]
}
