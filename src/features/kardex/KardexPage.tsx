import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDate, formatDateMonth, formatNumber } from '../../utils/format'
import {
  createKardexInput,
  getKardexOptions,
  listKardexInputs,
  updateKardexInput,
} from './kardexService'
import type {
  KardexControlPointView,
  KardexInputFormInput,
  KardexInputRecordForAudit,
  KardexInputView,
  KardexOptions,
} from './kardexTypes'

type DrawerMode = 'input-create' | 'input-edit' | null

const MAX_CONTROLS_PER_MONTH = 5

type KardexDisplayRow = KardexInputView & {
  isRegistered: boolean
}

type KardexTotals = {
  totalBodega: number
  totalPedido: number
  totalTransito: number
  totalStockSeguridad: number
  totalIndustrializacion: number
  totalDisponible: number
  totalConsumoProyectado: number
  totalEntregaProduccion: number
  totalPendiente: number
  totalInventarioFinal: number
}

type KardexControlBranch = {
  point: KardexControlPointView
  rows: KardexDisplayRow[]
  totals: KardexTotals
  registeredRowsCount: number
}

type KardexMonthGroup = {
  month: string
  monthLabel: string
  controls: KardexControlBranch[]
}

type KardexWeekGroup = {
  weekKey: string
  weekNumber: number
  weekLabel: string
  controls: KardexControlBranch[]
}

type KardexPivotColumn = {
  key: string
  label: string
  group: KardexMonthGroup
  week: KardexWeekGroup
  control: KardexControlBranch
}

type KardexPivotMetric = {
  key: string
  label: string
  className?: string
  getValue: (column: KardexPivotColumn) => string
}

type KardexMaterialPivotMetric = {
  key: string
  label: string
  className?: string
  getValue: (row: KardexDisplayRow | undefined) => string
}

const emptyTotals: KardexTotals = {
  totalBodega: 0,
  totalPedido: 0,
  totalTransito: 0,
  totalStockSeguridad: 0,
  totalIndustrializacion: 0,
  totalDisponible: 0,
  totalConsumoProyectado: 0,
  totalEntregaProduccion: 0,
  totalPendiente: 0,
  totalInventarioFinal: 0,
}

const emptyKardexInputForm: KardexInputFormInput = {
  material_type: '',
  material_id: '',
  control_date_id: '',
  total_bodega: '0',
  pedido: '0',
  transito: '0',
  stock_seguridad: '0',
  industrializacion: '0',
  notes: '',
}

function kardexToForm(row: KardexInputView): KardexInputFormInput {
  return {
    material_type: row.materialType,
    material_id: row.materialId,
    control_date_id: row.controlDateId,
    total_bodega: String(row.totalBodega),
    pedido: String(row.pedido),
    transito: String(row.transito),
    stock_seguridad: String(row.stockSeguridad),
    industrializacion: String(row.industrializacion),
    notes: row.notes ?? '',
  }
}

function kardexAuditRecord(row: KardexInputView): KardexInputRecordForAudit {
  return {
    id: row.id,
    material_id: row.materialId,
    material_type: row.materialType,
    material_type_control_date_id: row.controlDateId,
    total_bodega: row.totalBodega,
    pedido: row.pedido,
    transito: row.transito,
    stock_seguridad: row.stockSeguridad,
    industrializacion: row.industrializacion,
    notes: row.notes,
  }
}

