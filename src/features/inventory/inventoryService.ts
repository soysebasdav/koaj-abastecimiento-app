import { supabase } from '../../lib/supabase'
import { createAuditLog } from '../audit/auditService'
import { formatMaterialTypeLabel } from '../../utils/materialTypes'
import type {
  InventoryBalanceView,
  InventoryImportResult,
  InventoryImportRow,
  InventoryRowView,
  InventoryUpdateInput,
} from './inventoryTypes'

type MaterialInventoryRow = {
  material_id: string
  total_bodega: number | null
  notes: string | null
  updated_at: string | null
}

type MaterialRow = {
  id: string
  code: string
  name: string
  material_type: string
  unit: string | null
}

const FALLBACK_STORAGE_KEY = 'koaj_material_inventory_v1'

export async function listInventoryRows(): Promise<InventoryRowView[]> {
  const [materialsResult, balances] = await Promise.all([
    supabase
      .from('materials')
      .select('id, code, name, material_type, unit')
      .eq('status', 'active')
      .order('code', { ascending: true }),
    listInventoryBalances(),
  ])

  if (materialsResult.error) throw new Error(materialsResult.error.message)

  const balanceByMaterial = balances.reduce<Record<string, InventoryBalanceView>>((acc, balance) => {
    acc[balance.materialId] = balance
    return acc
  }, {})

  return ((materialsResult.data ?? []) as MaterialRow[]).map((material) => {
    const balance = balanceByMaterial[material.id]

    return {
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      materialType: material.material_type,
      materialTypeLabel: formatMaterialTypeLabel(material.material_type),
      unit: material.unit ?? '',
      totalBodega: Number(balance?.totalBodega ?? 0),
      notes: balance?.notes ?? null,
      updatedAt: balance?.updatedAt ?? null,
    }
  })
}

export async function listInventoryBalances(): Promise<InventoryBalanceView[]> {
  const { data, error } = await supabase
    .from('material_inventory')
    .select('material_id, total_bodega, notes, updated_at')

  if (error) {
    if (isMissingInventoryTableError(error.message)) return readFallbackBalances()
    throw new Error(error.message)
  }

  return ((data ?? []) as MaterialInventoryRow[]).map(mapInventoryBalanceRow)
}

export async function updateInventoryBalance(
  input: InventoryUpdateInput,
  previous: InventoryBalanceView | null,
  reason: string,
): Promise<InventoryBalanceView> {
  const payload = normalizeInventoryPayload(input)
  const updatedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('material_inventory')
    .upsert({ ...payload, updated_at: updatedAt }, { onConflict: 'material_id' })
    .select('material_id, total_bodega, notes, updated_at')
    .single()

  if (error) {
    if (isMissingInventoryTableError(error.message)) {
      const fallback = writeFallbackBalance({ ...payload, updated_at: updatedAt })
      return mapInventoryBalanceRow(fallback)
    }

    throw new Error(error.message)
  }

  await createAuditLog({
    moduleName: 'inventory',
    tableName: 'material_inventory',
    recordId: input.materialId,
    fieldName: 'total_bodega',
    oldValue: previous,
    newValue: payload,
    changeType: previous ? 'update' : 'create',
    reason,
  })

  return mapInventoryBalanceRow(data as MaterialInventoryRow)
}

export async function importInventoryBalances(
  rows: InventoryImportRow[],
  reason: string,
  fileName?: string,
): Promise<InventoryImportResult> {
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, skippedRows: [] }
  }

  const { data: materialsData, error: materialsError } = await supabase
    .from('materials')
    .select('id, code, name')
    .eq('status', 'active')

  if (materialsError) throw new Error(materialsError.message)

  const materials = (materialsData ?? []) as { id: string; code: string; name: string }[]
  const materialById = new Set(materials.map((material) => material.id))
  const materialByCode = materials.reduce<Record<string, string>>((acc, material) => {
    acc[normalizeCode(material.code)] = material.id
    return acc
  }, {})
  const materialByName = materials.reduce<Record<string, string>>((acc, material) => {
    acc[normalizeCode(material.name)] = material.id
    return acc
  }, {})

  const now = new Date().toISOString()
  const skippedRows: string[] = []
  const payload = rows.flatMap((row, index) => {
    const materialId = row.materialId && materialById.has(row.materialId)
      ? row.materialId
      : row.materialCode
        ? resolveMaterialReference(row.materialCode, materialByCode, materialByName)
        : undefined

    if (!materialId) {
      skippedRows.push(`Fila ${index + 2}: material no encontrado (${row.materialCode || row.materialId || 'sin código'})`)
      return []
    }

    if (Number.isNaN(Number(row.totalBodega)) || Number(row.totalBodega) < 0) {
      skippedRows.push(`Fila ${index + 2}: bodega inválida`)
      return []
    }

    return [{
      material_id: materialId,
      total_bodega: Number(row.totalBodega),
      notes: cleanText(row.notes ?? ''),
      updated_at: now,
    }]
  })

  if (payload.length === 0) {
    return { imported: 0, skipped: skippedRows.length, skippedRows }
  }

  const previousBalances = await getPreviousBalancesForAudit(payload.map((row) => row.material_id))

  const { error } = await supabase
    .from('material_inventory')
    .upsert(payload, { onConflict: 'material_id' })

  if (error) {
    if (isMissingInventoryTableError(error.message)) {
      payload.forEach((row) => writeFallbackBalance(row))
      await createInventoryImportAuditLog({
        payload,
        previousBalances,
        skippedRows,
        reason,
        fileName,
        source: 'localStorage fallback',
      })

      return { imported: payload.length, skipped: skippedRows.length, skippedRows }
    }

    throw new Error(error.message)
  }

  await createInventoryImportAuditLog({
    payload,
    previousBalances,
    skippedRows,
    reason,
    fileName,
    source: 'Supabase',
  })

  return { imported: payload.length, skipped: skippedRows.length, skippedRows }
}


