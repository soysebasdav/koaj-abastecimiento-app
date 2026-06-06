export type MaterialTypeOption = {
  materialType: string
  label: string
  unit: string
  materialCount: number
  sampleMaterials: string[]
}

export type MaterialSummary = {
  id: string
  code: string
  name: string
  materialType: string
  materialTypeLabel: string
  unit: string
  imageUrl: string | null
}

export type MaterialTypeControlDate = {
  id: string
  materialType: string
  materialTypeLabel: string
  periodMonth: string
  controlNumber: number
  controlDate: string
  label: string
  status: 'planned' | 'done' | 'delayed' | 'cancelled'
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export type MaterialTypeProcessDate = {
  id: string
  materialType: string
  materialTypeLabel: string
  periodMonth: string
  processName: string
  processDate: string
  sequenceOrder: number
  status: 'planned' | 'done' | 'delayed' | 'cancelled'
  notes: string | null
  createdAt: string
  updatedAt: string | null
}

export type MaterialFitStart = {
  materialId: string
  materialCode: string
  materialName: string
  materialType: string
  materialTypeLabel: string
  unit: string
  firstPeriodMonth: string
  fitCodes: string[]
  requiredQuantity: number
}

export type GanttOptions = {
  materialTypes: MaterialTypeOption[]
  materials: MaterialSummary[]
  controlDates: MaterialTypeControlDate[]
  processDates: MaterialTypeProcessDate[]
  fitStarts: MaterialFitStart[]
}

export type ControlDateFormInput = {
  material_type: string
  period_month: string
  control_number: string
  control_date: string
  label: string
  status: 'planned' | 'done' | 'delayed' | 'cancelled'
  notes: string
}

export type ProcessDateFormInput = {
  material_type: string
  period_month: string
  process_name: string
  process_date: string
  sequence_order: string
  status: 'planned' | 'done' | 'delayed' | 'cancelled'
  notes: string
}

export type ControlDateRecordForAudit = {
  id: string
  material_type: string
  period_month: string
  control_number: number
  control_date: string
  label: string
  status: string
  notes: string | null
}

export type ProcessDateRecordForAudit = {
  id: string
  material_type: string
  period_month: string
  process_name: string
  process_date: string
  sequence_order: number
  status: string
  notes: string | null
}
