import type { AppSection, NavGroup } from '../app/navigation'

type SidebarProps = {
  groups: NavGroup[]
  activeSection: AppSection
  onSelect: (section: AppSection) => void
  userEmail: string
  onSignOut: () => Promise<void>
}

export function Sidebar({ groups, activeSection, onSelect, userEmail, onSignOut }: SidebarProps) {
  const initials = userEmail.slice(0, 2).toUpperCase()

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
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{userEmail}</div>
            <div className="user-role">Usuario autenticado</div>
          </div>
        </div>

        <button className="sidebar-signout" type="button" onClick={() => void onSignOut()}>
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
