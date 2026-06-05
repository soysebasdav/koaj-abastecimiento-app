export type KardexInputView = {
  id: string
  materialId: string
  materialCode: string
  materialName: string
  unit: string
  controlDateId: string
  periodMonth: string
  controlDate: string
  sequenceNumber: number
  totalBodega: number
  pedido: number
  transito: number
  stockSeguridad: number
  industrializacion: number
  availableBalance: number
  notes: string | null
}

export type MaterialControlDateView = {
  id: string
  materialId: string
  materialCode: string
  materialName: string
  unit: string
  periodMonth: string
  controlDate: string
  sequenceNumber: number
  createdAt: string
}

export type MaterialOption = {
  id: string
  code: string
  name: string
  unit: string
}

export type KardexOptions = {
  materials: MaterialOption[]
  controlDates: MaterialControlDateView[]
}

export type ControlDateFormInput = {
  material_id: string
  period_month: string
  control_date: string
  sequence_number: string
}

export type KardexInputFormInput = {
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
  control_date_id: string
  total_bodega: number
  pedido: number
  transito: number
  stock_seguridad: number
  industrializacion: number
  notes: string | null
}

export type ControlDateRecordForAudit = {
  id: string
  material_id: string
  period_month: string
  control_date: string
  sequence_number: number
}
