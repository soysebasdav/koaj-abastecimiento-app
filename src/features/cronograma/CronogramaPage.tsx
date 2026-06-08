import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Badge'
import { KpiCard } from '../../components/KpiCard'
import { formatDate, formatNumber } from '../../utils/format'
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

type CalendarWeekOption = {
  id: string
  start: string
  end: string
  label: string
  weekNumber: number
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
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState('')
  const [selectedWeekStart, setSelectedWeekStart] = useState('all')
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
      title: `${formatMonthName(point.periodMonth)} Control ${point.controlNumber}`,
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

  const monthOptions = useMemo(() => buildContinuousMonthOptions(events), [events])
  const effectiveCalendarMonth = selectedCalendarMonth || monthOptions[0] || getCurrentMonthInputValue()
  const weekOptions = useMemo(() => buildCalendarWeekOptions(effectiveCalendarMonth), [effectiveCalendarMonth])
  const activeWeek = useMemo(() => {
    return weekOptions.find((week) => week.start === selectedWeekStart) ?? null
  }, [selectedWeekStart, weekOptions])

  useEffect(() => {
    if (selectedWeekStart !== 'all' && !weekOptions.some((week) => week.start === selectedWeekStart)) {
      setSelectedWeekStart('all')
    }
  }, [selectedWeekStart, weekOptions])

  const query = search.trim().toLowerCase()

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesType = selectedMaterialType === 'all' || event.materialType === selectedMaterialType
      const matchesStatus = selectedStatus === 'all' || event.status === selectedStatus
      const matchesSearch = !query || [
        event.title,
        event.subtitle,
        event.materialTypeLabel,
        event.notes ?? '',
        sourceLabels[event.source],
      ].join(' ').toLowerCase().includes(query)

      return matchesType && matchesStatus && matchesSearch
    })
  }, [events, query, selectedMaterialType, selectedStatus])

  const monthEvents = useMemo(() => {
    return filteredEvents.filter((event) => toMonthInputValue(event.date) === effectiveCalendarMonth)
  }, [effectiveCalendarMonth, filteredEvents])

  const visibleEvents = useMemo(() => {
    if (!activeWeek) return monthEvents
    return monthEvents.filter((event) => event.date >= activeWeek.start && event.date <= activeWeek.end)
  }, [activeWeek, monthEvents])

  const calendarDays = useMemo(() => {
    return buildCalendarDays(effectiveCalendarMonth, visibleEvents, activeWeek)
  }, [activeWeek, effectiveCalendarMonth, visibleEvents])

  const controlCount = visibleEvents.filter((event) => event.source === 'control').length
  const processCount = visibleEvents.filter((event) => event.source === 'process').length
  const delayedCount = visibleEvents.filter((event) => event.status === 'delayed').length
  const doneCount = visibleEvents.filter((event) => event.status === 'done').length
  const visiblePeriodLabel = activeWeek ? activeWeek.label : formatMonthInputTitle(effectiveCalendarMonth)

  function changeCalendarMonth(value: string) {
    if (!value) return
    setSelectedCalendarMonth(value)
    setSelectedWeekStart('all')
  }

  function goToPreviousMonth() {
    changeCalendarMonth(shiftMonthInput(effectiveCalendarMonth, -1))
  }

  function goToNextMonth() {
    changeCalendarMonth(shiftMonthInput(effectiveCalendarMonth, 1))
  }

  function goToToday() {
    changeCalendarMonth(getCurrentMonthInputValue())
  }

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
        <input
          className="filter-select"
          type="month"
          value={effectiveCalendarMonth}
          onChange={(event) => changeCalendarMonth(event.target.value)}
          aria-label="Mes del calendario"
        />
        <select className="filter-select" value={selectedWeekStart} onChange={(event) => setSelectedWeekStart(event.target.value)}>
          <option value="all">Todas las semanas del mes</option>
          {weekOptions.map((week) => (
            <option key={week.id} value={week.start}>{week.label}</option>
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
        <strong>Cronograma normal:</strong> el calendario se navega por <strong>mes real</strong> y por <strong>semana</strong>. La tarjeta conserva el mes operativo creado en GANTT, por ejemplo <strong>Septiembre Control 1</strong>, aunque la fecha programada haya sido seleccionada en otro mes.
      </div>

      <div className="kpi-row compact">
        <KpiCard label="Eventos visibles" value={formatNumber(visibleEvents.length, 0)} sub={visiblePeriodLabel} />
        <KpiCard label="Control Kardex" value={formatNumber(controlCount, 0)} sub="fechas de control" />
        <KpiCard label="Procesos" value={formatNumber(processCount, 0)} sub="solo GANTT" />
        <KpiCard label="Alertas" value={formatNumber(delayedCount, 0)} sub={`${doneCount} cumplidos`} />
      </div>

      <section className="calendar-panel">
        <div className="calendar-head">
          <div>
            <h3>{formatMonthInputTitle(effectiveCalendarMonth)}</h3>
            <p>{activeWeek ? `Vista semanal: ${activeWeek.label}` : 'Vista mensual. Si no hay eventos programados, el calendario queda vacío.'}</p>
          </div>
          <div className="calendar-tools">
            <div className="calendar-month-nav" aria-label="Navegación de meses del calendario">
              <button className="action-btn" type="button" onClick={goToPreviousMonth}>← Mes anterior</button>
              <span>{visiblePeriodLabel}</span>
              <button className="action-btn" type="button" onClick={goToToday}>Hoy</button>
              <button className="action-btn" type="button" onClick={goToNextMonth}>Mes siguiente →</button>
            </div>
            <div className="calendar-legend">
              <span><i className="legend-dot control" /> Control Kardex</span>
              <span><i className="legend-dot process" /> Proceso</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">Cargando cronograma...</div>
        ) : (
          <div className="calendar-grid">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}

            {calendarDays.map((day) => (
              <div className={`calendar-day ${day.isCurrentMonth ? '' : 'muted'} ${day.isToday ? 'today' : ''}`} key={day.key}>
                <div className="calendar-day-number">
                  <span>{day.dayNumber}</span>
                  {day.isToday ? <span className="calendar-today-pill">Hoy</span> : null}
                </div>
                <div className="calendar-event-list">
                  {day.events.slice(0, 4).map((event) => (
                    <div className={`calendar-event ${event.source} ${event.status}`} key={event.id}>
                      <div className="calendar-event-title">{event.title}</div>
                      <div className="calendar-event-meta">{event.materialTypeLabel} · {sourceLabels[event.source]}</div>
                      <div className="calendar-event-meta">Fecha programada: {formatDate(event.date)}</div>
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
            <p>Detalle de controles y procesos planificados según el mes, la semana y los filtros actuales.</p>
          </div>
        </div>

        <div className="calendar-agenda">
          {visibleEvents.length === 0 ? (
            <div className="empty-state">No hay eventos programados para el mes o semana seleccionada.</div>
          ) : visibleEvents.map((event) => (
            <div className={`agenda-item ${event.source} ${event.status}`} key={event.id}>
              <div className="agenda-date">
                <strong>{formatDate(event.date)}</strong>
                <span>Mes control: {formatMonthTitle(event.periodMonth)}</span>
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

function buildCalendarDays(periodMonth: string, events: CalendarEvent[], activeWeek: CalendarWeekOption | null) {
  if (!periodMonth) return []

  const controlMonthStart = parseDateOnly(`${periodMonth}-01`)
  if (!controlMonthStart) return []

  const controlMonthEnd = new Date(controlMonthStart.getFullYear(), controlMonthStart.getMonth() + 1, 0)
  const rangeStart = activeWeek ? parseDateOnly(activeWeek.start) : getWeekStart(controlMonthStart)
  const rangeEnd = activeWeek ? parseDateOnly(activeWeek.end) : getWeekEnd(controlMonthEnd)
  if (!rangeStart || !rangeEnd) return []

  const totalCells = Math.max(7, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1)
  const todayKey = toDateKey(new Date())
  const eventMap = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    acc[event.date] = acc[event.date] ?? []
    acc[event.date].push(event)
    return acc
  }, {})

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(rangeStart)
    date.setDate(rangeStart.getDate() + index)
    const key = toDateKey(date)

    return {
      key,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getFullYear() === controlMonthStart.getFullYear() && date.getMonth() === controlMonthStart.getMonth(),
      isToday: key === todayKey,
      events: eventMap[key] ?? [],
    }
  })
}

function buildContinuousMonthOptions(events: CalendarEvent[]) {
  const eventMonths = Array.from(new Set(events.map((event) => toMonthInputValue(event.date)).filter(Boolean))).sort()
  if (eventMonths.length === 0) return []

  const firstMonth = parseDateOnly(`${eventMonths[0]}-01`)
  const lastMonth = parseDateOnly(`${eventMonths[eventMonths.length - 1]}-01`)
  if (!firstMonth || !lastMonth) return eventMonths

  const months: string[] = []
  const cursor = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1)
  while (cursor <= lastMonth) {
    months.push(toMonthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

function buildCalendarWeekOptions(monthInput: string): CalendarWeekOption[] {
  const monthStart = parseDateOnly(`${monthInput}-01`)
  if (!monthStart) return []

  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const rangeStart = getWeekStart(monthStart)
  const rangeEnd = getWeekEnd(monthEnd)
  const options: CalendarWeekOption[] = []

  for (const cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = new Date(cursor)
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekStart.getDate() + 6)

    const referenceDate = clampDate(monthStart, weekStart, weekEnd)
    const weekNumber = getOperationalWeekNumber(referenceDate)
    options.push({
      id: toDateKey(weekStart),
      start: toDateKey(weekStart),
      end: toDateKey(weekEnd),
      label: `Semana ${weekNumber} · ${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`,
      weekNumber,
    })
  }

  return options
}

function getOperationalWeekNumber(date: Date) {
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const firstMonday = new Date(yearStart)

  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1)
  }

  if (date < firstMonday) return 1

  const diffDays = Math.floor((date.getTime() - firstMonday.getTime()) / 86_400_000)
  return 2 + Math.floor(diffDays / 7)
}

function getWeekStart(date: Date) {
  const weekStart = new Date(date)
  const offset = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - offset)
  return weekStart
}

function getWeekEnd(date: Date) {
  const weekEnd = new Date(date)
  const offset = (weekEnd.getDay() + 6) % 7
  weekEnd.setDate(weekEnd.getDate() + (6 - offset))
  return weekEnd
}

function clampDate(monthStart: Date, weekStart: Date, weekEnd: Date) {
  if (monthStart < weekStart) return weekStart
  if (monthStart > weekEnd) return weekEnd
  return monthStart
}

function shiftMonthInput(monthInput: string, delta: number) {
  const baseDate = parseDateOnly(`${monthInput}-01`) ?? new Date()
  const shifted = new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1)
  return toMonthKey(shifted)
}

function getCurrentMonthInputValue() {
  return toMonthKey(new Date())
}

function toMonthKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatMonthName(value: string | null | undefined) {
  if (!value) return 'Sin mes'

  const date = parseDateOnly(value)
  if (!date) return value

  const label = date.toLocaleDateString('es-CO', { month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatMonthTitle(value: string | null | undefined) {
  if (!value) return 'Sin mes'

  const date = parseDateOnly(value)
  if (!date) return value

  const label = date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
  })

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatMonthInputTitle(value: string | null | undefined) {
  return value ? formatMonthTitle(`${value}-01`) : 'Sin mes'
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '')
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null

  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
