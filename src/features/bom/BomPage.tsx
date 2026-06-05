import { Badge } from '../../components/Badge'
import { TableShell } from '../../components/TableShell'
import { bomLines } from '../../app/mockData'

export function BomPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">BOM:</span>
        <select className="filter-select">
          <option>Jean skinny mujer</option>
          <option>Camiseta básica hombre</option>
          <option>Gafas urbanas</option>
        </select>
        <select className="filter-select">
          <option>Todas las versiones</option>
          <option>V1 · Color 940-942</option>
          <option>V2 · Color 943-945</option>
        </select>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} type="button">+ Agregar pieza</button>
      </div>

      <TableShell title="Piezas BOM por versión" subtitle="El consumo depende de la versión, no solo del FIT">
        <table>
          <thead>
            <tr>
              <th>FIT</th>
              <th>Versión</th>
              <th>Pieza</th>
              <th>Material</th>
              <th>Piezas/u</th>
              <th>Consumo pieza</th>
              <th>Desperdicio</th>
              <th>Consumo efectivo/u</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {bomLines.map((line) => (
              <tr key={`${line.fit}-${line.version}-${line.piece}`}>
                <td>{line.fit}</td>
                <td>{line.version}</td>
                <td>{line.piece}</td>
                <td>{line.material}</td>
                <td>{line.pieces}</td>
                <td>{line.consumption}</td>
                <td>{line.waste}</td>
                <td>{line.effective}</td>
                <td><Badge>Activo</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Mix porcentual por versión" subtitle="La suma activa por FIT y mes debe ser 100%">
        <table>
          <thead>
            <tr>
              <th>FIT</th>
              <th>Versión</th>
              <th>Rango color</th>
              <th>Tela principal</th>
              <th>Participación</th>
              <th>Vigente desde</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Jean skinny mujer</td><td>V1</td><td>940-942</td><td>Denim azul 12 oz</td><td>30%</td><td>2026-07</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>Jean skinny mujer</td><td>V2</td><td>943-945</td><td>Denim negro</td><td>25%</td><td>2026-07</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>Jean skinny mujer</td><td>V3</td><td>946-948</td><td>Denim claro</td><td>25%</td><td>2026-07</td><td><Badge>Activo</Badge></td></tr>
            <tr><td>Jean skinny mujer</td><td>V4</td><td>949-950</td><td>Denim gris</td><td>20%</td><td>2026-07</td><td><Badge>Activo</Badge></td></tr>
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
