export type MaterialUnit = 'meter' | 'unit' | 'kg' | 'roll' | 'box' | 'package'

export type MaterialTypeProfile = {
  type_key: string
  type_label: string
  default_unit: MaterialUnit
  requires_composition: boolean
  composition_label: string | null
  status: 'active' | 'inactive'
  created_at?: string
  updated_at?: string
}

export const unitLabels: Record<MaterialUnit, string> = {
  meter: 'metro',
  unit: 'unidad',
  kg: 'kg',
  roll: 'rollo',
  box: 'caja',
  package: 'paquete',
}

export const predefinedMaterialTypeProfiles: MaterialTypeProfile[] = [
  {
    type_key: 'fabric',
    type_label: 'Tela',
    default_unit: 'meter',
    requires_composition: true,
    composition_label: 'Composición tela',
    status: 'active',
  },
  {
    type_key: 'pocket_fabric',
    type_label: 'Tela bolsillo',
    default_unit: 'meter',
    requires_composition: true,
    composition_label: 'Composición tela',
    status: 'active',
  },
  {
    type_key: 'metal',
    type_label: 'Metal',
    default_unit: 'kg',
    requires_composition: true,
    composition_label: 'Composición metal',
    status: 'active',
  },
  {
    type_key: 'button',
    type_label: 'Botón',
    default_unit: 'unit',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
  {
    type_key: 'snap_button',
    type_label: 'Broche',
    default_unit: 'kg',
    requires_composition: true,
    composition_label: 'Composición broche / metal',
    status: 'active',
  },
  {
    type_key: 'label',
    type_label: 'Marquilla / etiqueta',
    default_unit: 'unit',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
  {
    type_key: 'zipper',
    type_label: 'Cremallera',
    default_unit: 'unit',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
  {
    type_key: 'thread',
    type_label: 'Hilo',
    default_unit: 'roll',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
  {
    type_key: 'packaging',
    type_label: 'Empaque',
    default_unit: 'unit',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
  {
    type_key: 'other',
    type_label: 'Otro',
    default_unit: 'unit',
    requires_composition: false,
    composition_label: null,
    status: 'active',
  },
]

export function normalizeMaterialTypeKey(value: string) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'other'
}

export function mergeMaterialTypeProfiles(profiles: MaterialTypeProfile[]) {
  const byKey = new Map<string, MaterialTypeProfile>()

  for (const profile of predefinedMaterialTypeProfiles) {
    byKey.set(profile.type_key, profile)
  }

  for (const profile of profiles) {
    byKey.set(profile.type_key, profile)
  }

  return Array.from(byKey.values()).sort((a, b) => a.type_label.localeCompare(b.type_label, 'es'))
}

export function findMaterialTypeProfile(typeKeyOrLabel: string, profiles: MaterialTypeProfile[] = []) {
  const normalizedKey = normalizeMaterialTypeKey(typeKeyOrLabel)
  return mergeMaterialTypeProfiles(profiles).find((profile) => {
    return profile.type_key === normalizedKey || normalizeMaterialTypeKey(profile.type_label) === normalizedKey
  })
}

export function formatMaterialTypeLabel(typeKey: string, profiles: MaterialTypeProfile[] = []) {
  const profile = findMaterialTypeProfile(typeKey, profiles)
  if (profile) return profile.type_label

  return typeKey
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Otro'
}

export function getCompositionLabel(typeLabel: string, profile?: MaterialTypeProfile | null) {
  if (profile?.composition_label) return profile.composition_label
  const cleanLabel = typeLabel.trim() || 'material'
  return `Composición ${cleanLabel.toLowerCase()}`
}

export function getCompositionPlaceholder(typeLabel: string) {
  const normalized = normalizeMaterialTypeKey(typeLabel)

  if (normalized.includes('metal') || normalized.includes('broche')) {
    return 'Plata, aluminio, acero, zinc...'
  }

  if (normalized.includes('fabric') || normalized.includes('tela')) {
    return 'Algodón, elastano, poliéster...'
  }

  return 'Componente principal, aleación, fibra, mezcla...'
}
