export type InventoryRowView = {
  materialId: string
  materialCode: string
  materialName: string
  materialType: string
  materialTypeLabel: string
  unit: string
  totalBodega: number
  notes: string | null
  updatedAt: string | null
}

export type InventoryBalanceView = {
  materialId: string
  totalBodega: number
  notes: string | null
  updatedAt: string | null
}

export type InventoryUpdateInput = {
  materialId: string
  totalBodega: number
  notes?: string | null
}

export type InventoryImportRow = {
  materialId?: string
  materialCode?: string
  totalBodega: number
  notes?: string | null
}

export type InventoryImportResult = {
  imported: number
  skipped: number
  skippedRows: string[]
}