export function KardexPage() {
  const [rows, setRows] = useState<KardexInputView[]>([])
  const [options, setOptions] = useState<KardexOptions>({
    materialTypes: [],
    materials: [],
    controlPoints: [],
    requirements: [],
    inventoryBalances: [],
  })
  const [selectedMaterialType, setSelectedMaterialType] = useState('')
  const [selectedControlPointId, setSelectedControlPointId] = useState('all')
  const [search, setSearch] = useState('')
  const [detailMaterialType, setDetailMaterialType] = useState('')
  const [detailMaterialIds, setDetailMaterialIds] = useState<string[]>([])
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedKardexInput, setSelectedKardexInput] = useState<KardexInputView | null>(null)
  const [kardexForm, setKardexForm] = useState<KardexInputFormInput>(emptyKardexInputForm)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSummaryLeftPinned, setIsSummaryLeftPinned] = useState(true)
  const [isSummaryLeftHidden, setIsSummaryLeftHidden] = useState(false)
  const [isDetailLeftPinned, setIsDetailLeftPinned] = useState(true)
  const [isDetailLeftHidden, setIsDetailLeftHidden] = useState(false)

  async function loadKardex() {
    setIsLoading(true)
    setError(null)

    try {
      const [inputRows, kardexOptions] = await Promise.all([
        listKardexInputs(),
        getKardexOptions(),
      ])

      setRows(inputRows)
      setOptions(kardexOptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el Kardex.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadKardex()
  }, [])

  useEffect(() => {
    if (!selectedMaterialType && options.materialTypes.length > 0) {
      setSelectedMaterialType(options.materialTypes[0].materialType)
    }
  }, [options.materialTypes, selectedMaterialType])

  useEffect(() => {
    if (!detailMaterialType && options.materialTypes.length > 0) {
      setDetailMaterialType(selectedMaterialType || options.materialTypes[0].materialType)
    }
  }, [detailMaterialType, options.materialTypes, selectedMaterialType])

  useEffect(() => {
    setDetailMaterialIds((currentIds) => {
      const availableIds = new Set(
        options.materials
          .filter((material) => !detailMaterialType || material.materialType === detailMaterialType)
          .map((material) => material.id),
      )

      return currentIds.filter((materialId) => availableIds.has(materialId))
    })
  }, [detailMaterialType, options.materials])

  useEffect(() => {
    if (!selectedMaterialType) {
      setSelectedControlPointId('')
      return
    }

    const controlPointsForType = options.controlPoints.filter((point) => point.materialType === selectedMaterialType)
    if (controlPointsForType.length === 0) {
      setSelectedControlPointId('')
      return
    }

    if (!selectedControlPointId || selectedControlPointId === 'all') {
      setSelectedControlPointId('all')
      return
    }

    if (!controlPointsForType.some((point) => point.id === selectedControlPointId)) {
      setSelectedControlPointId('all')
    }
  }, [options.controlPoints, selectedControlPointId, selectedMaterialType])

  const selectedTypeOption = options.materialTypes.find((type) => type.materialType === selectedMaterialType)

  const visibleMaterials = useMemo(() => {
    if (!selectedMaterialType) return options.materials
    return options.materials.filter((material) => material.materialType === selectedMaterialType)
  }, [options.materials, selectedMaterialType])

  const visibleControlPoints = useMemo(() => {
    const points = !selectedMaterialType
      ? options.controlPoints
      : options.controlPoints.filter((point) => point.materialType === selectedMaterialType)

    return [...points].sort(sortControlPoints)
  }, [options.controlPoints, selectedMaterialType])

  const selectedControlPoint = useMemo(() => {
    if (!selectedControlPointId || selectedControlPointId === 'all') return null
    return visibleControlPoints.find((point) => point.id === selectedControlPointId) ?? null
  }, [selectedControlPointId, visibleControlPoints])

  const activeControlPoints = useMemo(() => {
    if (!selectedControlPointId || selectedControlPointId === 'all') return visibleControlPoints
    return visibleControlPoints.filter((point) => point.id === selectedControlPointId)
  }, [selectedControlPointId, visibleControlPoints])

  const summaryMaterials = visibleMaterials

  const detailMaterialsForType = useMemo(() => {
    if (!detailMaterialType) return options.materials
    return options.materials.filter((material) => material.materialType === detailMaterialType)
  }, [detailMaterialType, options.materials])

  const detailFilteredMaterials = useMemo(() => {
    if (detailMaterialIds.length === 0) return detailMaterialsForType

    const selectedIds = new Set(detailMaterialIds)
    return detailMaterialsForType.filter((material) => selectedIds.has(material.id))
  }, [detailMaterialIds, detailMaterialsForType])

  const detailControlPoints = useMemo(() => {
    const points = !detailMaterialType
      ? options.controlPoints
      : options.controlPoints.filter((point) => point.materialType === detailMaterialType)

    return [...points].sort(sortControlPoints)
  }, [detailMaterialType, options.controlPoints])

  const selectedDetailTypeOption = options.materialTypes.find((type) => type.materialType === detailMaterialType)

  const inputRowsByControlAndMaterial = useMemo(() => {
    return rows.reduce<Record<string, KardexInputView>>((acc, row) => {
      acc[buildKardexKey(row.controlDateId, row.materialId)] = row
      return acc
    }, {})
  }, [rows])

  const requirementByControlAndMaterial = useMemo(() => {
    return options.requirements.reduce<Record<string, number>>((acc, row) => {
      acc[buildKardexKey(row.controlDateId, row.materialId)] = row.requiredQuantity
      return acc
    }, {})
  }, [options.requirements])

  const inventoryBalanceByMaterial = useMemo(() => {
    return options.inventoryBalances.reduce<Record<string, number>>((acc, row) => {
      acc[row.materialId] = row.totalBodega
      return acc
    }, {})
  }, [options.inventoryBalances])

  function getInventoryBalance(materialId: string | null | undefined) {
    return materialId ? inventoryBalanceByMaterial[materialId] ?? 0 : 0
  }

  const kardexGroupsByMonth = useMemo<KardexMonthGroup[]>(() => {
    const query = search.trim().toLowerCase()
    const groups = new Map<string, KardexMonthGroup>()

    for (const point of activeControlPoints) {
      const controlRows = summaryMaterials
        .filter((material) => !query || [
          material.code,
          material.name,
          material.materialTypeLabel,
          point.controlLabel,
          `Control ${point.controlNumber}`,
          point.controlDate,
          point.periodMonth,
          formatMonthTitle(point.periodMonth),
          formatControlWeekLabel(point.controlDate),
        ].join(' ').toLowerCase().includes(query))
        .map((material) => {
          const savedInput = inputRowsByControlAndMaterial[buildKardexKey(point.id, material.id)]
          if (savedInput) {
            return { ...savedInput, isRegistered: true }
          }

          const projectedConsumption = requirementByControlAndMaterial[buildKardexKey(point.id, material.id)] ?? 0
          const totalBodega = getInventoryBalance(material.id)
          const operationalRequirement = projectedConsumption
          const availableBalance = totalBodega - operationalRequirement
          const pendientePorPedir = Math.max(operationalRequirement - totalBodega, 0)

          return {
            id: `virtual-${point.id}-${material.id}`,
            materialId: material.id,
            materialCode: material.code,
            materialName: material.name,
            materialType: material.materialType,
            materialTypeLabel: material.materialTypeLabel,
            unit: material.unit,
            controlDateId: point.id,
            periodMonth: point.periodMonth,
            controlDate: point.controlDate,
            controlNumber: point.controlNumber,
            controlLabel: point.controlLabel,
            totalBodega,
            pedido: 0,
            transito: 0,
            stockSeguridad: 0,
            industrializacion: 0,
            projectedConsumption,
            entregaProduccion: 0,
            operationalRequirement,
            pendientePorPedir,
            inventarioFinal: totalBodega - projectedConsumption,
            availableBalance,
            notes: null,
            isRegistered: false,
          }
        })

      const month = point.periodMonth || 'sin-mes'
      const group = groups.get(month) ?? {
        month,
        monthLabel: formatMonthTitle(point.periodMonth),
        controls: [],
      }

      group.controls.push({
        point,
        rows: controlRows,
        totals: aggregateKardexRows(controlRows),
        registeredRowsCount: controlRows.filter((row) => row.isRegistered).length,
      })
      groups.set(month, group)
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        controls: [...group.controls].sort((a, b) => sortControlPoints(a.point, b.point)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [activeControlPoints, summaryMaterials, inputRowsByControlAndMaterial, requirementByControlAndMaterial, inventoryBalanceByMaterial, search])

  const kardexDetailGroupsByMonth = useMemo<KardexMonthGroup[]>(() => {
    const groups = new Map<string, KardexMonthGroup>()

    for (const point of detailControlPoints) {
      const controlRows = detailFilteredMaterials.map((material) => {
        const savedInput = inputRowsByControlAndMaterial[buildKardexKey(point.id, material.id)]
        if (savedInput) {
          return { ...savedInput, isRegistered: true }
        }

        const projectedConsumption = requirementByControlAndMaterial[buildKardexKey(point.id, material.id)] ?? 0
        const totalBodega = getInventoryBalance(material.id)
        const operationalRequirement = projectedConsumption
        const availableBalance = totalBodega - operationalRequirement
        const pendientePorPedir = Math.max(operationalRequirement - totalBodega, 0)

        return {
          id: `virtual-${point.id}-${material.id}`,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          materialType: material.materialType,
          materialTypeLabel: material.materialTypeLabel,
          unit: material.unit,
          controlDateId: point.id,
          periodMonth: point.periodMonth,
          controlDate: point.controlDate,
          controlNumber: point.controlNumber,
          controlLabel: point.controlLabel,
          totalBodega,
          pedido: 0,
          transito: 0,
          stockSeguridad: 0,
          industrializacion: 0,
          projectedConsumption,
          entregaProduccion: 0,
          operationalRequirement,
          pendientePorPedir,
          inventarioFinal: totalBodega - projectedConsumption,
          availableBalance,
          notes: null,
          isRegistered: false,
        }
      })

      const month = point.periodMonth || 'sin-mes'
      const group = groups.get(month) ?? {
        month,
        monthLabel: formatMonthTitle(point.periodMonth),
        controls: [],
      }

      group.controls.push({
        point,
        rows: controlRows,
        totals: aggregateKardexRows(controlRows),
        registeredRowsCount: controlRows.filter((row) => row.isRegistered).length,
      })
      groups.set(month, group)
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        controls: [...group.controls].sort((a, b) => sortControlPoints(a.point, b.point)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [detailControlPoints, detailFilteredMaterials, inputRowsByControlAndMaterial, requirementByControlAndMaterial, inventoryBalanceByMaterial])

  const kardexDetailRows = useMemo(() => {
    return kardexGroupsByMonth.flatMap((group) => group.controls.flatMap((control) => control.rows))
  }, [kardexGroupsByMonth])

  const totals = useMemo(() => aggregateKardexRows(kardexDetailRows), [kardexDetailRows])
  const registeredRowsCount = kardexDetailRows.filter((row) => row.isRegistered).length
  const visibleControlsCount = kardexGroupsByMonth.reduce((sum, group) => sum + group.controls.length, 0)
  const kardexPivotColumns = useMemo(() => buildKardexPivotColumns(kardexGroupsByMonth), [kardexGroupsByMonth])
  const kardexMonthHeaderGroups = useMemo(() => buildKardexMonthHeaderGroups(kardexPivotColumns), [kardexPivotColumns])
  const kardexPivotColSpan = Math.max(kardexPivotColumns.length + 1, 2)
  const detailKardexPivotColumns = useMemo(() => buildKardexPivotColumns(kardexDetailGroupsByMonth), [kardexDetailGroupsByMonth])
  const detailKardexMonthHeaderGroups = useMemo(() => buildKardexMonthHeaderGroups(detailKardexPivotColumns), [detailKardexPivotColumns])
  const detailKardexPivotColSpan = Math.max(detailKardexPivotColumns.length + 1, 2)

  const availableBalancePreview = useMemo(() => {
    return (
      Number(kardexForm.total_bodega || 0)
      + Number(kardexForm.pedido || 0)
      + Number(kardexForm.transito || 0)
      - Number(kardexForm.stock_seguridad || 0)
      - Number(kardexForm.industrializacion || 0)
    )
  }, [kardexForm])

  function handleMaterialTypeChange(materialType: string) {
    setSelectedMaterialType(materialType)
    setSelectedControlPointId('all')
  }

  function handleDetailMaterialTypeChange(materialType: string) {
    setDetailMaterialType(materialType)
    setDetailMaterialIds([])
  }

  function handleDetailMaterialsChange(selectedIds: string[]) {
    setDetailMaterialIds(selectedIds)
  }

  function openCreateInput(materialId?: string, controlDateId?: string) {
    const initialMaterialId = materialId
    const selectedMaterialOption = initialMaterialId ? options.materials.find((material) => material.id === initialMaterialId) : null
    const selectedPoint = controlDateId ? options.controlPoints.find((point) => point.id === controlDateId) : null
    const materialType = selectedMaterialOption?.materialType
      ?? selectedPoint?.materialType
      ?? selectedMaterialType
      ?? options.materialTypes[0]?.materialType
      ?? ''
    const firstMaterial = options.materials.find((material) => material.materialType === materialType)
    const selectedMaterialId = initialMaterialId ?? firstMaterial?.id ?? ''
    const firstControlPoint = selectedPoint
      ?? selectedControlPoint
      ?? visibleControlPoints[0]
      ?? options.controlPoints.find((point) => point.materialType === materialType)

    setDrawerMode('input-create')
    setSelectedKardexInput(null)
    setKardexForm({
      ...emptyKardexInputForm,
      material_type: materialType,
      material_id: selectedMaterialId,
      control_date_id: controlDateId ?? firstControlPoint?.id ?? '',
      total_bodega: String(getInventoryBalance(selectedMaterialId)),
    })
    setReason('Registro de input Kardex por tipo de material')
    setError(null)
    setFeedback(null)
  }

  function openEditInput(row: KardexInputView) {
    setDrawerMode('input-edit')
    setSelectedKardexInput(row)
    setKardexForm(kardexToForm(row))
    setReason('Actualización de input Kardex por tipo de material')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedKardexInput(null)
    setError(null)
  }

  async function handleKardexSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateKardexForm(kardexForm)

      if (!reason.trim()) {
        throw new Error('El motivo de auditoría es obligatorio.')
      }

      if (drawerMode === 'input-edit' && selectedKardexInput) {
        await updateKardexInput(selectedKardexInput.id, kardexAuditRecord(selectedKardexInput), kardexForm, reason)
        setFeedback('Input Kardex actualizado correctamente.')
      } else {
        await createKardexInput(kardexForm, reason)
        setFeedback('Input Kardex creado correctamente.')
      }

      await loadKardex()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el input Kardex.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleDrawerMaterialTypeChange(materialType: string) {
    const firstMaterial = options.materials.find((material) => material.materialType === materialType)
    const firstMaterialId = firstMaterial?.id ?? ''
    const firstControlPoint = options.controlPoints.find((point) => point.materialType === materialType)

    setKardexForm({
      ...kardexForm,
      material_type: materialType,
      material_id: firstMaterialId,
      control_date_id: firstControlPoint?.id ?? '',
      total_bodega: drawerMode === 'input-create' ? String(getInventoryBalance(firstMaterialId)) : kardexForm.total_bodega,
    })
  }

  function handleDrawerMaterialChange(materialId: string) {
    const material = options.materials.find((item) => item.id === materialId)

    setKardexForm({
      ...kardexForm,
      material_id: materialId,
      material_type: material?.materialType ?? kardexForm.material_type,
      total_bodega: drawerMode === 'input-create' ? String(getInventoryBalance(materialId)) : kardexForm.total_bodega,
    })
  }

  const drawerMaterials = options.materials.filter((material) => material.materialType === kardexForm.material_type)
  const drawerControlPoints = options.controlPoints
    .filter((point) => point.materialType === kardexForm.material_type)
    .sort(sortControlPoints)

  return (
    <>
      <div className="filter-bar smart-filter">
        <span className="filter-label">Kardex</span>
        <select className="filter-select" value={selectedMaterialType} onChange={(event) => handleMaterialTypeChange(event.target.value)}>
          <option value="">Selecciona tipo...</option>
          {options.materialTypes.map((type) => (
            <option key={type.materialType} value={type.materialType}>{type.label} · {type.materialCount} materiales</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={visibleControlPoints.length ? selectedControlPointId || 'all' : ''}
          onChange={(event) => setSelectedControlPointId(event.target.value)}
          disabled={!visibleControlPoints.length}
        >
          <option value="">Sin controles</option>
          <option value="all">Todos los controles del tipo</option>
          {visibleControlPoints.map((point) => (
            <option key={point.id} value={point.id}>
              {formatMonthTitle(point.periodMonth)} · {formatControlWeekLabel(point.controlDate)} · {formatControlPointLabel(point)} · {formatDate(point.controlDate)}
            </option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="Buscar material, mes, control o fecha..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadKardex()}>Recargar</button>
        <button className="btn btn-primary" type="button" onClick={() => openCreateInput()} disabled={!visibleControlPoints.length}>+ Input Kardex</button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <div className="planning-note">
        <strong>Fechas desde GANTT:</strong> aquí no se crean fechas. El Kardex agrupa por mes y despliega las ramas de control configuradas en GANTT para el tipo de material seleccionado.
      </div>

      <div className="kardex-control-summary">
        <div className="summary-item">
          <span>Tipo</span>
          <strong>{selectedTypeOption?.label ?? 'Sin tipo seleccionado'}</strong>
        </div>
        <div className="summary-item">
          <span>Meses con control</span>
          <strong>{kardexGroupsByMonth.length}</strong>
        </div>
        <div className="summary-item">
          <span>Controles visibles</span>
          <strong>{visibleControlsCount}</strong>
        </div>
        <div className="summary-item">
          <span>Materiales cubiertos</span>
          <strong>{summaryMaterials.length} materiales</strong>
        </div>
        <div className="summary-item">
          <span>Registros Kardex</span>
          <strong>{registeredRowsCount}/{kardexDetailRows.length}</strong>
        </div>
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Total bodega" value={formatNumber(totals.totalBodega, 2)} sub="materiales filtrados" />
        <KpiCard label="Consumo proyectado" value={formatNumber(totals.totalConsumoProyectado, 2)} sub="desde BOM + control" />
        <KpiCard label="Tránsito" value={formatNumber(totals.totalTransito, 2)} sub="suma del tipo" />
        <KpiCard label="Pendiente por pedir" value={formatNumber(totals.totalPendiente, 2)} sub="faltante operativo" />
      </div>

      <TableShell title="Kardex consolidado por tipo de material" subtitle="La lectura queda como matriz: fecha arriba, mes debajo, control debajo y los indicadores operativos como filas.">
        <div className="kardex-table-toolbar">
          <div className="kardex-table-toolbar__group">
            <span className="kardex-table-toolbar__label">Indicadores izquierda</span>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setIsSummaryLeftPinned((current) => !current)} disabled={isSummaryLeftHidden}>
              {isSummaryLeftPinned ? 'Liberar' : 'Fijar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                setIsSummaryLeftHidden((current) => !current)
                if (isSummaryLeftHidden) setIsSummaryLeftPinned(true)
              }}
            >
              {isSummaryLeftHidden ? 'Mostrar indicadores' : 'Ocultar indicadores'}
            </button>
          </div>
          <span className="form-hint">Desliza horizontalmente para revisar meses y controles. Si tienes muchos puntos de control, puedes liberar u ocultar la columna izquierda.</span>
        </div>
        <table className={`kardex-target-table ${isSummaryLeftPinned ? 'kardex-left-pinned' : 'kardex-left-scroll'} ${isSummaryLeftHidden ? 'kardex-left-hidden' : ''}`}>
          <thead>
            <tr className="kardex-date-header-row">
              <th className="kardex-row-header">Fecha control</th>
              {kardexPivotColumns.map((column) => (
                <th key={`fecha-${column.key}`}>{formatDate(column.control.point.controlDate)}</th>
              ))}
            </tr>
            <tr className="kardex-month-header-row">
              <th>Mes</th>
              {kardexMonthHeaderGroups.map((monthGroup) => (
                <th key={`mes-${monthGroup.key}`} colSpan={monthGroup.colSpan}>
                  {monthGroup.label}
                </th>
              ))}
            </tr>
            <tr className="kardex-control-header-row">
              <th>Control</th>
              {kardexPivotColumns.map((column) => (
                <th key={`control-${column.key}`}>Control {column.control.point.controlNumber}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={kardexPivotColSpan}>Cargando Kardex...</td></tr>
            ) : kardexGroupsByMonth.length === 0 ? (
              <tr><td colSpan={kardexPivotColSpan}>No hay puntos de control para el tipo y filtros seleccionados. Créalos primero en GANTT.</td></tr>
            ) : (
              <>
                <tr className="kardex-consolidated-row">
                  <td colSpan={kardexPivotColSpan}>
                    Consolidado · {selectedTypeOption?.label ?? 'Tipo de material'}
                  </td>
                </tr>
                {getKardexTargetMetrics(selectedTypeOption?.label ?? 'Material', selectedTypeOption?.unit ?? '').map((metric) => (
                  <tr key={metric.key} className={metric.className}>
                    <td className="kardex-pivot-label"><strong>{metric.label}</strong></td>
                    {kardexPivotColumns.map((column) => (
                      <td key={`${metric.key}-${column.key}`}>{metric.getValue(column)}</td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Kardex por material" subtitle="Mismo formato del Kardex general, con filtros independientes por tipo de material y selección múltiple de materiales.">
        <div className="filter-bar smart-filter nested-filter" style={{ marginBottom: 12 }}>
          <span className="filter-label">Filtros material</span>
          <select className="filter-select" value={detailMaterialType} onChange={(event) => handleDetailMaterialTypeChange(event.target.value)}>
            <option value="">Todos los tipos</option>
            {options.materialTypes.map((type) => (
              <option key={type.materialType} value={type.materialType}>{type.label} · {type.materialCount} materiales</option>
            ))}
          </select>
          <select
            className="filter-select"
            multiple
            size={Math.min(Math.max(detailMaterialsForType.length, 3), 6)}
            value={detailMaterialIds}
            onChange={(event) => handleDetailMaterialsChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
          >
            {detailMaterialsForType.map((material) => (
              <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" type="button" onClick={() => handleDetailMaterialsChange([])}>Ver todos</button>
          <span className="form-hint">{selectedDetailTypeOption?.label ?? 'Todos los tipos'} · {detailFilteredMaterials.length} materiales visibles · {detailMaterialIds.length === 0 ? 'todos los materiales' : `${detailMaterialIds.length} materiales seleccionados`}</span>
        </div>
        <div className="kardex-table-toolbar">
          <div className="kardex-table-toolbar__group">
            <span className="kardex-table-toolbar__label">Indicadores izquierda</span>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setIsDetailLeftPinned((current) => !current)} disabled={isDetailLeftHidden}>
              {isDetailLeftPinned ? 'Liberar' : 'Fijar'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                setIsDetailLeftHidden((current) => !current)
                if (isDetailLeftHidden) setIsDetailLeftPinned(true)
              }}
            >
              {isDetailLeftHidden ? 'Mostrar indicadores' : 'Ocultar indicadores'}
            </button>
          </div>
          <span className="form-hint">Este control solo aplica al Kardex por material. Puedes ocultar la columna izquierda para revisar muchos meses sin perder espacio.</span>
        </div>
        <table className={`kardex-target-table ${isDetailLeftPinned ? 'kardex-left-pinned' : 'kardex-left-scroll'} ${isDetailLeftHidden ? 'kardex-left-hidden' : ''}`}>
          <thead>
            <tr className="kardex-date-header-row">
              <th className="kardex-row-header">Fecha control</th>
              {detailKardexPivotColumns.map((column) => (
                <th key={`detail-fecha-${column.key}`}>{formatDate(column.control.point.controlDate)}</th>
              ))}
            </tr>
            <tr className="kardex-month-header-row">
              <th>Mes</th>
              {detailKardexMonthHeaderGroups.map((monthGroup) => (
                <th key={`detail-mes-${monthGroup.key}`} colSpan={monthGroup.colSpan}>
                  {monthGroup.label}
                </th>
              ))}
            </tr>
            <tr className="kardex-control-header-row">
              <th>Control</th>
              {detailKardexPivotColumns.map((column) => (
                <th key={`detail-control-${column.key}`}>Control {column.control.point.controlNumber}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={detailKardexPivotColSpan}>Cargando Kardex...</td></tr>
            ) : detailKardexPivotColumns.length === 0 ? (
              <tr><td colSpan={detailKardexPivotColSpan}>No hay puntos de control para el tipo y filtros seleccionados.</td></tr>
            ) : detailFilteredMaterials.length === 0 ? (
              <tr><td colSpan={detailKardexPivotColSpan}>No hay materiales para los filtros seleccionados.</td></tr>
            ) : (
              detailFilteredMaterials.map((material) => (
                <Fragment key={`detail-material-matrix-${material.id}`}>
                  <tr className="kardex-consolidated-row kardex-material-section-row">
                    <td colSpan={detailKardexPivotColSpan}>
                      {material.code} · {material.name} · {material.materialTypeLabel}
                    </td>
                  </tr>
                  {getKardexMaterialTargetMetrics(material.name, material.unit).map((metric) => (
                    <tr key={`${material.id}-${metric.key}`} className={metric.className}>
                      <td className="kardex-pivot-label"><strong>{metric.label}</strong></td>
                      {detailKardexPivotColumns.map((column) => {
                        const row = findMaterialRowForColumn(column, material.id)
                        return <td key={`${material.id}-${metric.key}-${column.key}`}>{metric.getValue(row)}</td>
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="kardex-pivot-label"><strong>Registros</strong></td>
                    {detailKardexPivotColumns.map((column) => {
                      const row = findMaterialRowForColumn(column, material.id)
                      return <td key={`${material.id}-registro-${column.key}`}>{row?.isRegistered ? '1/1' : '0/1'}</td>
                    })}
                  </tr>
                  <tr>
                    <td className="kardex-pivot-label"><strong>Estado</strong></td>
                    {detailKardexPivotColumns.map((column) => {
                      const row = findMaterialRowForColumn(column, material.id)
                      return (
                        <td key={`${material.id}-estado-${column.key}`}>
                          <Badge>{row ? (row.isRegistered ? (row.availableBalance < 0 ? 'Faltante' : 'Activo') : 'Sin registrar') : 'Sin material'}</Badge>
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td className="kardex-pivot-label"><strong>Acción</strong></td>
                    {detailKardexPivotColumns.map((column) => {
                      const row = findMaterialRowForColumn(column, material.id)
                      return (
                        <td key={`${material.id}-accion-${column.key}`}>
                          {row ? (
                            row.isRegistered ? (
                              <button className="action-btn" type="button" onClick={() => openEditInput(row)}>Editar</button>
                            ) : (
                              <button className="action-btn" type="button" onClick={() => openCreateInput(row.materialId, row.controlDateId)}>Registrar</button>
                            )
                          ) : '-'}
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      <Drawer
        isOpen={drawerMode === 'input-create' || drawerMode === 'input-edit'}
        title={drawerMode === 'input-edit' ? 'Editar input Kardex' : 'Nuevo input Kardex'}
        subtitle="Carga saldos para un material dentro del tipo y fecha definidos en GANTT"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="kardex-input-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar input'}
            </button>
          </>
        }
      >
        <form id="kardex-input-form" className="drawer-form" onSubmit={handleKardexSubmit}>
          <div className="form-group">
            <label>Tipo de material</label>
            <select className="form-control" value={kardexForm.material_type} onChange={(event) => handleDrawerMaterialTypeChange(event.target.value)}>
              <option value="">Selecciona...</option>
              {options.materialTypes.map((type) => (
                <option key={type.materialType} value={type.materialType}>{type.label} · {type.materialCount} materiales</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Material</label>
            <select className="form-control" value={kardexForm.material_id} onChange={(event) => handleDrawerMaterialChange(event.target.value)}>
              <option value="">Selecciona...</option>
              {drawerMaterials.map((material) => (
                <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha de control Kardex</label>
            <select className="form-control" value={kardexForm.control_date_id} onChange={(event) => setKardexForm({ ...kardexForm, control_date_id: event.target.value })}>
              <option value="">Selecciona...</option>
              {drawerControlPoints.map((point) => (
                <option key={point.id} value={point.id}>
                  {formatDateMonth(point.periodMonth)} · {formatControlWeekLabel(point.controlDate)} · {formatControlPointLabel(point)} · {formatDate(point.controlDate)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total bodega</label>
              <input className="form-control" type="number" step="0.0001" value={kardexForm.total_bodega} onChange={(event) => setKardexForm({ ...kardexForm, total_bodega: event.target.value })} />
              <small className="form-hint">Se precarga desde Inventario de bodega del material.</small>
            </div>
            <div className="form-group">
              <label>Pedido</label>
              <input className="form-control" type="number" step="0.0001" value={kardexForm.pedido} onChange={(event) => setKardexForm({ ...kardexForm, pedido: event.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tránsito</label>
              <input className="form-control" type="number" step="0.0001" value={kardexForm.transito} onChange={(event) => setKardexForm({ ...kardexForm, transito: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Stock seguridad</label>
              <input className="form-control" type="number" step="0.0001" value={kardexForm.stock_seguridad} onChange={(event) => setKardexForm({ ...kardexForm, stock_seguridad: event.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Industrialización / reserva producción</label>
            <input className="form-control" type="number" step="0.0001" value={kardexForm.industrializacion} onChange={(event) => setKardexForm({ ...kardexForm, industrializacion: event.target.value })} />
          </div>

          <div className="impact-box">
            <div className="impact-title">Balance disponible preliminar</div>
            <div className="impact-row">
              <span>Fórmula base</span>
              <strong>Bodega + Pedido + Tránsito - Seguridad - Industrialización</strong>
            </div>
            <div className="impact-row">
              <span>Resultado sin consumo proyectado</span>
              <strong>{formatNumber(availableBalancePreview, 2)}</strong>
            </div>
            <div className="impact-row">
              <span>Nota</span>
              <strong>Al guardar, Kardex cruza material + fecha de control con la necesidad calculada desde BOM.</strong>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea className="form-control textarea-control" value={kardexForm.notes} onChange={(event) => setKardexForm({ ...kardexForm, notes: event.target.value })} placeholder="Observaciones de abastecimiento, producción o inventario." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica este input Kardex." />
          </div>
        </form>
      </Drawer>
    </>
  )
}


function buildKardexPivotColumns(groups: KardexMonthGroup[]): KardexPivotColumn[] {
  return groups.flatMap((group) => groupControlBranchesByWeek(group.controls).flatMap((week) => (
    week.controls.map((control) => ({
      key: `${group.month}-${week.weekKey}-${control.point.id}`,
      label: `${group.monthLabel} · ${week.weekLabel} · ${formatControlPointLabel(control.point)}`,
      group,
      week,
      control,
    }))
  )))
}

function buildKardexMonthHeaderGroups(columns: KardexPivotColumn[]) {
  return columns.reduce<Array<{ key: string; label: string; colSpan: number }>>((acc, column) => {
    const monthKey = column.group.month || 'sin-mes'
    const lastGroup = acc[acc.length - 1]

    if (lastGroup?.key === monthKey) {
      lastGroup.colSpan += 1
      return acc
    }

    acc.push({
      key: monthKey,
      label: formatShortMonthTitle(column.group.month),
      colSpan: 1,
    })

    return acc
  }, [])
}

function getKardexTargetMetrics(materialTypeLabel: string, unit: string): KardexPivotMetric[] {
  const unitSuffix = unit ? ` (${unit})` : ''
  const normalizedMaterialType = materialTypeLabel.trim() || 'Material'
  const stockLineLabel = `${normalizedMaterialType} bodega + tránsito + pedido`.toUpperCase()

  return [
    {
      key: 'total-bodega',
      label: `Total bodega${unitSuffix}`,
      getValue: (column) => formatNumber(column.control.totals.totalBodega, 2),
    },
    {
      key: 'pedido',
      label: `Pedido${unitSuffix}`,
      getValue: (column) => formatNumber(column.control.totals.totalPedido, 2),
    },
    {
      key: 'transito',
      label: `Tránsito${unitSuffix}`,
      getValue: (column) => formatNumber(column.control.totals.totalTransito, 2),
    },
    {
      key: 'bodega-transito-pedido',
      label: stockLineLabel,
      className: 'kardex-calculated-row',
      getValue: (column) => formatNumber(column.control.totals.totalBodega + column.control.totals.totalPedido + column.control.totals.totalTransito, 2),
    },
    {
      key: 'pendiente-por-pedir',
      label: 'Pendiente por pedir',
      className: 'kardex-alert-row',
      getValue: (column) => formatNumber(column.control.totals.totalPendiente, 2),
    },
    {
      key: 'consumo-proyectado',
      label: `Consumo proyectado${unitSuffix}`,
      className: 'kardex-consumption-row',
      getValue: (column) => formatNumber(column.control.totals.totalConsumoProyectado, 2),
    },
    {
      key: 'inventario-final',
      label: `Inventario final mes${unitSuffix}`,
      className: 'kardex-final-row',
      getValue: (column) => formatNumber(column.control.totals.totalInventarioFinal, 2),
    },
    {
      key: 'entrega-produccion',
      label: `Entrega producción${unitSuffix}`,
      className: 'kardex-production-row',
      getValue: (column) => formatNumber(column.control.totals.totalEntregaProduccion, 2),
    },
    {
      key: 'stock-seguridad',
      label: `Stock seguridad${unitSuffix}`,
      className: 'kardex-security-row',
      getValue: (column) => formatNumber(column.control.totals.totalStockSeguridad, 2),
    },
    {
      key: 'inventario-final-reserva-stock',
      label: `Inventario final industrialización + stock${unitSuffix}`,
      className: 'kardex-net-final-row',
      getValue: (column) => formatNumber(
        column.control.totals.totalInventarioFinal
          - column.control.totals.totalIndustrializacion
          - column.control.totals.totalStockSeguridad,
        2,
      ),
    },
    {
      key: 'registros',
      label: 'Registros',
      getValue: (column) => `${column.control.registeredRowsCount}/${column.control.rows.length}`,
    },
    {
      key: 'estado',
      label: 'Estado',
      getValue: (column) => getKardexStatusLabel(column.control.totals.totalDisponible, column.control.registeredRowsCount),
    },
  ]
}


function getKardexMaterialTargetMetrics(materialName: string, unit: string): KardexMaterialPivotMetric[] {
  const unitSuffix = unit ? ` (${unit})` : ''
  const normalizedMaterialName = materialName.trim() || 'Material'
  const stockLineLabel = `${normalizedMaterialName} bodega + tránsito + pedido`.toUpperCase()

  return [
    {
      key: 'total-bodega',
      label: `Total bodega${unitSuffix}`,
      getValue: (row) => row ? formatNumber(row.totalBodega, 2) : '-',
    },
    {
      key: 'pedido',
      label: `Pedido${unitSuffix}`,
      getValue: (row) => row ? formatNumber(row.pedido, 2) : '-',
    },
    {
      key: 'transito',
      label: `Tránsito${unitSuffix}`,
      getValue: (row) => row ? formatNumber(row.transito, 2) : '-',
    },
    {
      key: 'bodega-transito-pedido',
      label: stockLineLabel,
      className: 'kardex-calculated-row',
      getValue: (row) => row ? formatNumber(row.totalBodega + row.pedido + row.transito, 2) : '-',
    },
    {
      key: 'pendiente-por-pedir',
      label: 'Pendiente por pedir',
      className: 'kardex-alert-row',
      getValue: (row) => row ? formatNumber(row.pendientePorPedir, 2) : '-',
    },
    {
      key: 'consumo-proyectado',
      label: `Consumo proyectado${unitSuffix}`,
      className: 'kardex-consumption-row',
      getValue: (row) => row ? formatNumber(row.projectedConsumption, 2) : '-',
    },
    {
      key: 'inventario-final',
      label: `Inventario final mes${unitSuffix}`,
      className: 'kardex-final-row',
      getValue: (row) => row ? formatNumber(row.inventarioFinal, 2) : '-',
    },
    {
      key: 'entrega-produccion',
      label: `Entrega producción${unitSuffix}`,
      className: 'kardex-production-row',
      getValue: (row) => row ? formatNumber(row.entregaProduccion, 2) : '-',
    },
    {
      key: 'stock-seguridad',
      label: `Stock seguridad${unitSuffix}`,
      className: 'kardex-security-row',
      getValue: (row) => row ? formatNumber(row.stockSeguridad, 2) : '-',
    },
    {
      key: 'inventario-final-reserva-stock',
      label: `Inventario final industrialización + stock${unitSuffix}`,
      className: 'kardex-net-final-row',
      getValue: (row) => row ? formatNumber(row.inventarioFinal - row.industrializacion - row.stockSeguridad, 2) : '-',
    },
    {
      key: 'notas',
      label: 'Notas',
      getValue: (row) => row?.notes?.trim() || '-',
    },
  ]
}

function findMaterialRowForColumn(column: KardexPivotColumn, materialId: string) {
  return column.control.rows.find((row) => row.materialId === materialId)
}


function validateKardexForm(form: KardexInputFormInput) {
  if (!form.material_type || !form.material_id || !form.control_date_id) {
    throw new Error('Tipo de material, material y fecha de control GANTT son obligatorios.')
  }

  const numericFields = [
    ['Total bodega', form.total_bodega],
    ['Pedido', form.pedido],
    ['Tránsito', form.transito],
    ['Stock seguridad', form.stock_seguridad],
    ['Industrialización', form.industrializacion],
  ]

  for (const [label, value] of numericFields) {
    const numberValue = Number(value || 0)

    if (Number.isNaN(numberValue)) {
      throw new Error(`${label} debe ser un número válido.`)
    }

    if (numberValue < 0) {
      throw new Error(`${label} no puede ser negativo.`)
    }
  }
}

function aggregateKardexRows(rows: KardexDisplayRow[]): KardexTotals {
  return rows.reduce<KardexTotals>((acc, row) => ({
    totalBodega: acc.totalBodega + row.totalBodega,
    totalPedido: acc.totalPedido + row.pedido,
    totalTransito: acc.totalTransito + row.transito,
    totalStockSeguridad: acc.totalStockSeguridad + row.stockSeguridad,
    totalIndustrializacion: acc.totalIndustrializacion + row.industrializacion,
    totalDisponible: acc.totalDisponible + row.availableBalance,
    totalConsumoProyectado: acc.totalConsumoProyectado + row.projectedConsumption,
    totalEntregaProduccion: acc.totalEntregaProduccion + row.entregaProduccion,
    totalPendiente: acc.totalPendiente + row.pendientePorPedir,
    totalInventarioFinal: acc.totalInventarioFinal + row.inventarioFinal,
  }), { ...emptyTotals })
}

function getKardexStatusLabel(totalDisponible: number, registeredRowsCount: number) {
  if (registeredRowsCount === 0) return 'Sin registrar'
  return totalDisponible < 0 ? 'Faltante' : 'Activo'
}

function formatControlPointLabel(point: KardexControlPointView) {
  const baseLabel = `Control ${point.controlNumber}`
  const customLabel = point.controlLabel?.trim()

  if (!customLabel || customLabel.toLowerCase() === baseLabel.toLowerCase()) {
    return baseLabel
  }

  return `${baseLabel} · ${customLabel}`
}

function sortControlPoints(a: KardexControlPointView, b: KardexControlPointView) {
  const monthOrder = a.periodMonth.localeCompare(b.periodMonth)
  if (monthOrder !== 0) return monthOrder

  const controlOrder = a.controlNumber - b.controlNumber
  if (controlOrder !== 0) return controlOrder

  return a.controlDate.localeCompare(b.controlDate)
}

function formatMonthTitle(value: string | null | undefined) {
  if (!value) return 'Sin mes'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  const label = date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
  })

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatShortMonthTitle(value: string | null | undefined) {
  if (!value) return 'Sin mes'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  const label = date.toLocaleDateString('es-CO', {
    month: 'long',
  })

  return label.charAt(0).toUpperCase() + label.slice(1)
}


function groupControlBranchesByWeek(controls: KardexControlBranch[]): KardexWeekGroup[] {
  const groups = controls.reduce<Record<string, KardexWeekGroup>>((acc, control) => {
    const weekNumber = getOperationalWeekNumber(control.point.controlDate)
    const year = getDateYear(control.point.controlDate) || control.point.periodMonth.slice(0, 4) || 'sin-anio'
    const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`
    const current = acc[weekKey] ?? {
      weekKey,
      weekNumber,
      weekLabel: formatControlWeekLabel(control.point.controlDate),
      controls: [],
    }

    current.controls.push(control)
    acc[weekKey] = current
    return acc
  }, {})

  return Object.values(groups)
    .map((group) => ({
      ...group,
      controls: [...group.controls].sort((a, b) => sortControlPoints(a.point, b.point)),
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber || a.weekKey.localeCompare(b.weekKey))
}

function formatControlWeekLabel(dateValue: string | null | undefined) {
  const weekNumber = getOperationalWeekNumber(dateValue)
  return weekNumber ? `Semana ${weekNumber}` : 'Semana sin fecha'
}

function getOperationalWeekNumber(dateValue: string | null | undefined) {
  const date = parseDateOnlyUtc(dateValue)
  if (!date) return 0

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const dayOfWeek = yearStart.getUTCDay()
  const daysUntilNextMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7
  const weekTwoStart = new Date(yearStart)
  weekTwoStart.setUTCDate(yearStart.getUTCDate() + daysUntilNextMonday)

  if (date < weekTwoStart) return 1

  const daysFromWeekTwo = Math.floor((date.getTime() - weekTwoStart.getTime()) / 86_400_000)
  return 2 + Math.floor(daysFromWeekTwo / 7)
}

function getDateYear(dateValue: string | null | undefined) {
  const date = parseDateOnlyUtc(dateValue)
  return date ? String(date.getUTCFullYear()) : ''
}

function parseDateOnlyUtc(dateValue: string | null | undefined) {
  if (!dateValue) return null

  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function buildKardexKey(controlDateId: string, materialId: string) {
  return `${controlDateId}-${materialId}`
}
