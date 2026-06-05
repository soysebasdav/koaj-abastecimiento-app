import type { AppSection, NavGroup } from '../app/navigation'

type SidebarProps = {
  groups: NavGroup[]
  activeSection: AppSection
  onSelect: (section: AppSection) => void
}

export function Sidebar({ groups, activeSection, onSelect }: SidebarProps) {
  return (
    <nav id="sidebar">
      <div className="sidebar-logo">
        <div className="brand">KOAJ</div>
        <div className="sub">Planeación de Abastecimiento</div>
      </div>

      {groups.map((group) => (
        <div key={group.title}>
          <div className="sidebar-section">{group.title}</div>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? (
                <span className={`nav-badge ${item.badgeTone === 'warning' ? 'warn' : ''}`}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="user-info">
          <div className="user-avatar">SG</div>
          <div>
            <div className="user-name">Sebastián González</div>
            <div className="user-role">Analista Abastecimiento</div>
          </div>
        </div>
      </div>
    </nav>
  )
}
