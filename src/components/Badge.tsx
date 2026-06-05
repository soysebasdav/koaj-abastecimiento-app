type BadgeProps = {
  children: string
}

const toneByLabel: Record<string, string> = {
  Crítico: 'badge-crit',
  Faltante: 'badge-crit',
  Atención: 'badge-warn',
  'Sin riesgo': 'badge-ok',
  Activo: 'badge-ok',
  Inactivo: 'badge-closed',
  Calculado: 'badge-transit',
  Vigente: 'badge-ok',
  Borrador: 'badge-warn',
  Reemplazada: 'badge-closed',
  Cerrado: 'badge-closed',
  'En tránsito': 'badge-transit',
  Pedido: 'badge-transit',
  Sobrestock: 'badge-over',
  create: 'badge-ok',
  update: 'badge-transit',
  delete: 'badge-crit',
  future_change: 'badge-transit',
  month_forward_change: 'badge-warn',
  retroactive_change: 'badge-retro',
}

export function Badge({ children }: BadgeProps) {
  return <span className={`badge ${toneByLabel[children] ?? 'badge-ok'}`}>{children}</span>
}
