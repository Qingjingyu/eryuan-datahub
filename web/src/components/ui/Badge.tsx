import type { HTMLAttributes } from 'react'
import { cn, statusLabel } from '@/lib/utils'

type Tone = 'neutral' | 'plum' | 'success' | 'warning' | 'info' | 'danger' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-background text-muted border-line',
  plum: 'bg-plum text-white border-plum',
  success: 'bg-success/12 text-[#2b7a50] border-success/22',
  warning: 'bg-warning/12 text-[#9a5605] border-warning/22',
  info: 'bg-info/10 text-[#3c639f] border-info/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  violet: 'bg-violet/10 text-violet border-violet/20',
}

export function Badge({ className, tone = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium', tones[tone], className)} {...props} />
}

const statusTones: Record<string, Tone> = {
  raw: 'neutral', parsed: 'info', cleaned: 'violet', waiting_review: 'warning',
  approved: 'success', indexed: 'plum', serving: 'success', rejected: 'danger',
  archived: 'neutral', queued: 'neutral', running: 'info', success: 'success', failed: 'danger',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTones[status] ?? 'neutral'} className={className}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current opacity-70" />
      {statusLabel(status)}
    </Badge>
  )
}