type InventoryImportAuditPayload = {
  payload: Array<{
    material_id: string
    total_bodega: number
    notes: string | null
    updated_at: string
  }>
  previousBalances: Record<string, InventoryBalanceView>
  skippedRows: string[]
  reason: string
  fileName?: string
  source: string
}

async function getPreviousBalancesForAudit(materialIds: string[]): Promise<Record<string, InventoryBalanceView>> {
  if (materialIds.length === 0) return {}

  const uniqueMaterialIds = Array.from(new Set(materialIds))
  const { data, error } = await supabase
    .from('material_inventory')
    .select('material_id, total_bodega, notes, updated_at')
    .in('material_id', uniqueMaterialIds)

  if (error) {
    if (isMissingInventoryTableError(error.message)) {
      return readFallbackBalances()
        .filter((balance) => uniqueMaterialIds.includes(balance.materialId))
        .reduce<Record<string, InventoryBalanceView>>((acc, balance) => {
          acc[balance.materialId] = balance
          return acc
        }, {})
    }

    throw new Error(error.message)
  }

  return ((data ?? []) as MaterialInventoryRow[])
    .map(mapInventoryBalanceRow)
    .reduce<Record<string, InventoryBalanceView>>((acc, balance) => {
      acc[balance.materialId] = balance
      return acc
    }, {})
}

async function createInventoryImportAuditLog(input: InventoryImportAuditPayload) {
  const importedRows = input.payload.length
  const updatedRows = input.payload.filter((row) => input.previousBalances[row.material_id]).length
  const createdRows = importedRows - updatedRows
  const fileLabel = input.fileName?.trim() || 'archivo sin nombre'

  await createAuditLog({
    moduleName: 'inventory',
    tableName: 'material_inventory',
    recordId: null,
    fieldName: 'import_inventory',
    oldValue: {
      affected_materials: Object.keys(input.previousBalances).length,
      previous_balances: input.payload.slice(0, 25).map((row) => ({
        material_id: row.material_id,
        total_bodega: input.previousBalances[row.material_id]?.totalBodega ?? null,
        notes: input.previousBalances[row.material_id]?.notes ?? null,
      })),
    },
    newValue: {
      file_name: fileLabel,
      source: input.source,
      imported_rows: importedRows,
      updated_rows: updatedRows,
      created_rows: createdRows,
      skipped_rows: input.skippedRows.length,
      balances: input.payload.slice(0, 25).map((row) => ({
        material_id: row.material_id,
        total_bodega: row.total_bodega,
        notes: row.notes,
      })),
      truncated: input.payload.length > 25,
    },
    changeType: 'update',
    reason: `${input.reason} — ${fileLabel}`,
  })
}


function resolveMaterialReference(
  value: string,
  materialByCode: Record<string, string>,
  materialByName: Record<string, string>,
) {
  const reference = normalizeCode(value)

  if (materialByCode[reference]) return materialByCode[reference]
  if (materialByName[reference]) return materialByName[reference]

  const codeMatch = Object.entries(materialByCode).find(([code]) => (
    reference.startsWith(`${code} `)
    || reference.startsWith(`${code} ·`)
    || reference.startsWith(`${code} -`)
    || reference.startsWith(`${code}|`)
  ))

  if (codeMatch) return codeMatch[1]

  return undefined
}

function normalizeInventoryPayload(input: InventoryUpdateInput) {
  return {
    material_id: input.materialId,
    total_bodega: Number(input.totalBodega || 0),
    notes: cleanText(input.notes ?? ''),
  }
}

function mapInventoryBalanceRow(row: MaterialInventoryRow): InventoryBalanceView {
  return {
    materialId: row.material_id,
    totalBodega: Number(row.total_bodega ?? 0),
    notes: row.notes ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function cleanText(value: string | null | undefined) {
  const clean = String(value ?? '').trim()
  return clean || null
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase()
}

function isMissingInventoryTableError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('material_inventory') || normalized.includes('could not find the table') || normalized.includes('relation') && normalized.includes('does not exist')
}

function readFallbackBalances(): InventoryBalanceView[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}

    return Object.values(parsed as Record<string, MaterialInventoryRow>).map(mapInventoryBalanceRow)
  } catch {
    return []
  }
}

function writeFallbackBalance(row: MaterialInventoryRow): MaterialInventoryRow {
  if (typeof window === 'undefined') return row

  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const next = { ...(parsed as Record<string, MaterialInventoryRow>), [row.material_id]: row }
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Si el navegador bloquea localStorage, al menos devolvemos el valor de la sesión actual.
  }

  return row
}
