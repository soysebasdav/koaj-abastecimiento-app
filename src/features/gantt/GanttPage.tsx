import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { KpiCard } from '../../components/KpiCard'
import { formatDate, formatDateMonth, formatNumber, formatQuantity } from '../../utils/format'
import {
  createControlDate,
  createProcessDate,
  getGanttOptions,
  toMonthInputValue,
  updateControlDate,
  updateProcessDate,
} from './ganttService'
import type {
  ControlDateFormInput,
  ControlDateRecordForAudit,
  GanttOptions,
  MaterialTypeControlDate,
  MaterialTypeProcessDate,
  ProcessDateFormInput,
  ProcessDateRecordForAudit,
} from './ganttTypes'

type DrawerMode = 'control-create' | 'control-edit' | 'process-create' | 'process-edit' | null

const CONTROL_NUMBERS = [1, 2, 3, 4, 5]
const MAX_CONTROLS_PER_MONTH = CONTROL_NUMBERS.length

const emptyControlForm: ControlDateFormInput = {
  material_type: '',
  period_month: '',
  control_number: '1',
  control_date: '',
  label: 'Fecha de control',
  status: 'planned',
  notes: '',
}

const emptyProcessForm: ProcessDateFormInput = {
  material_type: '',
  period_month: '',
  process_name: '',
  process_date: '',
  sequence_order: '1',
  status: 'planned',
  notes: '',
}

function controlToForm(row: MaterialTypeControlDate): ControlDateFormInput {
  return {
    material_type: row.materialType,
    period_month: toMonthInputValue(row.periodMonth),
    control_number: String(row.controlNumber),
    control_date: row.controlDate,
    label: row.label,
    status: row.status,
    notes: row.notes ?? '',
  }
}

function processToForm(row: MaterialTypeProcessDate): ProcessDateFormInput {
  return {
    material_type: row.materialType,
    period_month: toMonthInputValue(row.periodMonth),
    process_name: row.processName,
    process_date: row.processDate,
    sequence_order: String(row.sequenceOrder),
    status: row.status,
    notes: row.notes ?? '',
  }
}

function controlAuditRecord(row: MaterialTypeControlDate): ControlDateRecordForAudit {
  return {
    id: row.id,
    material_type: row.materialType,
    period_month: row.periodMonth,
    control_number: row.controlNumber,
    control_date: row.controlDate,
    label: row.label,
    status: row.status,
    notes: row.notes,
  }
}

function processAuditRecord(row: MaterialTypeProcessDate): ProcessDateRecordForAudit {
  return {
    id: row.id,
    material_type: row.materialType,
    period_month: row.periodMonth,
    process_name: row.processName,
    process_date: row.processDate,
    sequence_order: row.sequenceOrder,
    status: row.status,
    notes: row.notes,
  }
}

