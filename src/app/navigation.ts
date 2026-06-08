export type AppSection =
  | 'inicio'
  | 'dashboard'
  | 'catalog'
  | 'bom'
  | 'forecasts'
  | 'supply'
  | 'inventory'
  | 'kardex'
  | 'gantt'
  | 'cronograma'
  | 'collections'
  | 'audit'

export type NavItem = {
  id: AppSection
  label: string
  icon: string
  badge?: string
  badgeTone?: 'critical' | 'warning'
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { id: 'inicio', label: 'Inicio', icon: '◈' },
      { id: 'dashboard', label: 'Dashboard operativo', icon: '◉' },
    ],
  },
  {
    title: 'Catálogos',
    items: [
      { id: 'catalog', label: 'FITs y materiales', icon: '▣' },
      { id: 'collections', label: 'Colecciones', icon: '◆' },
    ],
  },
  {
    title: 'BOM',
    items: [
      { id: 'bom', label: 'Versiones y piezas', icon: '▧' },
      { id: 'forecasts', label: 'Proyecciones por FIT', icon: '▷' },
    ],
  },
  {
    title: 'Planeación',
    items: [
      { id: 'supply', label: 'Necesidad de materiales', icon: '⊞', badge: '3', badgeTone: 'critical' },
      { id: 'inventory', label: 'Inventario', icon: '▥' },
      { id: 'gantt', label: 'GANTT', icon: '▤' },
      { id: 'cronograma', label: 'Cronograma', icon: '▦' },
      { id: 'kardex', label: 'Kardex', icon: '≡', badge: '!', badgeTone: 'warning' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'audit', label: 'Auditoría', icon: '✓' },
    ],
  },
]

export const sectionTitles: Record<AppSection, string> = {
  inicio: 'Inicio',
  dashboard: 'Dashboard operativo',
  catalog: 'FITs, materiales y telas',
  bom: 'BOM · Versiones y piezas',
  forecasts: 'Proyecciones mensuales por FIT',
  supply: 'Necesidad de materiales',
  inventory: 'Inventario de bodega',
  gantt: 'GANTT de materiales',
  cronograma: 'Cronograma',
  kardex: 'Kardex',
  collections: 'Colecciones y vigencias',
  audit: 'Auditoría de cambios',
}
