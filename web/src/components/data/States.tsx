import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export function LoadingState({ label = '数据加载中', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" />{label}</div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-2xl bg-panel" style={{ animationDelay: `${index * 80}ms` }} />
        ))}
      </CardContent>
    </Card>
  )
}

export function EmptyState({ title = '暂无数据', description = '当前筛选或数据源没有可展示内容。', action }: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Card className="border-dashed bg-panel/70">
      <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-plum-soft text-plum"><Inbox className="size-6" /></div>
        <h3 className="font-display text-lg font-semibold text-plum">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : '发生未知错误'
  return (
    <Card className="border-danger/25">
      <CardContent className="flex min-h-44 flex-col items-start justify-center gap-3">
        <div className="flex items-center gap-2 text-danger"><AlertTriangle className="size-5" /><span className="font-medium">数据加载失败</span></div>
        <p className="text-sm leading-6 text-muted">{message}</p>
        {onRetry ? <Button variant="outline" onClick={onRetry}><RefreshCw className="size-4" />重试</Button> : null}
      </CardContent>
    </Card>
  )
}

export function QueryBoundary({ loading, error, empty, retry, skeleton, children }: {
  loading: boolean
  error: unknown
  empty?: boolean
  retry?: () => void
  skeleton?: ReactNode
  children: ReactNode
}) {
  if (loading) return <>{skeleton ?? <LoadingState />}</>
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (empty) return <EmptyState />
  return <>{children}</>
}
export { StatCard } from '@/components/data/StatCard'
