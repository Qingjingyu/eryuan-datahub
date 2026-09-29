import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export function Modal({ open, title, description, onClose, children, footer, className }: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-plum/24 p-4 backdrop-blur-sm">
      <div className={cn('fade-in w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-pop)]', className)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h3 className="font-display text-xl font-semibold text-plum">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-6">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}
