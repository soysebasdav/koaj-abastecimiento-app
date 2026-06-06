import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { Drawer } from '../../components/Drawer'
import { TableShell } from '../../components/TableShell'
import { formatDateMonth, formatNumber } from '../../utils/format'
import {
  applyForecastFromMonth,
  createForecast,
  getForecastFormOptions,
  listForecasts,
  toMonthInputValue,
  updateForecast,
} from './forecastsService'
import type { ForecastFormInput, ForecastFormOptions, ForecastView, MonthForwardForecastInput } from './forecastsTypes'

type DrawerMode = 'create' | 'edit' | 'month-forward' | null

const emptyForecastForm: ForecastFormInput = {
  collection_id: '',
  fit_id: '',
  period_month: '',
  projected_units: '',
  version_label: 'V1',
  source: 'manual',
  status: 'active',
  change_reason: '',
}

const emptyMonthForwardForm: MonthForwardForecastInput = {
  collection_id: '',
  fit_id: '',
  from_month: '',
  to_month: '',
  projected_units: '',
  version_label: 'V2',
  source: 'internal_adjustment',
  change_reason: '',
}

function mapForecastStatus(status: ForecastView['status']) {
  const labels: Record<ForecastView['status'], string> = {
    draft: 'Borrador',
    active: 'Activo',
    replaced: 'Reemplazada',
  }

  return labels[status]
}

function forecastToForm(forecast: ForecastView): ForecastFormInput {
  return {
    collection_id: forecast.collectionId,
    fit_id: forecast.fitId,
    period_month: toMonthInputValue(forecast.periodMonth),
    projected_units: String(forecast.projectedUnits),
    version_label: forecast.versionLabel,
    source: forecast.source,
    status: forecast.status,
    change_reason: forecast.changeReason ?? '',
  }
}

