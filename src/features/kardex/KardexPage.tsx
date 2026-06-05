import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { KpiCard } from '../../components/KpiCard'
import { TableShell } from '../../components/TableShell'
import { formatDate, formatDateMonth, formatNumber, formatQuantity } from '../../utils/format'
import {
  createControlDate,
  createKardexInput,
  getKardexOptions,
  listControlDates,
  listKardexInputs,
  toMonthInputValue,
  updateControlDate,
  updateKardexInput,
} from './kardexService'
import type {
  ControlDateFormInput,
  ControlDateRecordForAudit,
  KardexInputFormInput,
  KardexInputRecordForAudit,
  KardexInputView,
  KardexOptions,
  MaterialControlDateView,
} from './kardexTypes'

type DrawerMode = 'control-create' | 'control-edit' | 'input-create' | 'input-edit' | null

const emptyControlDateForm: ControlDateFormInput = {
  material_id: '',
  period_month: '',
  control_date: '',
  sequence_number: '1',
}

const emptyKardexInputForm: KardexInputFormInput = {
  material_id: '',
  control_date_id: '',
  total_bodega: '0',
  pedido: '0',
  transito: '0',
  stock_seguridad: '0',
  industrializacion: '0',
  notes: '',
}

function controlDateToForm(row: MaterialControlDateView): ControlDateFormInput {
  return {
    material_id: row.materialId,
    period_month: toMonthInputValue(row.periodMonth),
    control_date: row.controlDate,
    sequence_number: String(row.sequenceNumber),
  }
}

function controlDateAuditRecord(row: MaterialControlDateView): ControlDateRecordForAudit {
  return {
    id: row.id,
    material_id: row.materialId,
    period_month: row.periodMonth,
    control_date: row.controlDate,
    sequence_number: row.sequenceNumber,
  }
}

