import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import { listInventoryBalances } from '../inventory/inventoryService'
import { formatMaterialTypeLabel } from '../../utils/materialTypes'
import type {
  KardexControlPointView,
  KardexInputFormInput,
  KardexInputRecordForAudit,
  KardexInputView,
  KardexOptions,
  KardexRequirementView,
  MaterialOption,
  MaterialTypeOption,
} from './kardexTypes'

type BaseKardexInputView = Omit<
  KardexInputView,
  'projectedConsumption' | 'entregaProduccion' | 'operationalRequirement' | 'pendientePorPedir' | 'inventarioFinal' | 'availableBalance'
>

export async function listKardexInputs(): Promise<KardexInputView[]> {
  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .select(`
      id,
      material_id,
      material_type_control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        material_type,
        unit
      ),
      material_type_control_dates (
        material_type,
        period_month,
        control_date,
        control_number,
        label
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as any[]).map(mapBaseKardexInputRow)
  const requirementByControlDate = await getProjectedConsumptionByControlDate()

  return enrichKardexRows(rows, requirementByControlDate)
}

export async function listKardexControlPoints(): Promise<KardexControlPointView[]> {
  const { data, error } = await supabase
    .from('material_type_control_dates')
    .select('id, material_type, period_month, control_date, control_number, label, status, created_at')
    .neq('status', 'cancelled')
    .order('period_month', { ascending: true })
    .order('control_number', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map(mapControlPointRow)
}

export async function getKardexOptions(): Promise<KardexOptions> {
  const [materialsResult, controlPoints, requirements, inventoryBalances] = await Promise.all([
    supabase
      .from('materials')
      .select('id, code, name, material_type, unit')
      .eq('status', 'active')
      .order('material_type', { ascending: true })
      .order('code', { ascending: true }),
    listKardexControlPoints(),
    listKardexRequirements(),
    listInventoryBalances(),
  ])

  if (materialsResult.error) throw new Error(materialsResult.error.message)

  const materials: MaterialOption[] = ((materialsResult.data ?? []) as any[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    materialType: row.material_type,
    materialTypeLabel: formatMaterialTypeLabel(row.material_type),
    unit: row.unit ?? '',
  }))

  const materialTypes = buildMaterialTypeOptions(materials)

  return {
    materialTypes,
    materials,
    controlPoints,
    requirements,
    inventoryBalances: inventoryBalances.map((balance) => ({
      materialId: balance.materialId,
      totalBodega: balance.totalBodega,
    })),
  }
}

export async function listKardexRequirements(): Promise<KardexRequirementView[]> {
  const direct = await listProjectedConsumptionFromTypeControlDateView()
  if (direct.length > 0) return direct

  return listProjectedConsumptionFromMonthlyRequirement()
}

export async function createKardexInput(input: KardexInputFormInput, auditReason: string) {
  const payload = normalizeKardexInputPayload(input)

  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .insert(payload)
    .select(`
      id,
      material_id,
      material_type_control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        material_type,
        unit
      ),
      material_type_control_dates (
        material_type,
        period_month,
        control_date,
        control_number,
        label
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'kardex_weekly_inputs',
    recordId: data.id,
    fieldName: 'record',
    oldValue: null,
    newValue: payload,
    changeType: 'create',
    affectedFromMonth: data.material_type_control_dates?.period_month ?? null,
    affectedToMonth: data.material_type_control_dates?.period_month ?? null,
    reason: auditReason,
  })

  const requirementByControlDate = await getProjectedConsumptionByControlDate()
  return enrichKardexRows([mapBaseKardexInputRow(data)], requirementByControlDate)[0]
}

export async function updateKardexInput(
  id: string,
  previous: KardexInputRecordForAudit,
  input: KardexInputFormInput,
  auditReason: string,
) {
  const payload = normalizeKardexInputPayload(input)

  const { data, error } = await supabase
    .from('kardex_weekly_inputs')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id,
      material_id,
      material_type_control_date_id,
      total_bodega,
      pedido,
      transito,
      stock_seguridad,
      industrializacion,
      notes,
      materials (
        code,
        name,
        material_type,
        unit
      ),
      material_type_control_dates (
        material_type,
        period_month,
        control_date,
        control_number,
        label
      )
    `)
    .single()

  if (error) throw new Error(error.message)

  await createAuditLog({
    moduleName: 'kardex',
    tableName: 'kardex_weekly_inputs',
    recordId: id,
    fieldName: 'record',
    oldValue: previous,
    newValue: payload,
    changeType: 'update',
    affectedFromMonth: data.material_type_control_dates?.period_month ?? null,
    affectedToMonth: data.material_type_control_dates?.period_month ?? null,
    reason: auditReason,
  })

  const requirementByControlDate = await getProjectedConsumptionByControlDate()
  return enrichKardexRows([mapBaseKardexInputRow(data)], requirementByControlDate)[0]
}

async function getProjectedConsumptionByControlDate(): Promise<Record<string, number>> {
  const requirements = await listKardexRequirements()

  return requirements.reduce<Record<string, number>>((acc, row) => {
    acc[buildRequirementKey(row.controlDateId, row.materialId)] = row.requiredQuantity
    return acc
  }, {})
}

async function listProjectedConsumptionFromTypeControlDateView(): Promise<KardexRequirementView[]> {
  const { data, error } = await supabase
    .from('v_material_requirements_by_type_control_date')
    .select('control_date_id, material_id, required_quantity')

  if (error) return []

  return ((data ?? []) as any[]).map((row) => ({
    controlDateId: row.control_date_id,
    materialId: row.material_id,
    requiredQuantity: Number(row.required_quantity ?? 0),
  }))
}

async function listProjectedConsumptionFromMonthlyRequirement(): Promise<KardexRequirementView[]> {
  const [controlDatesResult, monthlyResult, materialsResult] = await Promise.all([
    supabase
      .from('material_type_control_dates')
      .select('id, material_type, period_month')
      .neq('status', 'cancelled'),
    supabase.from('v_material_requirements_monthly').select('material_id, material_type, period_month, required_quantity'),
    supabase.from('materials').select('id, material_type'),
  ])

  if (controlDatesResult.error || monthlyResult.error || materialsResult.error) return []

  const controlDates = (controlDatesResult.data ?? []) as any[]
  const monthlyRows = (monthlyResult.data ?? []) as any[]
  const materialsByType = ((materialsResult.data ?? []) as any[]).reduce<Record<string, string[]>>((acc, row) => {
    acc[row.material_type] = acc[row.material_type] ?? []
    acc[row.material_type].push(row.id)
    return acc
  }, {})

  const controlDateCountByTypeMonth = controlDates.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.material_type}-${row.period_month}`
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const projected: KardexRequirementView[] = []

  for (const point of controlDates) {
    const typeMonthKey = `${point.material_type}-${point.period_month}`
    const count = controlDateCountByTypeMonth[typeMonthKey] || 1
    const materialIds = materialsByType[point.material_type] ?? []

    for (const materialId of materialIds) {
      const monthly = monthlyRows
        .filter((row) => row.material_id === materialId && row.period_month === point.period_month)
        .reduce((sum, row) => sum + Number(row.required_quantity ?? 0), 0)

      projected.push({
        controlDateId: point.id,
        materialId,
        requiredQuantity: monthly / count,
      })
    }
  }

  return projected
}