export function GanttPage() {
  const [options, setOptions] = useState<GanttOptions>({
    materialTypes: [],
    materials: [],
    controlDates: [],
    processDates: [],
    fitStarts: [],
  })
  const [selectedMaterialType, setSelectedMaterialType] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [search, setSearch] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedControlDate, setSelectedControlDate] = useState<MaterialTypeControlDate | null>(null)
  const [selectedProcessDate, setSelectedProcessDate] = useState<MaterialTypeProcessDate | null>(null)
  const [controlForm, setControlForm] = useState<ControlDateFormInput>(emptyControlForm)
  const [processForm, setProcessForm] = useState<ProcessDateFormInput>(emptyProcessForm)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function loadGantt() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await getGanttOptions()
      setOptions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el GANTT de materiales.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadGantt()
  }, [])

  const selectedTypeOption = options.materialTypes.find((type) => type.materialType === selectedMaterialType)
  const hasSelectedType = selectedMaterialType !== 'all'
  const query = search.trim().toLowerCase()

  const monthOptions = useMemo(() => {
    return Array.from(new Set([
      ...options.controlDates.map((point) => point.periodMonth),
      ...options.processDates.map((point) => point.periodMonth),
    ]))
      .filter(Boolean)
      .sort()
  }, [options.controlDates, options.processDates])

  const visibleControlDates = useMemo(() => {
    return options.controlDates.filter((point) => {
      const matchesType = selectedMaterialType === 'all' || point.materialType === selectedMaterialType
      const matchesMonth = selectedMonth === 'all' || point.periodMonth === selectedMonth
      const matchesSearch = !query || [
        point.materialTypeLabel,
        point.label,
        point.controlNumber,
        point.notes ?? '',
      ].join(' ').toLowerCase().includes(query)

      return matchesType && matchesMonth && matchesSearch
    })
  }, [options.controlDates, query, selectedMaterialType, selectedMonth])

  const visibleProcessDates = useMemo(() => {
    return options.processDates.filter((point) => {
      const matchesType = selectedMaterialType === 'all' || point.materialType === selectedMaterialType
      const matchesMonth = selectedMonth === 'all' || point.periodMonth === selectedMonth
      const matchesSearch = !query || [
        point.materialTypeLabel,
        point.processName,
        point.notes ?? '',
      ].join(' ').toLowerCase().includes(query)

      return matchesType && matchesMonth && matchesSearch
    })
  }, [options.processDates, query, selectedMaterialType, selectedMonth])

  const visibleMaterials = useMemo(() => {
    return options.materials.filter((material) => {
      const matchesType = selectedMaterialType === 'all' || material.materialType === selectedMaterialType
      const matchesSearch = !query || [
        material.code,
        material.name,
        material.materialTypeLabel,
      ].join(' ').toLowerCase().includes(query)

      return matchesType && matchesSearch
    })
  }, [options.materials, query, selectedMaterialType])

  const visibleFitStarts = useMemo(() => {
    return options.fitStarts.filter((row) => {
      const matchesType = selectedMaterialType === 'all' || row.materialType === selectedMaterialType
      const matchesSearch = !query || [
        row.materialCode,
        row.materialName,
        row.materialTypeLabel,
        row.fitCodes.join(' '),
      ].join(' ').toLowerCase().includes(query)

      return matchesType && matchesSearch
    })
  }, [options.fitStarts, query, selectedMaterialType])

  const controlDatesByMonth = useMemo(() => groupByMonth(visibleControlDates), [visibleControlDates])
  const processDatesByMonth = useMemo(() => groupByMonth(visibleProcessDates), [visibleProcessDates])

  const selectedTypeControlCount = hasSelectedType ? visibleControlDates.filter((point) => point.status !== 'cancelled').length : 0
  const selectedTypeProcessCount = hasSelectedType ? visibleProcessDates.filter((point) => point.status !== 'cancelled').length : 0
  const delayedCount = [...visibleControlDates, ...visibleProcessDates].filter((point) => point.status === 'delayed').length
  const relatedFitCount = new Set(visibleFitStarts.flatMap((row) => row.fitCodes)).size

  function currentMaterialType() {
    if (selectedMaterialType !== 'all') return selectedMaterialType
    return options.materialTypes[0]?.materialType ?? ''
  }

  function getUsedControlNumbers(materialType: string, monthInput: string, excludeId?: string) {
    const periodMonth = monthInput ? `${monthInput}-01` : ''
    if (!materialType || !periodMonth) return [] as number[]

    return options.controlDates
      .filter((point) => point.materialType === materialType
        && point.periodMonth === periodMonth
        && point.status !== 'cancelled'
        && point.id !== excludeId)
      .map((point) => point.controlNumber)
      .sort((a, b) => a - b)
  }

  function firstAvailableControlNumber(materialType: string, monthInput: string, excludeId?: string) {
    const used = new Set(getUsedControlNumbers(materialType, monthInput, excludeId))
    for (const num of CONTROL_NUMBERS) {
      if (!used.has(num)) return String(num)
    }
    return ''
  }

  const usedControlNumbers = useMemo(() => {
    return getUsedControlNumbers(controlForm.material_type, controlForm.period_month, selectedControlDate?.id)
  }, [controlForm.material_type, controlForm.period_month, options.controlDates, selectedControlDate?.id])

  const assignedControlDatesForEdit = useMemo(() => {
    if (drawerMode !== 'control-edit' || !selectedControlDate) return [] as MaterialTypeControlDate[]

    return options.controlDates
      .filter((point) => point.materialType === selectedControlDate.materialType
        && point.periodMonth === selectedControlDate.periodMonth
        && point.status !== 'cancelled')
      .sort((a, b) => a.controlNumber - b.controlNumber)
  }, [drawerMode, options.controlDates, selectedControlDate])

  function openCreateControl(materialType = currentMaterialType()) {
    const month = selectedMonth !== 'all' ? toMonthInputValue(selectedMonth) : ''
    const nextNumber = firstAvailableControlNumber(materialType, month)

    setDrawerMode('control-create')
    setSelectedControlDate(null)
    setSelectedProcessDate(null)
    setControlForm({
      ...emptyControlForm,
      material_type: materialType,
      period_month: month,
      control_number: nextNumber,
      label: nextNumber ? `Control ${nextNumber}` : 'Fecha de control',
    })
    setReason('Creación de fecha de control Kardex por tipo de material')
    setError(null)
    setFeedback(null)
  }

  function openEditControl(row: MaterialTypeControlDate) {
    setDrawerMode('control-edit')
    setSelectedControlDate(row)
    setSelectedProcessDate(null)
    setControlForm(controlToForm(row))
    setReason('Actualización de fecha de control Kardex')
    setError(null)
    setFeedback(null)
  }

  function openCreateProcess(materialType = currentMaterialType()) {
    const month = selectedMonth !== 'all' ? toMonthInputValue(selectedMonth) : ''
    const existingProcesses = options.processDates.filter((point) => point.materialType === materialType && (!month || toMonthInputValue(point.periodMonth) === month))

    setDrawerMode('process-create')
    setSelectedControlDate(null)
    setSelectedProcessDate(null)
    setProcessForm({
      ...emptyProcessForm,
      material_type: materialType,
      period_month: month,
      sequence_order: String(existingProcesses.length + 1),
    })
    setReason('Creación de fecha de proceso visual por tipo de material')
    setError(null)
    setFeedback(null)
  }

  function openEditProcess(row: MaterialTypeProcessDate) {
    setDrawerMode('process-edit')
    setSelectedProcessDate(row)
    setSelectedControlDate(null)
    setProcessForm(processToForm(row))
    setReason('Actualización de fecha de proceso visual')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedControlDate(null)
    setSelectedProcessDate(null)
    setError(null)
  }

  function handleControlMonthChange(monthInput: string) {
    const nextControl = firstAvailableControlNumber(controlForm.material_type, monthInput, selectedControlDate?.id)
    setControlForm((current) => ({
      ...current,
      period_month: monthInput,
      control_number: nextControl,
      label: nextControl ? `Control ${nextControl}` : 'Fecha de control',
    }))
  }

  function handleControlTypeChange(materialType: string) {
    const nextControl = firstAvailableControlNumber(materialType, controlForm.period_month, selectedControlDate?.id)
    setControlForm((current) => ({
      ...current,
      material_type: materialType,
      control_number: nextControl,
      label: nextControl ? `Control ${nextControl}` : 'Fecha de control',
    }))
  }

  function handleControlNumberSelect(controlNumber: string) {
    setControlForm((current) => ({
      ...current,
      control_number: controlNumber,
      label: `Control ${controlNumber}`,
    }))
  }

  function handleProcessDateChange(value: string) {
    setProcessForm((current) => ({
      ...current,
      process_date: value,
      period_month: value ? value.slice(0, 7) : '',
    }))
  }

  async function handleControlSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateControlForm(controlForm)
      if (!reason.trim()) throw new Error('El motivo de auditoría es obligatorio.')

      if (drawerMode === 'control-edit' && selectedControlDate) {
        await updateControlDate(selectedControlDate.id, controlAuditRecord(selectedControlDate), controlForm, reason)
        setFeedback('Fecha de control actualizada correctamente.')
      } else {
        await createControlDate(controlForm, reason)
        setFeedback('Fecha de control creada correctamente.')
      }

      await loadGantt()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la fecha de control.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleProcessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateProcessForm(processForm)
      if (!reason.trim()) throw new Error('El motivo de auditoría es obligatorio.')

      if (drawerMode === 'process-edit' && selectedProcessDate) {
        await updateProcessDate(selectedProcessDate.id, processAuditRecord(selectedProcessDate), processForm, reason)
        setFeedback('Fecha de proceso actualizada correctamente.')
      } else {
        await createProcessDate(processForm, reason)
        setFeedback('Fecha de proceso creada correctamente.')
      }

      await loadGantt()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la fecha de proceso.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="filter-bar smart-filter">
        <span className="filter-label">GANTT materiales</span>
        <select className="filter-select" value={selectedMaterialType} onChange={(event) => setSelectedMaterialType(event.target.value)}>
          <option value="all">Selecciona tipo de material</option>
          {options.materialTypes.map((type) => (
            <option key={type.materialType} value={type.materialType}>{type.label} · {type.materialCount} materiales</option>
          ))}
        </select>
        <select className="filter-select" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
          <option value="all">Todos los meses</option>
          {monthOptions.map((month) => (
            <option key={month} value={month}>{formatDateMonth(month)}</option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder={hasSelectedType ? 'Buscar control, proceso, material o FIT...' : 'Buscar tipo de material...'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadGantt()}>Recargar</button>
        <button className="btn btn-primary" type="button" onClick={() => openCreateControl()} disabled={!options.materialTypes.length}>+ Fecha control</button>
        <button className="btn btn-secondary" type="button" onClick={() => openCreateProcess()} disabled={!options.materialTypes.length}>+ Fecha proceso</button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <div className="planning-note">
        <strong>Regla operativa:</strong> el GANTT se programa por <strong>tipo de material</strong>. Las fechas de control alimentan Kardex; las fechas de proceso como lavandería, pintado o ensamble solo son programación visual.
      </div>

      {!hasSelectedType ? (
        <section className="visual-section">
          <div className="visual-bom-head">
            <div>
              <h3>Tipos de material guardados</h3>
              <p>Selecciona un tipo para programar sus 5 fechas de control Kardex y sus procesos operativos.</p>
            </div>
          </div>
          <div className="visual-card-grid material-grid">
            {options.materialTypes
              .filter((type) => !query || [type.label, type.materialType, type.sampleMaterials.join(' ')].join(' ').toLowerCase().includes(query))
              .map((type) => (
                <button className="visual-card selectable-card" key={type.materialType} type="button" onClick={() => setSelectedMaterialType(type.materialType)}>
                  <div className="visual-eyebrow">{type.unit || 'unidad no definida'}</div>
                  <h3>{type.label}</h3>
                  <p>{type.materialCount} materiales asociados</p>
                  <div className="visual-card-metrics stacked">
                    <span>Control Kardex: {options.controlDates.filter((point) => point.materialType === type.materialType && point.status !== 'cancelled').length} fechas</span>
                    <span>Procesos GANTT: {options.processDates.filter((point) => point.materialType === type.materialType && point.status !== 'cancelled').length} eventos</span>
                    <span>{type.sampleMaterials.join(', ') || 'Sin ejemplos'}</span>
                  </div>
                </button>
              ))}
          </div>
        </section>
      ) : (
        <>
          <div className="kpi-row compact">
            <KpiCard label="Tipo seleccionado" value={selectedTypeOption?.label ?? selectedMaterialType} sub={`${visibleMaterials.length} materiales`} />
            <KpiCard label="Fechas control" value={formatNumber(selectedTypeControlCount, 0)} sub="máximo 5 por mes" />
            <KpiCard label="Procesos visuales" value={formatNumber(selectedTypeProcessCount, 0)} sub="no entran al Kardex" />
            <KpiCard label="FITs relacionados" value={formatNumber(relatedFitCount, 0)} sub="desde BOM/proyección" />
          </div>

          <section className="gantt-board">
            <div className="gantt-month">
              <div className="gantt-month-head">
                <div>
                  <h3>Fechas de control Kardex</h3>
                  <p>Estas son las únicas fechas que entran en tráfico/Kardex para todos los materiales tipo {selectedTypeOption?.label ?? selectedMaterialType}.</p>
                </div>
                <button className="action-btn" type="button" onClick={() => openCreateControl(selectedMaterialType)}>Agregar control</button>
              </div>

              {isLoading ? (
                <div className="empty-state">Cargando fechas de control...</div>
              ) : controlDatesByMonth.length === 0 ? (
                <div className="empty-state">No hay fechas de control para el tipo y filtros seleccionados.</div>
              ) : controlDatesByMonth.map(({ month, rows }) => (
                <div className="gantt-lane" key={`control-${month}`}>
                  <div className="gantt-lane-label">
                    <strong>{formatDateMonth(month)}</strong>
                    <span>{rows.length}/5 controles</span>
                  </div>
                  <div className="gantt-items">
                    {rows.map((point) => (
                      <button className={`gantt-item ${point.status}`} key={point.id} type="button" onClick={() => openEditControl(point)}>
                        <div className="gantt-item-date">{formatDate(point.controlDate)}</div>
                        <div className="gantt-item-title">Control {point.controlNumber} · {point.label}</div>
                        <div className="gantt-item-meta">
                          <span>Kardex / tráfico</span>
                          <Badge>kardex</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="gantt-month">
              <div className="gantt-month-head">
                <div>
                  <h3>Fechas de proceso del tipo</h3>
                  <p>Lavandería, pintado, ensamble u otros procesos. Son visibles en GANTT, pero no alimentan Kardex.</p>
                </div>
                <button className="action-btn" type="button" onClick={() => openCreateProcess(selectedMaterialType)}>Agregar proceso</button>
              </div>

              {processDatesByMonth.length === 0 ? (
                <div className="empty-state">No hay procesos adicionales para el tipo y filtros seleccionados.</div>
              ) : processDatesByMonth.map(({ month, rows }) => (
                <div className="gantt-lane" key={`process-${month}`}>
                  <div className="gantt-lane-label">
                    <strong>{formatDateMonth(month)}</strong>
                    <span>{rows.length} procesos</span>
                  </div>
                  <div className="gantt-items">
                    {rows.map((point) => (
                      <button className={`gantt-item ${point.status}`} key={point.id} type="button" onClick={() => openEditProcess(point)}>
                        <div className="gantt-item-date">{formatDate(point.processDate)}</div>
                        <div className="gantt-item-title">{point.processName}</div>
                        <div className="gantt-item-meta">
                          <span>orden {point.sequenceOrder}</span>
                          <Badge>solo GANTT</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="fit-start-panel">
            <div className="visual-bom-head">
              <div>
                <h3>Materiales incluidos en {selectedTypeOption?.label ?? selectedMaterialType}</h3>
                <p>Estos materiales heredan las fechas de control del tipo seleccionado.</p>
              </div>
            </div>
            <div className="fit-start-grid">
              {visibleMaterials.length === 0 ? (
                <div className="empty-state">No hay materiales activos para este tipo.</div>
              ) : visibleMaterials.slice(0, 12).map((material) => (
                <div className="fit-start-card" key={material.id}>
                  <div className="visual-eyebrow">{material.materialTypeLabel} · {material.unit}</div>
                  <h3>{material.name}</h3>
                  <p>{material.code}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="fit-start-panel">
            <div className="visual-bom-head">
              <div>
                <h3>Inicio de consumo desde FIT</h3>
                <p>Referencia de cuándo empieza a verse un material porque un FIT proyectado lo utiliza en BOM.</p>
              </div>
            </div>
            <div className="fit-start-grid">
              {visibleFitStarts.length === 0 ? (
                <div className="empty-state">No hay consumos iniciales calculados desde BOM/proyección.</div>
              ) : visibleFitStarts.slice(0, 12).map((row) => (
                <div className="fit-start-card" key={`${row.materialId}-${row.firstPeriodMonth}`}>
                  <div className="visual-eyebrow">{row.materialTypeLabel} · {row.unit}</div>
                  <h3>{row.materialName}</h3>
                  <p>{row.materialCode}</p>
                  <div className="visual-card-metrics stacked">
                    <span>Inicio: {formatDateMonth(row.firstPeriodMonth)}</span>
                    <span>FITs: {row.fitCodes.slice(0, 3).join(', ') || 'No definido'}</span>
                    <span>Necesidad inicial: {formatQuantity(row.requiredQuantity, row.unit)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Drawer
        isOpen={drawerMode === 'control-create' || drawerMode === 'control-edit'}
        title={drawerMode === 'control-edit' ? 'Editar fecha de control' : 'Nueva fecha de control'}
        subtitle="Estas fechas son las que Kardex toma para todos los materiales del tipo"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="control-date-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar control'}
            </button>
          </>
        }
      >
        <form id="control-date-form" className="drawer-form" onSubmit={handleControlSubmit}>
          <div className="form-group">
            <label>Tipo de material</label>
            <select
              className="form-control"
              value={controlForm.material_type}
              onChange={(event) => handleControlTypeChange(event.target.value)}
              disabled={drawerMode === 'control-edit'}
            >
              <option value="">Selecciona...</option>
              {options.materialTypes.map((type) => (
                <option key={type.materialType} value={type.materialType}>{type.label} · {type.unit}</option>
              ))}
            </select>
            {drawerMode === 'control-edit' ? (
              <small className="field-help">En edición se bloquea el tipo para que el intercambio sea solo entre controles del mismo material.</small>
            ) : null}
          </div>

          <div className="form-group">
            <label>Mes</label>
            <input
              className="form-control"
              type="month"
              value={controlForm.period_month}
              onChange={(event) => handleControlMonthChange(event.target.value)}
              disabled={drawerMode === 'control-edit'}
            />
            {drawerMode === 'control-edit' ? (
              <small className="field-help">En edición se conserva el mes original. Para crear nuevos controles usa + Fecha control.</small>
            ) : null}
          </div>

          <div className="form-group">
            <label>{drawerMode === 'control-edit' ? 'Intercambiar control asignado' : 'Fecha de control (1 a 5)'}</label>
            <div className={`control-number-grid ${drawerMode === 'control-edit' ? 'edit-mode' : ''}`}>
              {(drawerMode === 'control-edit' ? assignedControlDatesForEdit.map((point) => point.controlNumber) : CONTROL_NUMBERS).map((number) => {
                const value = String(number)
                const isSelected = controlForm.control_number === value
                const isDisabled = drawerMode !== 'control-edit' && usedControlNumbers.includes(number) && !isSelected
                const assignedPoint = assignedControlDatesForEdit.find((point) => point.controlNumber === number)
                const isOriginalCurrent = drawerMode === 'control-edit' && selectedControlDate?.controlNumber === number
                const helperText = drawerMode === 'control-edit'
                  ? isOriginalCurrent && isSelected
                    ? 'Actual'
                    : isOriginalCurrent
                      ? 'Origen'
                      : isSelected
                        ? 'Nuevo número'
                        : 'Intercambiar'
                  : isDisabled
                    ? 'Ya asignado'
                    : 'Disponible'

                return (
                  <button
                    key={number}
                    type="button"
                    className={`control-number-btn ${isSelected ? 'selected' : ''} ${drawerMode === 'control-edit' && !isSelected ? 'swap-target' : ''}`}
                    title={drawerMode === 'control-edit' && !isSelected ? `Intercambiar con Control ${number}` : undefined}
                    disabled={isDisabled || !controlForm.period_month || !controlForm.material_type}
                    onClick={() => handleControlNumberSelect(value)}
                  >
                    <strong>{number}</strong>
                    <span>{helperText}</span>
                    {drawerMode === 'control-edit' && assignedPoint ? (
                      <small>{formatDate(assignedPoint.controlDate)}</small>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <small className="field-help">
              {drawerMode === 'control-edit'
                ? 'Solo aparecen los controles ya asignados en este mes. Selecciona otro control para intercambiar: el actual tomará ese número y el otro tomará el número original.'
                : 'Debes escoger el mes primero. Si una fecha de control ya existe para ese número, no se puede volver a seleccionar.'}
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de control</label>
              <input className="form-control" type="date" value={controlForm.control_date} onChange={(event) => setControlForm({ ...controlForm, control_date: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control" value={controlForm.status} onChange={(event) => setControlForm({ ...controlForm, status: event.target.value as ControlDateFormInput['status'] })}>
                <option value="planned">Planeado</option>
                <option value="done">Cumplido</option>
                <option value="delayed">Retrasado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea className="form-control textarea-control" value={controlForm.notes} onChange={(event) => setControlForm({ ...controlForm, notes: event.target.value })} placeholder="Observaciones del control Kardex." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica esta fecha de control." />
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={drawerMode === 'process-create' || drawerMode === 'process-edit'}
        title={drawerMode === 'process-edit' ? 'Editar fecha de proceso' : 'Nueva fecha de proceso'}
        subtitle="Estas fechas aparecen en el GANTT, pero no alimentan Kardex"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="process-date-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar proceso'}
            </button>
          </>
        }
      >
        <form id="process-date-form" className="drawer-form" onSubmit={handleProcessSubmit}>
          <div className="form-group">
            <label>Tipo de material</label>
            <select className="form-control" value={processForm.material_type} onChange={(event) => setProcessForm({ ...processForm, material_type: event.target.value })}>
              <option value="">Selecciona...</option>
              {options.materialTypes.map((type) => (
                <option key={type.materialType} value={type.materialType}>{type.label} · {type.unit}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha proceso</label>
            <input className="form-control" type="date" value={processForm.process_date} onChange={(event) => handleProcessDateChange(event.target.value)} />
            <small className="field-help">El mes se toma automáticamente desde esta fecha.</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Proceso</label>
              <input className="form-control" value={processForm.process_name} onChange={(event) => setProcessForm({ ...processForm, process_name: event.target.value })} placeholder="Lavandería, pintado, ensamble..." />
            </div>
            <div className="form-group">
              <label>Orden visual</label>
              <input className="form-control" type="number" min="1" step="1" value={processForm.sequence_order} onChange={(event) => setProcessForm({ ...processForm, sequence_order: event.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select className="form-control" value={processForm.status} onChange={(event) => setProcessForm({ ...processForm, status: event.target.value as ProcessDateFormInput['status'] })}>
              <option value="planned">Planeado</option>
              <option value="done">Cumplido</option>
              <option value="delayed">Retrasado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea className="form-control textarea-control" value={processForm.notes} onChange={(event) => setProcessForm({ ...processForm, notes: event.target.value })} placeholder="Ejemplo: envío de todos los botones a pintado." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica por qué se crea o modifica esta fecha de proceso." />
          </div>
        </form>
      </Drawer>
    </>
  )
}

function groupByMonth<T extends { periodMonth: string }>(rows: T[]) {
  const grouped = rows.reduce<Record<string, T[]>>((acc, row) => {
    acc[row.periodMonth] = acc[row.periodMonth] ?? []
    acc[row.periodMonth].push(row)
    return acc
  }, {})

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, groupRows]) => ({ month, rows: groupRows }))
}

function validateControlForm(form: ControlDateFormInput) {
  if (!form.material_type) throw new Error('El tipo de material es obligatorio.')
  if (!form.period_month) throw new Error('El mes es obligatorio.')
  if (!form.control_number) throw new Error('Debes seleccionar uno de los 5 controles del mes.')
  if (!form.control_date) throw new Error('La fecha de control es obligatoria.')

  const controlNumber = Number(form.control_number)
  if (Number.isNaN(controlNumber) || controlNumber < 1 || controlNumber > MAX_CONTROLS_PER_MONTH) {
    throw new Error(`El control debe estar entre 1 y ${MAX_CONTROLS_PER_MONTH}.`)
  }
}

function validateProcessForm(form: ProcessDateFormInput) {
  if (!form.material_type) throw new Error('El tipo de material es obligatorio.')
  if (!form.process_date) throw new Error('La fecha del proceso es obligatoria.')
  if (!form.process_name.trim()) throw new Error('El nombre del proceso es obligatorio.')

  const sequenceOrder = Number(form.sequence_order)
  if (Number.isNaN(sequenceOrder) || sequenceOrder < 1) {
    throw new Error('El orden visual debe ser mayor o igual a 1.')
  }
}