function kardexToForm(row: KardexInputView): KardexInputFormInput {
  return {
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
    control_date_id: row.controlDateId,
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
  const [controlDates, setControlDates] = useState<MaterialControlDateView[]>([])
  const [options, setOptions] = useState<KardexOptions>({
    materials: [],
    controlDates: [],
  })
  const [search, setSearch] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedControlDate, setSelectedControlDate] = useState<MaterialControlDateView | null>(null)
  const [selectedKardexInput, setSelectedKardexInput] = useState<KardexInputView | null>(null)
  const [controlDateForm, setControlDateForm] = useState<ControlDateFormInput>(emptyControlDateForm)
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
      const [inputRows, controlDateRows, kardexOptions] = await Promise.all([
        listKardexInputs(),
        listControlDates(),
        getKardexOptions(),
      ])

      setRows(inputRows)
      setControlDates(controlDateRows)
      setOptions({
        ...kardexOptions,
        controlDates: controlDateRows,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el Kardex.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadKardex()
  }, [])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows

    return rows.filter((row) =>
      [
        row.materialCode,
        row.materialName,
        row.periodMonth,
        row.controlDate,
        row.notes ?? '',
      ].join(' ').toLowerCase().includes(query),
    )
  }, [rows, search])

  const filteredControlDates = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return controlDates

    return controlDates.filter((row) =>
      [
        row.materialCode,
        row.materialName,
        row.periodMonth,
        row.controlDate,
        row.sequenceNumber,
      ].join(' ').toLowerCase().includes(query),
    )
  }, [controlDates, search])

  const controlDatesForSelectedMaterial = useMemo(() => {
    if (!kardexForm.material_id) return options.controlDates

    return options.controlDates.filter((row) => row.materialId === kardexForm.material_id)
  }, [kardexForm.material_id, options.controlDates])

  const availableBalancePreview = useMemo(() => {
    return (
      Number(kardexForm.total_bodega || 0)
      + Number(kardexForm.pedido || 0)
      + Number(kardexForm.transito || 0)
      - Number(kardexForm.stock_seguridad || 0)
      - Number(kardexForm.industrializacion || 0)
    )
  }, [kardexForm])

  const totalBodega = filteredRows.reduce((sum, row) => sum + row.totalBodega, 0)
  const totalPedido = filteredRows.reduce((sum, row) => sum + row.pedido, 0)
  const totalTransito = filteredRows.reduce((sum, row) => sum + row.transito, 0)
  const totalDisponible = filteredRows.reduce((sum, row) => sum + row.availableBalance, 0)

  function openCreateControlDate() {
    setDrawerMode('control-create')
    setSelectedControlDate(null)
    setControlDateForm({
      ...emptyControlDateForm,
      material_id: options.materials[0]?.id ?? '',
    })
    setReason('Creación de fecha de control Kardex')
    setError(null)
    setFeedback(null)
  }

  function openEditControlDate(row: MaterialControlDateView) {
    setDrawerMode('control-edit')
    setSelectedControlDate(row)
    setControlDateForm(controlDateToForm(row))
    setReason('Actualización de fecha de control Kardex')
    setError(null)
    setFeedback(null)
  }

  function openCreateInput(controlDate?: MaterialControlDateView) {
    setDrawerMode('input-create')
    setSelectedKardexInput(null)
    setKardexForm({
      ...emptyKardexInputForm,
      material_id: controlDate?.materialId ?? options.materials[0]?.id ?? '',
      control_date_id: controlDate?.id ?? '',
    })
    setReason('Registro de input Kardex')
    setError(null)
    setFeedback(null)
  }

  function openEditInput(row: KardexInputView) {
    setDrawerMode('input-edit')
    setSelectedKardexInput(row)
    setKardexForm(kardexToForm(row))
    setReason('Actualización de input Kardex')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedControlDate(null)
    setSelectedKardexInput(null)
    setError(null)
    setFeedback(null)
  }

  async function handleControlDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateControlDateForm(controlDateForm)

      if (!reason.trim()) {
        throw new Error('El motivo de auditoría es obligatorio.')
      }

      if (drawerMode === 'control-edit' && selectedControlDate) {
        await updateControlDate(selectedControlDate.id, controlDateAuditRecord(selectedControlDate), controlDateForm, reason)
        setFeedback('Fecha de control actualizada correctamente.')
      } else {
        await createControlDate(controlDateForm, reason)
        setFeedback('Fecha de control creada correctamente.')
      }

      await loadKardex()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la fecha de control.')
    } finally {
      setIsSaving(false)
    }
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

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Kardex real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{filteredControlDates.length} fechas</button>
        <button className="filter-chip" type="button">{filteredRows.length} inputs</button>
        <input
          className="search-input"
          placeholder="Buscar material o fecha..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadKardex()}>
          Recargar
        </button>
        <button className="btn btn-primary" type="button" onClick={openCreateControlDate}>
          + Fecha control
        </button>
        <button className="btn btn-primary" type="button" onClick={() => openCreateInput()}>
          + Input Kardex
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <div className="kpi-row compact">
        <KpiCard label="Total bodega" value={formatNumber(totalBodega, 2)} sub="inputs filtrados" />
        <KpiCard label="Pedido" value={formatNumber(totalPedido, 2)} sub="ordenado / pedido" />
        <KpiCard label="Tránsito" value={formatNumber(totalTransito, 2)} sub="en camino" />
        <KpiCard label="Balance disponible" value={formatNumber(totalDisponible, 2)} sub="bodega + pedido + tránsito - reservas" />
      </div>

      <TableShell title="Inputs Kardex por fecha de control" subtitle="Registro operativo por material y corte semanal">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Fecha control</th>
              <th>Secuencia</th>
              <th>Material</th>
              <th>Total bodega</th>
              <th>Pedido</th>
              <th>Tránsito</th>
              <th>Stock seguridad</th>
              <th>Industrialización</th>
              <th>Balance disponible</th>
              <th>Notas</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={13}>Cargando Kardex...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={13}>No hay registros de Kardex. Primero crea fechas de control y luego carga inputs.</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{formatDateMonth(row.periodMonth)}</td>
                <td>{formatDate(row.controlDate)}</td>
                <td>{row.sequenceNumber}</td>
                <td>{row.materialName}</td>
                <td>{formatQuantity(row.totalBodega, row.unit)}</td>
                <td>{formatQuantity(row.pedido, row.unit)}</td>
                <td>{formatQuantity(row.transito, row.unit)}</td>
                <td>{formatQuantity(row.stockSeguridad, row.unit)}</td>
                <td>{formatQuantity(row.industrializacion, row.unit)}</td>
                <td>{formatQuantity(row.availableBalance, row.unit)}</td>
                <td>{row.notes ?? 'Sin notas'}</td>
                <td><Badge>{row.availableBalance < 0 ? 'Crítico' : 'Calculado'}</Badge></td>
                <td><button className="action-btn" type="button" onClick={() => openEditInput(row)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Fechas de control por material" subtitle="Cada material puede tener hasta cuatro o más cortes por mes según operación">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Mes</th>
              <th>Fecha control</th>
              <th>Secuencia</th>
              <th>Unidad</th>
              <th>Input</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7}>Cargando fechas de control...</td></tr>
            ) : filteredControlDates.length === 0 ? (
              <tr><td colSpan={7}>No hay fechas de control registradas.</td></tr>
            ) : filteredControlDates.map((row) => {
              const hasInput = rows.some((input) => input.controlDateId === row.id)

              return (
                <tr key={row.id}>
                  <td>{row.materialName}</td>
                  <td>{formatDateMonth(row.periodMonth)}</td>
                  <td>{formatDate(row.controlDate)}</td>
                  <td>{row.sequenceNumber}</td>
                  <td>{row.unit}</td>
                  <td><Badge>{hasInput ? 'Activo' : 'Atención'}</Badge></td>
                  <td>
                    <div className="inline-actions">
                      <button className="action-btn" type="button" onClick={() => openEditControlDate(row)}>Editar fecha</button>
                      <button className="action-btn" type="button" onClick={() => openCreateInput(row)}>Cargar input</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableShell>

      <Drawer
        isOpen={drawerMode === 'control-create' || drawerMode === 'control-edit'}
        title={drawerMode === 'control-edit' ? 'Editar fecha de control' : 'Nueva fecha de control'}
        subtitle="Define los cortes operativos por material"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="control-date-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar fecha'}
            </button>
          </>
        }
      >
        <form id="control-date-form" className="drawer-form" onSubmit={handleControlDateSubmit}>
          <div className="form-group">
            <label>Material</label>
            <select className="form-control" value={controlDateForm.material_id} onChange={(event) => setControlDateForm({ ...controlDateForm, material_id: event.target.value })}>
              <option value="">Selecciona...</option>
              {options.materials.map((material) => (
                <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Mes</label>
              <input className="form-control" type="month" value={controlDateForm.period_month} onChange={(event) => setControlDateForm({ ...controlDateForm, period_month: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Fecha de control</label>
              <input className="form-control" type="date" value={controlDateForm.control_date} onChange={(event) => setControlDateForm({ ...controlDateForm, control_date: event.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Secuencia del corte</label>
            <input className="form-control" type="number" min="1" step="1" value={controlDateForm.sequence_number} onChange={(event) => setControlDateForm({ ...controlDateForm, sequence_number: event.target.value })} placeholder="1, 2, 3, 4..." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica esta fecha de control." />
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={drawerMode === 'input-create' || drawerMode === 'input-edit'}
        title={drawerMode === 'input-edit' ? 'Editar input Kardex' : 'Nuevo input Kardex'}
        subtitle="Carga los saldos y reservas del corte"
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
            <label>Material</label>
            <select
              className="form-control"
              value={kardexForm.material_id}
              onChange={(event) => setKardexForm({ ...kardexForm, material_id: event.target.value, control_date_id: '' })}
            >
              <option value="">Selecciona...</option>
              {options.materials.map((material) => (
                <option key={material.id} value={material.id}>{material.code} · {material.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha de control</label>
            <select className="form-control" value={kardexForm.control_date_id} onChange={(event) => setKardexForm({ ...kardexForm, control_date_id: event.target.value })}>
              <option value="">Selecciona...</option>
              {controlDatesForSelectedMaterial.map((controlDate) => (
                <option key={controlDate.id} value={controlDate.id}>
                  {formatDateMonth(controlDate.periodMonth)} · Corte {controlDate.sequenceNumber} · {formatDate(controlDate.controlDate)}
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
              <span>Fórmula</span>
              <strong>Bodega + Pedido + Tránsito - Seguridad - Industrialización</strong>
            </div>
            <div className="impact-row">
              <span>Resultado</span>
              <strong>{formatNumber(availableBalancePreview, 2)}</strong>
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

function validateControlDateForm(form: ControlDateFormInput) {
  if (!form.material_id) {
    throw new Error('El material es obligatorio.')
  }

  if (!form.period_month) {
    throw new Error('El mes es obligatorio.')
  }

  if (!form.control_date) {
    throw new Error('La fecha de control es obligatoria.')
  }

  const sequence = Number(form.sequence_number)

  if (Number.isNaN(sequence) || sequence < 1) {
    throw new Error('La secuencia debe ser un número mayor o igual a 1.')
  }
}

function validateKardexForm(form: KardexInputFormInput) {
  if (!form.material_id || !form.control_date_id) {
    throw new Error('Material y fecha de control son obligatorios.')
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
  }
}