export function ForecastsPage() {
  const [forecasts, setForecasts] = useState<ForecastView[]>([])
  const [options, setOptions] = useState<ForecastFormOptions>({
    collections: [],
    fits: [],
  })
  const [search, setSearch] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedForecast, setSelectedForecast] = useState<ForecastView | null>(null)
  const [forecastForm, setForecastForm] = useState<ForecastFormInput>(emptyForecastForm)
  const [monthForwardForm, setMonthForwardForm] = useState<MonthForwardForecastInput>(emptyMonthForwardForm)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function loadForecasts() {
    setIsLoading(true)
    setError(null)

    try {
      const [forecastRows, formOptions] = await Promise.all([listForecasts(), getForecastFormOptions()])
      setForecasts(forecastRows)
      setOptions(formOptions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las proyecciones.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadForecasts()
  }, [])

  const filteredForecasts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return forecasts

    return forecasts.filter((forecast) =>
      [
        forecast.collectionCode,
        forecast.fitCode,
        forecast.fitName,
        forecast.fitCategory ?? '',
        forecast.periodMonth,
        forecast.source,
        forecast.status,
        forecast.changeReason ?? '',
      ].join(' ').toLowerCase().includes(query),
    )
  }, [forecasts, search])

  const activeForecasts = filteredForecasts.filter((forecast) => forecast.status === 'active')
  const replacedForecasts = filteredForecasts.filter((forecast) => forecast.status === 'replaced')
  const totalProjectedUnits = activeForecasts.reduce((sum, forecast) => sum + forecast.projectedUnits, 0)

  function openCreate() {
    setDrawerMode('create')
    setSelectedForecast(null)
    setForecastForm({
      ...emptyForecastForm,
      collection_id: options.collections[0]?.id ?? '',
      fit_id: options.fits[0]?.id ?? '',
    })
    setReason('Creación de proyección mensual')
    setError(null)
    setFeedback(null)
  }

  function openEdit(forecast: ForecastView) {
    setDrawerMode('edit')
    setSelectedForecast(forecast)
    setForecastForm(forecastToForm(forecast))
    setReason('Actualización de proyección mensual')
    setError(null)
    setFeedback(null)
  }

  function openMonthForward(forecast?: ForecastView) {
    const selectedCollection = forecast?.collectionId ?? options.collections[0]?.id ?? ''
    const selectedFit = forecast?.fitId ?? options.fits[0]?.id ?? ''
    const selectedCollectionOption = options.collections.find((collection) => collection.id === selectedCollection)

    setDrawerMode('month-forward')
    setSelectedForecast(forecast ?? null)
    setMonthForwardForm({
      ...emptyMonthForwardForm,
      collection_id: selectedCollection,
      fit_id: selectedFit,
      from_month: forecast ? toMonthInputValue(forecast.periodMonth) : '',
      to_month: selectedCollectionOption ? toMonthInputValue(selectedCollectionOption.end_month) : '',
      projected_units: forecast ? String(forecast.projectedUnits) : '',
      version_label: nextVersionLabel(forecasts, selectedCollection, selectedFit),
      change_reason: 'Cambio desde mes en adelante',
    })
    setReason('Cambio de proyección desde mes en adelante')
    setError(null)
    setFeedback(null)
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedForecast(null)
    setError(null)
  }

  async function handleForecastSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateForecastForm(forecastForm)

      if (!reason.trim()) {
        throw new Error('El motivo de auditoría es obligatorio.')
      }

      if (drawerMode === 'edit' && selectedForecast) {
        await updateForecast(selectedForecast.id, selectedForecast, forecastForm, reason)
        setFeedback('Proyección actualizada correctamente.')
      } else {
        await createForecast(forecastForm, reason)
        setFeedback('Proyección creada correctamente.')
      }

      await loadForecasts()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la proyección.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleMonthForwardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      validateMonthForwardForm(monthForwardForm)

      if (!reason.trim()) {
        throw new Error('El motivo de auditoría es obligatorio.')
      }

      await applyForecastFromMonth(monthForwardForm, reason)
      setFeedback('Cambio desde mes en adelante aplicado correctamente.')
      await loadForecasts()
      closeDrawer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible aplicar el cambio desde mes.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Proyección real:</span>
        <button className="filter-chip active" type="button">Supabase conectado</button>
        <button className="filter-chip" type="button">{activeForecasts.length} activos</button>
        <button className="filter-chip" type="button">{replacedForecasts.length} reemplazados</button>
        <button className="filter-chip" type="button">{formatNumber(totalProjectedUnits)} unidades activas</button>
        <input
          className="search-input"
          placeholder="Buscar FIT, colección o mes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ marginLeft: 'auto' }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadForecasts()}>
          Recargar
        </button>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          + Nueva proyección
        </button>
        <button className="btn btn-primary" type="button" onClick={() => openMonthForward()}>
          Cambio desde mes
        </button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {feedback ? <div className="auth-alert success" style={{ marginBottom: 16 }}>{feedback}</div> : null}

      <TableShell title="Proyección mensual por FIT" subtitle="La proyección se define por FIT; las versiones se calculan por mix">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>FIT</th>
              <th>Categoría</th>
              <th>Mes</th>
              <th>Unidades proyectadas</th>
              <th>Versión dato</th>
              <th>Fuente</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10}>Cargando proyecciones...</td></tr>
            ) : filteredForecasts.length === 0 ? (
              <tr><td colSpan={10}>No hay proyecciones registradas.</td></tr>
            ) : filteredForecasts.map((forecast) => (
              <tr key={forecast.id}>
                <td>{forecast.collectionCode}</td>
                <td>{forecast.fitName}</td>
                <td>{forecast.fitCategory ?? 'Sin categoría'}</td>
                <td>{formatDateMonth(forecast.periodMonth)}</td>
                <td>{formatNumber(forecast.projectedUnits)}</td>
                <td>{forecast.versionLabel}</td>
                <td>{forecast.source}</td>
                <td>{forecast.changeReason ?? 'Sin motivo registrado'}</td>
                <td><Badge>{mapForecastStatus(forecast.status)}</Badge></td>
                <td>
                  <div className="inline-actions">
                    <button className="action-btn" type="button" onClick={() => openEdit(forecast)}>Editar</button>
                    <button className="action-btn" type="button" onClick={() => openMonthForward(forecast)}>Desde mes</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <Drawer
        isOpen={drawerMode === 'create' || drawerMode === 'edit'}
        title={drawerMode === 'edit' ? 'Editar proyección mensual' : 'Nueva proyección mensual'}
        subtitle="Proyección por FIT. El cálculo por versión se hace desde el mix porcentual."
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="forecast-form" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar proyección'}
            </button>
          </>
        }
      >
        <form id="forecast-form" className="drawer-form" onSubmit={handleForecastSubmit}>
          <ForecastFields
            form={forecastForm}
            setForm={setForecastForm}
            options={options}
            includeStatus
          />

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea
              className="form-control textarea-control"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explica por qué se crea o modifica esta proyección."
            />
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={drawerMode === 'month-forward'}
        title="Cambio desde mes en adelante"
        subtitle="Reemplaza proyecciones activas del rango y crea una nueva versión vigente"
        onClose={closeDrawer}
        footer={
          <>
            <button className="btn btn-ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="month-forward-form" disabled={isSaving}>
              {isSaving ? 'Aplicando...' : 'Aplicar cambio'}
            </button>
          </>
        }
      >
        <form id="month-forward-form" className="drawer-form" onSubmit={handleMonthForwardSubmit}>
          <div className="impact-box">
            <div className="impact-title">Impacto operativo</div>
            <div className="impact-row"><span>Acción</span><strong>Reemplaza activos en el rango</strong></div>
            <div className="impact-row"><span>Resultado</span><strong>Nueva versión activa</strong></div>
            <div className="impact-row"><span>Cálculo</span><strong>Actualiza necesidad de materiales</strong></div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Colección</label>
              <select className="form-control" value={monthForwardForm.collection_id} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, collection_id: event.target.value })}>
                <option value="">Selecciona...</option>
                {options.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>{collection.code} · {collection.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>FIT</label>
              <select className="form-control" value={monthForwardForm.fit_id} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, fit_id: event.target.value })}>
                <option value="">Selecciona...</option>
                {options.fits.map((fit) => (
                  <option key={fit.id} value={fit.id}>{fit.code} · {fit.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Desde mes</label>
              <input className="form-control" type="month" value={monthForwardForm.from_month} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, from_month: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Hasta mes</label>
              <input className="form-control" type="month" value={monthForwardForm.to_month} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, to_month: event.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unidades proyectadas</label>
              <input className="form-control" type="number" min="0" step="1" value={monthForwardForm.projected_units} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, projected_units: event.target.value })} placeholder="7000" />
            </div>
            <div className="form-group">
              <label>Versión dato</label>
              <input className="form-control" value={monthForwardForm.version_label} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, version_label: event.target.value })} placeholder="V2" />
            </div>
          </div>

          <div className="form-group">
            <label>Fuente</label>
            <select className="form-control" value={monthForwardForm.source} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, source: event.target.value as MonthForwardForecastInput['source'] })}>
              <option value="manual">Manual</option>
              <option value="excel_import">Importación Excel</option>
              <option value="commercial">Comercial</option>
              <option value="internal_adjustment">Ajuste interno</option>
            </select>
          </div>

          <div className="form-group">
            <label>Motivo del cambio</label>
            <textarea className="form-control textarea-control" value={monthForwardForm.change_reason} onChange={(event) => setMonthForwardForm({ ...monthForwardForm, change_reason: event.target.value })} placeholder="Cierre de colección, cambio comercial, ajuste de demanda..." />
          </div>

          <div className="form-group">
            <label>Motivo auditoría</label>
            <textarea className="form-control textarea-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Justificación obligatoria del cambio desde mes." />
          </div>
        </form>
      </Drawer>
    </>
  )
}

