type BadgeProps = {
  children: string
}

const toneByLabel: Record<string, string> = {
  'Crítico': 'badge-crit',
  'Faltante': 'badge-crit',
  'Atención': 'badge-warn',
  'Sin riesgo': 'badge-ok',
  'Activo': 'badge-ok',
  'En tránsito': 'badge-transit',
  'Pedido': 'badge-transit',
  'Sobrestock': 'badge-over',
  'Cerrado': 'badge-closed',
  'future_change': 'badge-transit',
  'month_forward_change': 'badge-warn',
  'retroactive_change': 'badge-retro',
}

export function Badge({ children }: BadgeProps) {
  return <span className={`badge ${toneByLabel[children] ?? 'badge-ok'}`}>{children}</span>
}
