import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'

export function CollectionsPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Vigencia:</span>
        <button className="filter-chip active" type="button">2026</button>
        <button className="filter-chip" type="button">Colección activa</button>
        <button className="filter-chip" type="button">Cambios desde mes</button>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} type="button">+ Nueva colección</button>
      </div>

      <TableShell title="Colecciones y vigencias" subtitle="Los cambios de colección no borran historia; crean nueva vigencia">
        <table>
          <thead>
            <tr>
              <th>Colección</th>
              <th>Nombre</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Regla</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>COL-2026-01</td>
              <td>Base 2026</td>
              <td>2026-01</td>
              <td>2026-12</td>
              <td>Mix definido por colección; casos especiales por mes</td>
              <td><Badge>Activo</Badge></td>
            </tr>
            <tr>
              <td>COL-2026-CIERRE-JUL</td>
              <td>Cierre colección julio</td>
              <td>2026-07</td>
              <td>2026-12</td>
              <td>Ajustes desde mes en adelante</td>
              <td><Badge>Atención</Badge></td>
            </tr>
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