type ForecastFieldsProps = {
  form: ForecastFormInput
  setForm: (form: ForecastFormInput) => void
  options: ForecastFormOptions
  includeStatus?: boolean
}

function ForecastFields({ form, setForm, options, includeStatus = false }: ForecastFieldsProps) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Colección</label>
          <select className="form-control" value={form.collection_id} onChange={(event) => setForm({ ...form, collection_id: event.target.value })}>
            <option value="">Selecciona...</option>
            {options.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.code} · {collection.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>FIT</label>
          <select className="form-control" value={form.fit_id} onChange={(event) => setForm({ ...form, fit_id: event.target.value })}>
            <option value="">Selecciona...</option>
            {options.fits.map((fit) => (
              <option key={fit.id} value={fit.id}>{fit.code} · {fit.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mes</label>
          <input className="form-control" type="month" value={form.period_month} onChange={(event) => setForm({ ...form, period_month: event.target.value })} />
        </div>
        <div className="form-group">
          <label>Unidades proyectadas</label>
          <input className="form-control" type="number" min="0" step="1" value={form.projected_units} onChange={(event) => setForm({ ...form, projected_units: event.target.value })} placeholder="7000" />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Versión dato</label>
          <input className="form-control" value={form.version_label} onChange={(event) => setForm({ ...form, version_label: event.target.value })} placeholder="V1" />
        </div>
        <div className="form-group">
          <label>Fuente</label>
          <select className="form-control" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as ForecastFormInput['source'] })}>
            <option value="manual">Manual</option>
            <option value="excel_import">Importación Excel</option>
            <option value="commercial">Comercial</option>
            <option value="internal_adjustment">Ajuste interno</option>
          </select>
        </div>
      </div>

      {includeStatus ? (
        <div className="form-group">
          <label>Estado</label>
          <select className="form-control" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ForecastFormInput['status'] })}>
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="replaced">Reemplazada</option>
          </select>
        </div>
      ) : null}

      <div className="form-group">
        <label>Motivo / comentario de proyección</label>
        <textarea className="form-control textarea-control" value={form.change_reason} onChange={(event) => setForm({ ...form, change_reason: event.target.value })} placeholder="Proyección inicial, ajuste comercial, importación..." />
      </div>
    </>
  )
}

