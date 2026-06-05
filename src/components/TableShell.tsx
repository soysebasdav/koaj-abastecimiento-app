import type { ReactNode } from 'react'

type TableShellProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

export function TableShell({ title, subtitle, action, children }: TableShellProps) {
  return (
    <section className="table-wrap">
      <div className="table-header">
        <span className="table-title">{title}</span>
        {subtitle ? <span className="table-subtitle">{subtitle}</span> : null}
        {action ? <div style={{ marginLeft: 'auto' }}>{action}</div> : null}
      </div>
      <div className="table-scroll">{children}</div>
    </section>
  )
}
