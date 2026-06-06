import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { formatDate, formatDateMonth, formatNumber } from '../../utils/format'
import { getGanttOptions, toMonthInputValue } from '../gantt/ganttService'
import type { GanttOptions } from '../gantt/ganttTypes'

type CalendarEvent = {
  id: string
  date: string
  periodMonth: string
  materialType: string
  materialTypeLabel: string
  title: string
  subtitle: string
  status: 'planned' | 'done' | 'delayed' | 'cancelled'
  source: 'control' | 'process'
  affectsKardex: boolean
  order: number
  notes: string | null
}

const statusLabels: Record<CalendarEvent['status'], string> = {
  planned: 'Planeado',
  done: 'Cumplido',
  delayed: 'Retrasado',
  cancelled: 'Cancelado',
}

const sourceLabels: Record<CalendarEvent['source'], string> = {
  control: 'Control Kardex',
  process: 'Proceso GANTT',
}

export function CronogramaPage() {
  const [options, setOptions] = useState<GanttOptions>({
    materialTypes: [],
    materials: [],
    controlDates: [],
    processDates: [],
    fitStarts: [],
  })
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedMaterialType, setSelectedMaterialType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCronograma() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await getGanttOptions()
      setOptions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar el cronograma.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCronograma()
  }, [])

  const events = useMemo<CalendarEvent[]>(() => {
    const controls: CalendarEvent[] = options.controlDates.map((point) => ({
      id: `control-${point.id}`,
      date: point.controlDate,
      periodMonth: point.periodMonth,
      materialType: point.materialType,
      materialTypeLabel: point.materialTypeLabel,
      title: `Control ${point.controlNumber}`,
      subtitle: point.label,
      status: point.status,
      source: 'control',
      affectsKardex: true,
      order: point.controlNumber,
      notes: point.notes,
    }))

    const processes: CalendarEvent[] = options.processDates.map((point) => ({
      id: `process-${point.id}`,
      date: point.processDate,
      periodMonth: point.periodMonth,
      materialType: point.materialType,
      materialTypeLabel: point.materialTypeLabel,
      title: point.processName,
      subtitle: `Orden ${point.sequenceOrder}`,
      status: point.status,
      source: 'process',
      affectsKardex: false,
      order: point.sequenceOrder,
      notes: point.notes,
    }))

    return [...controls, ...processes].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date)
      if (byDate !== 0) return byDate
      const bySource = a.source.localeCompare(b.source)
      if (bySource !== 0) return bySource
      return a.order - b.order
    })
  }, [options.controlDates, options.processDates])

  const monthOptions = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.periodMonth))).sort()
  }, [events])

  const effectiveMonth = useMemo(() => {
    if (selectedMonth !== 'all') return selectedMonth
    return monthOptions[0] ?? ''
  }, [monthOptions, selectedMonth])

  const query = search.trim().toLowerCase()

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesMonth = selectedMonth === 'all' || event.periodMonth === selectedMonth
      const matchesType = selectedMaterialType === 'all' || event.materialType === selectedMaterialType
      const matchesStatus = selectedStatus === 'all' || event.status === selectedStatus
      const matchesSearch = !query || [
        event.title,
        event.subtitle,
        event.materialTypeLabel,
        event.notes ?? '',
        sourceLabels[event.source],
      ].join(' ').toLowerCase().includes(query)

      return matchesMonth && matchesType && matchesStatus && matchesSearch
    })
  }, [events, query, selectedMaterialType, selectedMonth, selectedStatus])

  const calendarDays = useMemo(() => buildCalendarDays(effectiveMonth, filteredEvents), [effectiveMonth, filteredEvents])
  const selectedMonthEvents = filteredEvents.filter((event) => event.periodMonth === effectiveMonth)
  const controlCount = selectedMonthEvents.filter((event) => event.source === 'control').length
  const processCount = selectedMonthEvents.filter((event) => event.source === 'process').length
  const delayedCount = filteredEvents.filter((event) => event.status === 'delayed').length
  const doneCount = filteredEvents.filter((event) => event.status === 'done').length

  return (
    <>
      <div className="filter-bar smart-filter">
        <span className="filter-label">Cronograma</span>
        <select className="filter-select" value={selectedMaterialType} onChange={(event) => setSelectedMaterialType(event.target.value)}>
          <option value="all">Todos los tipos</option>
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
        <select className="filter-select" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="planned">Planeado</option>
          <option value="done">Cumplido</option>
          <option value="delayed">Retrasado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <input
          className="search-input"
          placeholder="Buscar control, proceso, tipo o nota..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void loadCronograma()}>Recargar</button>
      </div>

      {error ? <div className="auth-alert error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="planning-note">
        <strong>Origen del cronograma:</strong> esta vista toma todo lo planificado en GANTT y lo muestra como calendario. Los controles alimentan Kardex; los procesos son seguimiento operativo.
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Eventos filtrados" value={formatNumber(filteredEvents.length, 0)} sub="controles + procesos" />
        <KpiCard label="Control Kardex" value={formatNumber(controlCount, 0)} sub={effectiveMonth ? formatDateMonth(effectiveMonth) : 'sin mes'} />
        <KpiCard label="Procesos" value={formatNumber(processCount, 0)} sub="solo GANTT" />
        <KpiCard label="Alertas" value={formatNumber(delayedCount, 0)} sub={`${doneCount} cumplidos`} />
      </div>

      <section className="calendar-panel">
        <div className="calendar-head">
          <div>
            <h3>{effectiveMonth ? formatDateMonth(effectiveMonth) : 'Sin eventos programados'}</h3>
            <p>Calendario operativo por tipo de material, con estado de cada fecha planificada.</p>
          </div>
          <div className="calendar-legend">
            <span><i className="legend-dot control" /> Control Kardex</span>
            <span><i className="legend-dot process" /> Proceso</span>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">Cargando cronograma...</div>
        ) : !effectiveMonth ? (
          <div className="empty-state">No hay fechas planificadas en el GANTT.</div>
        ) : (
          <div className="calendar-grid">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}

            {calendarDays.map((day) => (
              <div className={`calendar-day ${day.isCurrentMonth ? '' : 'muted'}`} key={day.key}>
                <div className="calendar-day-number">{day.dayNumber}</div>
                <div className="calendar-event-list">
                  {day.events.slice(0, 4).map((event) => (
                    <div className={`calendar-event ${event.source} ${event.status}`} key={event.id}>
                      <div className="calendar-event-title">{event.title}</div>
                      <div className="calendar-event-meta">{event.materialTypeLabel} · {sourceLabels[event.source]}</div>
                      <div className="calendar-event-status"><Badge>{statusLabels[event.status]}</Badge></div>
                    </div>
                  ))}
                  {day.events.length > 4 ? <div className="calendar-more">+{day.events.length - 4} más</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="calendar-panel">
        <div className="calendar-head">
          <div>
            <h3>Listado de eventos</h3>
            <p>Detalle de controles y procesos planificados según los filtros actuales.</p>
          </div>
        </div>

        <div className="calendar-agenda">
          {filteredEvents.length === 0 ? (
            <div className="empty-state">No hay eventos con los filtros seleccionados.</div>
          ) : filteredEvents.map((event) => (
            <div className={`agenda-item ${event.source} ${event.status}`} key={event.id}>
              <div className="agenda-date">
                <strong>{formatDate(event.date)}</strong>
                <span>{formatDateMonth(event.periodMonth)}</span>
              </div>
              <div className="agenda-content">
                <div className="visual-eyebrow">{event.materialTypeLabel} · {sourceLabels[event.source]}</div>
                <h3>{event.title}</h3>
                <p>{event.subtitle}{event.notes ? ` · ${event.notes}` : ''}</p>
              </div>
              <Badge>{statusLabels[event.status]}</Badge>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function buildCalendarDays(periodMonth: string, events: CalendarEvent[]) {
  if (!periodMonth) return []

  const monthInput = toMonthInputValue(periodMonth)
  const firstDay = new Date(`${monthInput}-01T00:00:00`)
  const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - startOffset)

  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const eventMap = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    acc[event.date] = acc[event.date] ?? []
    acc[event.date].push(event)
    return acc
  }, {})

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = date.toISOString().slice(0, 10)

    return {
      key,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === firstDay.getMonth(),
      events: eventMap[key] ?? [],
    }
  })
}
