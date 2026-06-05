import { useMemo, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import { navGroups, sectionTitles, type AppSection } from './navigation'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { CatalogPage } from '../features/catalog/CatalogPage'
import { BomPage } from '../features/bom/BomPage'
import { ForecastsPage } from '../features/forecasts/ForecastsPage'
import { SupplyPage } from '../features/supply/SupplyPage'
import { KardexPage } from '../features/kardex/KardexPage'
import { CollectionsPage } from '../features/collections/CollectionsPage'
import { AuditPage } from '../features/audit/AuditPage'

type AppLayoutProps = {
  userEmail: string
  onSignOut: () => Promise<void>
}

export function AppLayout({ userEmail, onSignOut }: AppLayoutProps) {
  const [activeSection, setActiveSection] = useState<AppSection>('inicio')

  const title = useMemo(() => sectionTitles[activeSection], [activeSection])

  return (
    <div className="app-shell">
      <Sidebar
        groups={navGroups}
        activeSection={activeSection}
        onSelect={setActiveSection}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />

      <main id="main">
        <Topbar title={title} onSelect={setActiveSection} onSignOut={onSignOut} />

        <div id="content">
          {activeSection === 'inicio' || activeSection === 'dashboard' ? (
            <DashboardPage onNavigate={setActiveSection} />
          ) : null}

          {activeSection === 'catalog' ? <CatalogPage /> : null}
          {activeSection === 'collections' ? <CollectionsPage /> : null}
          {activeSection === 'bom' ? <BomPage /> : null}
          {activeSection === 'forecasts' ? <ForecastsPage /> : null}
          {activeSection === 'supply' ? <SupplyPage /> : null}
          {activeSection === 'kardex' ? <KardexPage /> : null}
          {activeSection === 'audit' ? <AuditPage /> : null}
        </div>
      </main>
    </div>
  )
}
