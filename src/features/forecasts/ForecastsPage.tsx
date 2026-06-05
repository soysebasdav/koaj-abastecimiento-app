import { TableShell } from '../../components/TableShell'
import { forecastRows } from '../../app/mockData'

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function ForecastsPage() {
  return (
    <>
      <div className="filter-bar">
        <span className="filter-label">Proyección:</span>
        <select className="filter-select">
          <option>Colección 2026</option>
        </select>
        <select className="filter-select">
          <option>Todos los FITs</option>
          <option>Jean</option>
          <option>Punto</option>
          <option>Accesorios</option>
        </select>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} type="button">Editar desde mes</button>
      </div>

      <TableShell title="Proyección mensual por FIT" subtitle="La proyección se define por FIT; las versiones se calculan por mix">
        <table>
          <thead>
            <tr>
              <th>FIT</th>
              <th>Categoría</th>
              {months.map((month) => <th key={month}>{month}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {forecastRows.map((row) => (
              <tr key={row.fit}>
                <td>{row.fit}</td>
                <td>{row.category}</td>
                {row.months.map((value, index) => (
                  <td key={`${row.fit}-${months[index]}`}>{value.toLocaleString('es-CO')}</td>
                ))}
                <td>{row.months.reduce((acc, current) => acc + current, 0).toLocaleString('es-CO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </>
  )
}
