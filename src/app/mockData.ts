export const kpis = [
  { label: 'FITs activos', value: '10', sub: 'Colección 2026', tone: 'ok' as const },
  { label: 'Materiales', value: '18', sub: 'telas e insumos' },
  { label: 'Faltantes', value: '3', sub: 'materiales críticos', tone: 'alert' as const },
  { label: 'Riesgo diciembre', value: '4', sub: 'FITs sin cobertura', tone: 'alert' as const },
  { label: 'Proy. venta Dic.', value: '48.200', sub: 'unidades FIT' },
  { label: 'Cambios este mes', value: '12', sub: 'auditados' },
]

export const alerts = [
  {
    fit: 'Jean skinny mujer',
    alert: 'Faltante tela base Denim azul 12 oz',
    month: 'Nov 2026',
    severity: 'Crítico',
  },
  {
    fit: 'Gafas urbanas',
    alert: 'Faltante lente gafas: 1.200 u.',
    month: 'Dic 2026',
    severity: 'Crítico',
  },
  {
    fit: 'Chaqueta denim',
    alert: 'Lead time supera ventana de cierre',
    month: 'Oct 2026',
    severity: 'Atención',
  },
  {
    fit: 'Buzo capota',
    alert: 'Sobrestock de algodón jersey',
    month: 'Ago 2026',
    severity: 'Sobrestock',
  },
]

export const fits = [
  {
    code: 'FIT-JEAN-001',
    name: 'Jean skinny mujer',
    silhouette: 'Pantalón jean',
    category: 'Jean',
    versions: 4,
    projectedDecember: 7000,
    status: 'Activo',
  },
  {
    code: 'FIT-CAM-002',
    name: 'Camiseta básica hombre',
    silhouette: 'Camiseta',
    category: 'Punto',
    versions: 3,
    projectedDecember: 9200,
    status: 'Activo',
  },
  {
    code: 'FIT-GAF-003',
    name: 'Gafas urbanas',
    silhouette: 'Gafas',
    category: 'Accesorios',
    versions: 2,
    projectedDecember: 4800,
    status: 'Activo',
  },
]

export const materials = [
  {
    code: 'MAT-TEL-001',
    name: 'Denim azul 12 oz',
    type: 'Tela',
    unit: 'metro',
    composition: '98% algodón · 2% elastano',
    leadTime: '45 días',
    status: 'Crítico',
  },
  {
    code: 'MAT-TEL-002',
    name: 'Tela bolsillo blanca',
    type: 'Tela bolsillo',
    unit: 'metro',
    composition: '65% poliéster · 35% algodón',
    leadTime: '30 días',
    status: 'Atención',
  },
  {
    code: 'MAT-INS-003',
    name: 'Botón metálico KOAJ',
    type: 'Botón',
    unit: 'unidad',
    composition: 'No aplica',
    leadTime: '20 días',
    status: 'Sin riesgo',
  },
  {
    code: 'MAT-INS-004',
    name: 'Lente gafas',
    type: 'Accesorio',
    unit: 'unidad',
    composition: 'No aplica',
    leadTime: '75 días',
    status: 'Crítico',
  },
]

export const bomLines = [
  {
    fit: 'Jean skinny mujer',
    version: 'V1 · Color 940-942',
    piece: 'Base',
    material: 'Denim azul 12 oz',
    pieces: 1,
    consumption: '1,20 m',
    waste: '3%',
    effective: '1,236 m',
  },
  {
    fit: 'Jean skinny mujer',
    version: 'V1 · Color 940-942',
    piece: 'Bolsillo',
    material: 'Tela bolsillo blanca',
    pieces: 4,
    consumption: '0,08 m',
    waste: '2%',
    effective: '0,326 m',
  },
  {
    fit: 'Jean skinny mujer',
    version: 'V1 · Color 940-942',
    piece: 'Botón',
    material: 'Botón metálico KOAJ',
    pieces: 2,
    consumption: '1 und',
    waste: '0%',
    effective: '2 und',
  },
]

export const forecastRows = [
  {
    fit: 'Jean skinny mujer',
    category: 'Jean',
    months: [4200, 4300, 4500, 4700, 5000, 5200, 5400, 5600, 5900, 6200, 6600, 7000],
  },
  {
    fit: 'Camiseta básica hombre',
    category: 'Punto',
    months: [6100, 6200, 6400, 6500, 6900, 7100, 7300, 7600, 8000, 8400, 8800, 9200],
  },
  {
    fit: 'Gafas urbanas',
    category: 'Accesorios',
    months: [2300, 2400, 2600, 2800, 3000, 3200, 3400, 3600, 3900, 4200, 4500, 4800],
  },
]

export const materialRequirements = [
  {
    material: 'Denim azul 12 oz',
    month: 'Dic 2026',
    required: '8.652 m',
    available: '6.900 m',
    pending: '1.752 m',
    status: 'Crítico',
  },
  {
    material: 'Tela bolsillo blanca',
    month: 'Dic 2026',
    required: '2.282 m',
    available: '2.000 m',
    pending: '282 m',
    status: 'Atención',
  },
  {
    material: 'Botón metálico KOAJ',
    month: 'Dic 2026',
    required: '14.000 und',
    available: '18.000 und',
    pending: '0',
    status: 'Sin riesgo',
  },
  {
    material: 'Lente gafas',
    month: 'Dic 2026',
    required: '9.600 und',
    available: '8.400 und',
    pending: '1.200 und',
    status: 'Crítico',
  },
]

export const kardexRows = [
  {
    controlDate: '2026-10-07',
    material: 'Denim azul 12 oz',
    totalBodega: '6.900 m',
    pedido: '2.000 m',
    transito: '1.500 m',
    consumoProjected: '2.163 m',
    entregaProduccion: '4.326 m',
    stockSeguridad: '1.000 m',
    industrializacion: '800 m',
    inventarioFinal: '4.074 m',
    status: 'Atención',
  },
  {
    controlDate: '2026-10-14',
    material: 'Denim azul 12 oz',
    totalBodega: '4.074 m',
    pedido: '2.000 m',
    transito: '1.500 m',
    consumoProjected: '2.163 m',
    entregaProduccion: '4.326 m',
    stockSeguridad: '1.000 m',
    industrializacion: '800 m',
    inventarioFinal: '1.248 m',
    status: 'Crítico',
  },
]

export const auditRows = [
  {
    date: '2026-07-15 09:42',
    user: 'Sebastián González',
    module: 'BOM',
    field: 'Consumo base',
    before: '1,15 m',
    after: '1,20 m',
    reason: 'Ajuste por cierre de colección',
    type: 'future_change',
  },
  {
    date: '2026-07-18 14:10',
    user: 'Planeación',
    module: 'Mix versiones',
    field: 'Participación V2',
    before: '25%',
    after: '30%',
    reason: 'Cambio comercial desde septiembre',
    type: 'month_forward_change',
  },
]
