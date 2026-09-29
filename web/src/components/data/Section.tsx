import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Section({ title, description, actions, children, className }: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-plum">{title}</h2>
          {description ? <p className="mt-1 max-w-4xl text-sm leading-6 text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
