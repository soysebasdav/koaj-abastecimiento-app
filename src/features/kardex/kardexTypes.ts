export type KardexInputView = {
  id: string
  materialId: string
  materialCode: string
  materialName: string
  materialType: string
  materialTypeLabel: string
  unit: string
  controlDateId: string
  periodMonth: string
  controlDate: string
  controlNumber: number
  controlLabel: string
  totalBodega: number
  pedido: number
  transito: number
  stockSeguridad: number
  industrializacion: number
  projectedConsumption: number
  entregaProduccion: number
  operationalRequirement: number
  pendientePorPedir: number
  inventarioFinal: number
  availableBalance: number
  notes: string | null
}

export type KardexControlPointView = {
  id: string
  materialType: string
  materialTypeLabel: string
  periodMonth: string
  controlDate: string
  controlNumber: number
  controlLabel: string
  status: string
  createdAt: string
}

export type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
  materialType: string
  materialTypeLabel: string
}

export type MaterialTypeOption = {
  materialType: string
  label: string
  unit: string
  materialCount: number
}

export type KardexRequirementView = {
  controlDateId: string
  materialId: string
  requiredQuantity: number
}

export type KardexOptions = {
  materialTypes: MaterialTypeOption[]
  materials: MaterialOption[]
  controlPoints: KardexControlPointView[]
  requirements: KardexRequirementView[]
}

export type KardexInputFormInput = {
  material_type: string
  material_id: string
  control_date_id: string
  total_bodega: string
  pedido: string
  transito: string
  stock_seguridad: string
  industrializacion: string
  notes: string
}

export type KardexInputRecordForAudit = {
  id: string
  material_id: string
  material_type: string
  material_type_control_date_id: string
  total_bodega: number
  pedido: number
  transito: number
  stock_seguridad: number
  industrializacion: number
  notes: string | null
}
