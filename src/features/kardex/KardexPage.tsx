import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDate, formatDateMonth, formatNumber, formatQuantity } from '../../utils/format'
import {
  createKardexInput,
  getKardexOptions,
  listKardexInputs,
  updateKardexInput,
} from './kardexService'
import type {
  KardexInputFormInput,
  KardexInputRecordForAudit,
  KardexInputView,
  KardexOptions,
} from './kardexTypes'

type DrawerMode = 'input-create' | 'input-edit' | null

type KardexDisplayRow = KardexInputView & {
  isRegistered: boolean
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
  })
  const [selectedMaterialType, setSelectedMaterialType] = useState('')
  const [selectedControlPointId, setSelectedControlPointId] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('all')
  const [search, setSearch] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedKardexInput, setSelectedKardexInput] = useState<KardexInputView | null>(null)
  const [kardexForm, setKardexForm] = useState<KardexInputFormInput>(emptyKardexInputForm)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

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
    if (!selectedMaterialType) {
      setSelectedControlPointId('')
      return
    }

    const controlPointsForType = options.controlPoints.filter((point) => point.materialType === selectedMaterialType)
    if (controlPointsForType.length === 0) {
      setSelectedControlPointId('')
      return
    }

    if (!controlPointsForType.some((point) => point.id === selectedControlPointId)) {
      setSelectedControlPointId(controlPointsForType[0].id)
    }
  }, [options.controlPoints, selectedControlPointId, selectedMaterialType])

  const selectedTypeOption = options.materialTypes.find((type) => type.materialType === selectedMaterialType)

  const visibleMaterials = useMemo(() => {
    if (!selectedMaterialType) return options.materials
    return options.materials.filter((material) => material.materialType === selectedMaterialType)
  }, [options.materials, selectedMaterialType])

  const visibleControlPoints = useMemo(() => {
    if (!selectedMaterialType) return options.controlPoints
    return options.controlPoints.filter((point) => point.materialType === selectedMaterialType)
  }, [options.controlPoints, selectedMaterialType])

  const selectedControlPoint = useMemo(() => {
    return visibleControlPoints.find((point) => point.id === selectedControlPointId) ?? visibleControlPoints[0] ?? null
  }, [selectedControlPointId, visibleControlPoints])

  const inputRowsByMaterial = useMemo(() => {
    return rows.reduce<Record<string, KardexInputView>>((acc, row) => {
      if (selectedControlPoint && row.controlDateId === selectedControlPoint.id) {
        acc[row.materialId] = row
      }
      return acc
    }, {})
  }, [rows, selectedControlPoint])

  const requirementByMaterial = useMemo(() => {
    return options.requirements.reduce<Record<string, number>>((acc, row) => {
      if (selectedControlPoint && row.controlDateId === selectedControlPoint.id) {
        acc[row.materialId] = row.requiredQuantity
      }
      return acc
    }, {})
  }, [options.requirements, selectedControlPoint])

  const kardexDetailRows = useMemo<KardexDisplayRow[]>(() => {
    if (!selectedControlPoint) return []

    const query = search.trim().toLowerCase()

    return visibleMaterials
      .filter((material) => selectedMaterial === 'all' || material.id === selectedMaterial)
      .filter((material) => !query || [
        material.code,
        material.name,
        material.materialTypeLabel,
        selectedControlPoint.controlLabel,
        selectedControlPoint.controlDate,
      ].join(' ').toLowerCase().includes(query))
      .map((material) => {
        const savedInput = inputRowsByMaterial[material.id]
        if (savedInput) {
          return { ...savedInput, isRegistered: true }
        }

        const projectedConsumption = requirementByMaterial[material.id] ?? 0
        const operationalRequirement = projectedConsumption
        const pendientePorPedir = Math.max(operationalRequirement, 0)

        return {
          id: `virtual-${selectedControlPoint.id}-${material.id}`,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          materialType: material.materialType,
          materialTypeLabel: material.materialTypeLabel,
          unit: material.unit,
          controlDateId: selectedControlPoint.id,
          periodMonth: selectedControlPoint.periodMonth,
          controlDate: selectedControlPoint.controlDate,
          controlNumber: selectedControlPoint.controlNumber,
          controlLabel: selectedControlPoint.controlLabel,
          totalBodega: 0,
          pedido: 0,
          transito: 0,
          stockSeguridad: 0,
          industrializacion: 0,
          projectedConsumption,
          entregaProduccion: 0,
          operationalRequirement,
          pendientePorPedir,
          inventarioFinal: -projectedConsumption,
          availableBalance: -operationalRequirement,
          notes: null,
          isRegistered: false,
        }
      })
  }, [inputRowsByMaterial, requirementByMaterial, search, selectedControlPoint, selectedMaterial, visibleMaterials])

  const totalBodega = kardexDetailRows.reduce((sum, row) => sum + row.totalBodega, 0)
  const totalPedido = kardexDetailRows.reduce((sum, row) => sum + row.pedido, 0)
  const totalTransito = kardexDetailRows.reduce((sum, row) => sum + row.transito, 0)
  const totalStockSeguridad = kardexDetailRows.reduce((sum, row) => sum + row.stockSeguridad, 0)
  const totalIndustrializacion = kardexDetailRows.reduce((sum, row) => sum + row.industrializacion, 0)
  const totalDisponible = kardexDetailRows.reduce((sum, row) => sum + row.availableBalance, 0)
  const totalConsumoProyectado = kardexDetailRows.reduce((sum, row) => sum + row.projectedConsumption, 0)
  const totalEntregaProduccion = kardexDetailRows.reduce((sum, row) => sum + row.entregaProduccion, 0)
  const totalPendiente = kardexDetailRows.reduce((sum, row) => sum + row.pendientePorPedir, 0)
  const totalInventarioFinal = kardexDetailRows.reduce((sum, row) => sum + row.inventarioFinal, 0)
  const registeredRowsCount = kardexDetailRows.filter((row) => row.isRegistered).length

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
    setSelectedMaterial('all')
    setSelectedControlPointId('')
  }

  function openCreateInput(materialId?: string, controlDateId?: string) {
    const materialType = selectedMaterialType || (options.materialTypes[0]?.materialType ?? '')
    const firstMaterial = options.materials.find((material) => material.materialType === materialType)
    const firstControlPoint = selectedControlPoint ?? options.controlPoints.find((point) => point.materialType === materialType)

    setDrawerMode('input-create')
    setSelectedKardexInput(null)
    setKardexForm({
      ...emptyKardexInputForm,
      material_type: materialType,
      material_id: materialId ?? firstMaterial?.id ?? '',
      control_date_id: controlDateId ?? firstControlPoint?.id ?? '',
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
    const firstControlPoint = options.controlPoints.find((point) => point.materialType === materialType)

    setKardexForm({
      ...kardexForm,
      material_type: materialType,
      material_id: firstMaterial?.id ?? '',
      control_date_id: firstControlPoint?.id ?? '',
    })
  }

  const drawerMaterials = options.materials.filter((material) => material.materialType === kardexForm.material_type)
  const drawerControlPoints = options.controlPoints.filter((point) => point.materialType === kardexForm.material_type)

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
        <select className="filter-select" value={selectedControlPoint?.id ?? ''} onChange={(event) => setSelectedControlPointId(event.target.value)} disabled={!visibleControlPoints.length}>
          <option value="">Selecciona control...</option>
          {visibleControlPoints.map((point) => (
            <option key={point.id} value={point.id}>Control {point.controlNumber} · {formatDate(point.controlDate)}</option>
          ))}
        </select>
        <select className="filter-select" value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)}>
          <option value="all">Todos los materiales del tipo</option>
          {visibleMaterials.map((material) => (
            <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="Buscar material, fecha o fecha de control..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadKardex()}>Recargar</button>
        <button className="btn btn-primary" type="button" onClick={() => openCreateInput()}>+ Input Kardex</button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <div className="planning-note">
        <strong>Fechas desde GANTT:</strong> aquí no se crean fechas. El Kardex toma las fechas de control configuradas en GANTT y los aplica a todos los materiales del tipo seleccionado.
      </div>

      <div className="kardex-control-summary">
        <div className="summary-item">
          <span>Tipo</span>
          <strong>{selectedTypeOption?.label ?? 'Sin tipo seleccionado'}</strong>
        </div>
        <div className="summary-item">
          <span>Control</span>
          <strong>{selectedControlPoint ? `Control ${selectedControlPoint.controlNumber}` : 'Sin control'}</strong>
        </div>
        <div className="summary-item">
          <span>Fecha</span>
          <strong>{selectedControlPoint ? formatDate(selectedControlPoint.controlDate) : '-'}</strong>
        </div>
        <div className="summary-item">
          <span>Materiales cubiertos</span>
          <strong>{kardexDetailRows.length} materiales</strong>
        </div>
        <div className="summary-item">
          <span>Registros Kardex</span>
          <strong>{registeredRowsCount}/{kardexDetailRows.length}</strong>
        </div>
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Total bodega" value={formatNumber(totalBodega, 2)} sub="materiales filtrados" />
        <KpiCard label="Consumo proyectado" value={formatNumber(totalConsumoProyectado, 2)} sub="desde BOM + control" />
        <KpiCard label="Tránsito" value={formatNumber(totalTransito, 2)} sub="suma del tipo" />
        <KpiCard label="Pendiente por pedir" value={formatNumber(totalPendiente, 2)} sub="faltante operativo" />
      </div>

      <TableShell title="Resumen Kardex del tipo" subtitle="Suma de todos los materiales cubiertos por la fecha de control seleccionada">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Control</th>
              <th>Fecha control</th>
              <th>Total bodega</th>
              <th>Pedido</th>
              <th>Tránsito</th>
              <th>Stock seguridad</th>
              <th>Industrialización</th>
              <th>Consumo proyectado</th>
              <th>Entrega producción</th>
              <th>Pendiente por pedir</th>
              <th>Inventario final</th>
              <th>Balance disponible</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={14}>Cargando Kardex...</td></tr>
            ) : !selectedControlPoint ? (
              <tr><td colSpan={14}>Selecciona un tipo de material con fecha de control disponible.</td></tr>
            ) : (
              <tr className="kardex-total-row">
                <td>{selectedTypeOption?.label ?? selectedMaterialType}</td>
                <td>Control {selectedControlPoint.controlNumber} · {selectedControlPoint.controlLabel}</td>
                <td>{formatDate(selectedControlPoint.controlDate)}</td>
                <td>{formatQuantity(totalBodega, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalPedido, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalTransito, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalStockSeguridad, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalIndustrializacion, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalConsumoProyectado, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalEntregaProduccion, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalPendiente, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalInventarioFinal, selectedTypeOption?.unit ?? '')}</td>
                <td>{formatQuantity(totalDisponible, selectedTypeOption?.unit ?? '')}</td>
                <td><Badge>{registeredRowsCount === 0 ? 'Sin registrar' : totalDisponible < 0 ? 'Faltante' : 'Activo'}</Badge></td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Detalle Kardex por material" subtitle="Todos los materiales del tipo seleccionado comparten la misma fecha de control">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Tipo</th>
              <th>Control</th>
              <th>Fecha control</th>
              <th>Total bodega</th>
              <th>Pedido</th>
              <th>Tránsito</th>
              <th>Stock seguridad</th>
              <th>Industrialización</th>
              <th>Consumo proyectado</th>
              <th>Entrega producción</th>
              <th>Pendiente por pedir</th>
              <th>Inventario final</th>
              <th>Balance disponible</th>
              <th>Notas</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={17}>Cargando Kardex...</td></tr>
            ) : !selectedControlPoint ? (
              <tr><td colSpan={17}>No hay fecha de control para el tipo seleccionado. Créala primero en GANTT.</td></tr>
            ) : kardexDetailRows.length === 0 ? (
              <tr><td colSpan={17}>No hay materiales para el tipo y filtros seleccionados.</td></tr>
            ) : kardexDetailRows.map((row) => (
              <tr key={row.id}>
                <td>{row.materialCode} · {row.materialName}</td>
                <td>{row.materialTypeLabel}</td>
                <td>Control {row.controlNumber}</td>
                <td>{formatDate(row.controlDate)}</td>
                <td>{formatQuantity(row.totalBodega, row.unit)}</td>
                <td>{formatQuantity(row.pedido, row.unit)}</td>
                <td>{formatQuantity(row.transito, row.unit)}</td>
                <td>{formatQuantity(row.stockSeguridad, row.unit)}</td>
                <td>{formatQuantity(row.industrializacion, row.unit)}</td>
                <td>{formatQuantity(row.projectedConsumption, row.unit)}</td>
                <td>{formatQuantity(row.entregaProduccion, row.unit)}</td>
                <td>{formatQuantity(row.pendientePorPedir, row.unit)}</td>
                <td>{formatQuantity(row.inventarioFinal, row.unit)}</td>
                <td>{formatQuantity(row.availableBalance, row.unit)}</td>
                <td>{row.notes ?? '-'}</td>
                <td><Badge>{row.isRegistered ? (row.availableBalance < 0 ? 'Faltante' : 'Activo') : 'Sin registrar'}</Badge></td>
                <td>
                  {row.isRegistered ? (
                    <button className="action-btn" type="button" onClick={() => openEditInput(row)}>Editar</button>
                  ) : (
                    <button className="action-btn" type="button" onClick={() => openCreateInput(row.materialId, row.controlDateId)}>Registrar</button>
                  )}
                </td>
              </tr>
            ))}
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
            <select className="form-control" value={kardexForm.material_id} onChange={(event) => setKardexForm({ ...kardexForm, material_id: event.target.value })}>
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
                  {formatDateMonth(point.periodMonth)} · Corte {point.controlNumber} · {formatDate(point.controlDate)} · {point.controlLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total bodega</label>
              <input className="form-control" type="number" step="0.0001" value={kardexForm.total_bodega} onChange={(event) => setKardexForm({ ...kardexForm, total_bodega: event.target.value })} />
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
