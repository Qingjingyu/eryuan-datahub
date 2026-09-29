import type { ComponentType, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export function StatCard({ label, value, unit, icon: Icon, trend, tone = 'plum', footer }: {
  label: string
  value: string | number
  unit?: string
  icon?: ComponentType<{ className?: string }>
  trend?: string
  tone?: 'plum' | 'success' | 'warning' | 'info' | 'violet'
  footer?: ReactNode
}) {
  const tones = {
    plum: 'from-plum/16 to-plum/0 text-plum',
    success: 'from-success/18 to-success/0 text-[#2b7a50]',
    warning: 'from-warning/16 to-warning/0 text-[#9a5605]',
    info: 'from-info/16 to-info/0 text-[#3c639f]',
    violet: 'from-violet/16 to-violet/0 text-violet',
  }
  return (
    <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
      <div className={cn('pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-gradient-to-b opacity-70 blur-2xl transition-opacity group-hover:opacity-100', tones[tone])} />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-muted">{label}</p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-display text-[32px] leading-none font-semibold tracking-tight text-plum">{value}</span>
              {unit ? <span className="text-sm text-muted">{unit}</span> : null}
            </div>
          </div>
          {Icon ? <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-gradient-to-br shadow-sm', tones[tone])}><Icon className="size-5" /></div> : null}
        </div>
        {trend ? <p className="mt-4 line-clamp-2 text-xs leading-5 text-muted">{trend}</p> : null}
      </div>
      {footer ? <div className="relative border-t border-line/80 bg-panel/50 px-5 py-3 text-xs text-muted">{footer}</div> : (
        <ArrowUpRight className="absolute right-5 top-5 size-0 text-plum/40 transition-all group-hover:size-4" />
      )}
    </Card>
  )
}
