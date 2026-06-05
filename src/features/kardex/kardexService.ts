import { supabase } from '../../lib/supabase'

export type KardexInputView = {
  id: string
  materialCode: string
  materialName: string
  unit: string
  periodMonth: string
  controlDate: string
  sequenceNumber: number
  totalBodega: number
  pedido: number
  transito: number
  stockSeguridad: number
  industrializacion: number
  notes: string | null
}

export async function listKardexInputs(): Promise<KardexInputView[]> {
  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .select(`
      id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        unit
      ),
      material_control_dates (
        period_month,
        control_date,
        sequence_number
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    unit: row.materials?.unit ?? '',
    periodMonth: row.material_control_dates?.period_month ?? '',
    controlDate: row.material_control_dates?.control_date ?? '',
    sequenceNumber: Number(row.material_control_dates?.sequence_number ?? 0),
    totalBodega: Number(row.total_bodega ?? 0),
    pedido: Number(row.pedido ?? 0),
    transito: Number(row.transito ?? 0),
    stockSeguridad: Number(row.stock_seguridad ?? 0),
    industrializacion: Number(row.industrializacion ?? 0),
    notes: row.notes,
  }))
}
