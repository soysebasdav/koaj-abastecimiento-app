export function formatNumber(value: number | string | null | undefined, decimals = 0) {
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (numericValue === null || numericValue === undefined || Number.isNaN(Number(numericValue))) {
    return '-'
  }

  return Number(numericValue).toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatDateMonth(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
  })
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatPercent(value: number | string | null | undefined, decimals = 0) {
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (numericValue === null || numericValue === undefined || Number.isNaN(Number(numericValue))) {
    return '-'
  }

  return `${Number(numericValue).toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

export function formatQuantity(value: number | string | null | undefined, unit?: string | null) {
  const label = formatNumber(value, 2)
  return unit ? `${label} ${mapUnit(unit)}` : label
}

export function mapUnit(unit: string | null | undefined) {
  const labels: Record<string, string> = {
    meter: 'm',
    unit: 'und',
    kg: 'kg',
    roll: 'rollo',
    box: 'caja',
    package: 'paquete',
  }

  return unit ? labels[unit] ?? unit : ''
}