function validateForecastForm(form: ForecastFormInput) {
  if (!form.collection_id || !form.fit_id) {
    throw new Error('Colección y FIT son obligatorios.')
  }

  if (!form.period_month) {
    throw new Error('El mes es obligatorio.')
  }

  const projectedUnits = Number(form.projected_units)

  if (Number.isNaN(projectedUnits) || projectedUnits < 0) {
    throw new Error('Las unidades proyectadas deben ser un número mayor o igual a 0.')
  }

  if (!form.version_label.trim()) {
    throw new Error('La versión del dato es obligatoria.')
  }
}

function validateMonthForwardForm(form: MonthForwardForecastInput) {
  if (!form.collection_id || !form.fit_id) {
    throw new Error('Colección y FIT son obligatorios.')
  }

  if (!form.from_month || !form.to_month) {
    throw new Error('Mes inicial y mes final son obligatorios.')
  }

  if (form.to_month < form.from_month) {
    throw new Error('El mes final no puede ser anterior al mes inicial.')
  }

  const projectedUnits = Number(form.projected_units)

  if (Number.isNaN(projectedUnits) || projectedUnits < 0) {
    throw new Error('Las unidades proyectadas deben ser un número mayor o igual a 0.')
  }

  if (!form.version_label.trim()) {
    throw new Error('La versión del dato es obligatoria.')
  }
}

function nextVersionLabel(forecasts: ForecastView[], collectionId: string, fitId: string) {
  const scopedForecasts = forecasts.filter((forecast) => forecast.collectionId === collectionId && forecast.fitId === fitId)
  const maxVersion = scopedForecasts.reduce((max, forecast) => {
    const match = forecast.versionLabel.match(/^V(\d+)$/i)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `V${maxVersion + 1}`
}
