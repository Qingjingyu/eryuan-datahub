import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, TableHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-12 whitespace-nowrap border-b border-line bg-panel/80 px-5 text-xs font-semibold uppercase tracking-wide text-muted', className)} {...props} />
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-14 border-b border-line/70 px-5 align-middle text-sm text-ink', className)} {...props} />
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]', className)}>{children}</div>
}
