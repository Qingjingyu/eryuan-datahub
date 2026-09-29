import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const stages = ['raw', 'parsed', 'cleaned', 'waiting_review', 'approved', 'indexed', 'serving'] as const
const stageNames: Record<string, string> = {
  raw: '原始数据', parsed: '解析完成', cleaned: '清洗完成', waiting_review: '待审核',
  approved: 'Approved', indexed: 'Indexed', serving: 'Serving',
}

export function StageFlow({ distribution }: { distribution: Record<string, number> }) {
  const total = stages.reduce((sum, stage) => sum + (distribution[stage] ?? 0), 0)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {stages.map((stage, index) => {
        const value = distribution[stage] ?? 0
        const ratio = total ? Math.round((value / total) * 100) : 0
        const active = value > 0
        return (
          <div key={stage} className="relative rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-mono">{String(index + 1).padStart(2, '0')}</span>
              <span className="font-medium">{value}</span>
            </div>
            <p className="mt-3 text-sm font-medium text-plum">{stageNames[stage]}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
              <div className={cn('h-full rounded-full transition-all', active ? 'bg-plum' : 'bg-muted/30')} style={{ width: `${Math.max(ratio, value ? 8 : 0)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{ratio}%</p>
            {index < stages.length - 1 ? <ArrowRight className="absolute -right-3 top-1/2 hidden size-4 -translate-y-1/2 text-muted xl:block" /> : null}
          </div>
        )
      })}
    </div>
  )
}
