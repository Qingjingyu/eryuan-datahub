import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions, meta, className }: {
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight text-plum">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-[15px] leading-7 text-muted">{description}</p> : null}
        {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
