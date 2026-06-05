import type { ReactNode } from 'react'

type DrawerProps = {
  isOpen: boolean
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export function Drawer({ isOpen, title, subtitle, children, footer, onClose }: DrawerProps) {
  if (!isOpen) return null

  return (
    <div className="drawer-overlay" role="presentation">
      <button className="drawer-backdrop" type="button" aria-label="Cerrar panel" onClick={onClose} />
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-header">
          <div>
            <h2 id="drawer-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="drawer-body">{children}</div>

        {footer ? <footer className="drawer-footer">{footer}</footer> : null}
      </aside>
    </div>
  )
}
