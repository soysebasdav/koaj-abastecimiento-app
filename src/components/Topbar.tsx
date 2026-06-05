import type { AppSection } from '../app/navigation'

type TopbarProps = {
  title: string
  onSelect: (section: AppSection) => void
  onSignOut: () => Promise<void>
}

export function Topbar({ title, onSelect, onSignOut }: TopbarProps) {
  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <span className="topbar-breadcrumb">KOAJ · Abastecimiento · BOM operativo</span>

      <div className="topbar-actions">
        <button className="btn btn-ghost" type="button" onClick={() => onSelect('catalog')}>
          + Nuevo FIT
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => onSelect('supply')}>
          Ver necesidad
        </button>
        <button className="btn btn-primary" type="button" onClick={() => onSelect('forecasts')}>
          + Nueva proyección
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => void onSignOut()}>
          Salir
        </button>
      </div>
    </header>
  )
}