function enrichKardexRows(rows: BaseKardexInputView[], requirementByControlDate: Record<string, number>): KardexInputView[] {
  const withConsumption = rows.map((row) => {
    const projectedConsumption = requirementByControlDate[buildRequirementKey(row.controlDateId, row.materialId)] ?? 0
    const operationalRequirement = projectedConsumption + row.stockSeguridad + row.industrializacion
    const availableBalance = row.totalBodega + row.pedido + row.transito - operationalRequirement
    const pendientePorPedir = Math.max(operationalRequirement - row.totalBodega - row.pedido - row.transito, 0)

    return {
      ...row,
      projectedConsumption,
      entregaProduccion: 0,
      operationalRequirement,
      pendientePorPedir,
      inventarioFinal: row.totalBodega + row.pedido + row.transito - projectedConsumption,
      availableBalance,
    }
  })

  return withConsumption.map((row) => {
    const nextRows = withConsumption
      .filter((candidate) => candidate.materialId === row.materialId && candidate.controlDate > row.controlDate)
      .sort((a, b) => a.controlDate.localeCompare(b.controlDate))
      .slice(0, 2)

    const entregaProduccion = nextRows.reduce((sum, candidate) => sum + candidate.projectedConsumption, 0)

    return {
      ...row,
      entregaProduccion,
      inventarioFinal: row.totalBodega + row.pedido + row.transito - row.projectedConsumption - entregaProduccion,
    }
  })
}

function normalizeKardexInputPayload(input: KardexInputFormInput) {
  return {
    material_id: input.material_id,
    material_type_control_date_id: input.control_date_id,
    material_type_control_point_id: null,
    control_date_id: null,
    total_bodega: Number(input.total_bodega || 0),
    pedido: Number(input.pedido || 0),
    transito: Number(input.transito || 0),
    stock_seguridad: Number(input.stock_seguridad || 0),
    industrializacion: Number(input.industrializacion || 0),
    notes: input.notes.trim() || null,
  }
}

function mapBaseKardexInputRow(row: any): BaseKardexInputView {
  const materialType = row.materials?.material_type ?? row.material_type_control_dates?.material_type ?? 'other'

  return {
    id: row.id,
    materialId: row.material_id,
    materialCode: row.materials?.code ?? '-',
    materialName: row.materials?.name ?? '-',
    materialType,
    materialTypeLabel: formatMaterialTypeLabel(materialType),
    unit: row.materials?.unit ?? '',
    controlDateId: row.material_type_control_date_id,
    periodMonth: row.material_type_control_dates?.period_month ?? '',
    controlDate: row.material_type_control_dates?.control_date ?? '',
    controlNumber: Number(row.material_type_control_dates?.control_number ?? 0),
    controlLabel: row.material_type_control_dates?.label ?? 'Fecha de control',
    totalBodega: Number(row.total_bodega ?? 0),
    pedido: Number(row.pedido ?? 0),
    transito: Number(row.transito ?? 0),
    stockSeguridad: Number(row.stock_seguridad ?? 0),
    industrializacion: Number(row.industrializacion ?? 0),
    notes: row.notes,
  }
}

function mapControlPointRow(row: any): KardexControlPointView {
  return {
    id: row.id,
    materialType: row.material_type,
    materialTypeLabel: formatMaterialTypeLabel(row.material_type),
    periodMonth: row.period_month,
    controlDate: row.control_date,
    controlNumber: Number(row.control_number ?? 0),
    controlLabel: row.label ?? `Control ${row.control_number ?? ''}`.trim(),
    status: row.status,
    createdAt: row.created_at,
  }
}

function buildMaterialTypeOptions(materials: MaterialOption[]): MaterialTypeOption[] {
  const grouped = materials.reduce<Record<string, MaterialTypeOption>>((acc, material) => {
    acc[material.materialType] = acc[material.materialType] ?? {
      materialType: material.materialType,
      label: material.materialTypeLabel,
      unit: material.unit,
      materialCount: 0,
    }

    acc[material.materialType].materialCount += 1
    return acc
  }, {})

  return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function buildRequirementKey(controlDateId: string, materialId: string) {
  return `${controlDateId}-${materialId}`
}
