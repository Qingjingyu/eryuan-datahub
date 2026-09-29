import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BadgeCheck, CircleCheck, Database, Filter, FolderCheck, PackageCheck, RefreshCw, Search, ServerCog } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorState } from '@/components/data/States'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber, statusLabel } from '@/lib/utils'
import type { Asset } from '@/lib/types'

const statuses = ['cleaned', 'waiting_review', 'approved', 'indexed', 'serving']
const statusLabels: Record<string, string> = {
  cleaned: '清洗完成',
  waiting_review: '待审核',
  approved: 'Approved',
  indexed: 'Indexed',
  serving: 'Serving',
}

function ProcessedStatusChip({ value }: { value: string }) {
  const attention = value === 'waiting_review'
  const active = value === 'serving' || value === 'approved' || value === 'indexed'
  const style = attention
    ? { color: '#92400e', background: '#fef3c7', borderColor: '#fde68a' }
    : active
      ? { color: '#ffffff', background: '#0f766e', borderColor: '#0f766e' }
      : { color: '#0f766e', background: '#ccfbf1', borderColor: '#99f6e4' }
  return <span className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium" style={style}>{statusLabels[value] || statusLabel(value)}</span>
}

function MetricCard({ label, value, hint, icon: Icon, emphasis = false }: {
  label: string
  value: number
  hint: string
  icon: typeof PackageCheck
  emphasis?: boolean
}) {
  return (
    <Card className={emphasis ? 'border-plum/25 bg-gradient-to-br from-plum-soft/90 to-surface' : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl leading-none font-semibold text-plum">{value}</p>
            <p className="mt-3 text-xs leading-5 text-muted">{hint}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-plum-soft text-plum"><Icon className="size-5" /></span>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProcessedDataPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [businessLine, setBusinessLine] = useState('')
  const [rowAction, setRowAction] = useState<{ assetId: string; action: 'index' | 'serve' } | null>(null)

  const assetsQuery = useQuery({ queryKey: ['assets', 'processed'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])

  const processedAssets = useMemo(
    () => assets.filter((asset) => statuses.includes(asset.status)),
    [assets],
  )
  const counts = useMemo(() => {
    const count = (value: string) => processedAssets.filter((asset) => asset.status === value).length
    return {
      total: assets.length,
      processed: processedAssets.length,
      cleaned: count('cleaned'),
      review: count('waiting_review'),
      approved: count('approved'),
      indexed: count('indexed'),
      serving: count('serving'),
      failed: assets.filter((asset) => asset.index_status === 'failed').length,
    }
  }, [assets, processedAssets])

  const businessLines = useMemo(() => [...new Set(assets.map((asset) => asset.business_line))], [assets])
  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return processedAssets
      .filter((asset) => !status || asset.status === status)
      .filter((asset) => !businessLine || asset.business_line === businessLine)
      .filter((asset) => !keyword || [asset.title, asset.asset_id, asset.owner, asset.summary || '', ...(asset.tags ?? [])].join(' ').toLowerCase().includes(keyword))
  }, [processedAssets, query, status, businessLine])

  const actionMutation = useMutation({
    mutationFn: (input: { assetId: string; action: 'index' | 'serve' }) => datahubApi.action(input.assetId, input.action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setRowAction(null)
    },
    onError: () => setRowAction(null),
  })

  const pipelineTotal = counts.cleaned + counts.review + counts.approved + counts.indexed + counts.serving
  const completed = counts.approved + counts.indexed + counts.serving
  const blockers = [
    { key: 'review', label: '等待人审', count: counts.review, description: 'Approved 前不能进入可信知识服务。' },
    { key: 'failed', label: '索引失败', count: counts.failed, description: '资产已清洗，但还没有成功进入检索链路。' },
    { key: 'empty-chunks', label: '通过但缺 Chunk', count: assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status) && asset.chunk_count === 0).length, description: '这些资产可能无法返回有效检索结果。' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="处理后数据 / 数据资产"
        description="这里集中查看清洗、审核、索引和服务化成果，优先暴露阻塞点和可执行操作。"
        meta={(
          <>
            <Badge tone="plum">{counts.total} 项全库</Badge>
            <Badge tone="neutral">{counts.processed} 项处理后</Badge>
            <Badge tone="danger">{counts.failed} 项索引失败</Badge>
          </>
        )}
        actions={<Button variant="primary" onClick={() => assetsQuery.refetch()} loading={assetsQuery.isFetching}><RefreshCw className="size-4" />刷新资产</Button>}
      />

      {assetsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-[24px] border border-line bg-surface" />)}
        </div>
      ) : assetsQuery.error ? (
        <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="处理后总数" value={counts.processed} hint={`全生命周期 ${counts.total} 项`} icon={PackageCheck} emphasis />
            <MetricCard label="清洗完成" value={counts.cleaned} hint="等待进入审核" icon={FolderCheck} />
            <MetricCard label="待审核" value={counts.review} hint="阻塞可信发布" icon={AlertTriangle} />
            <MetricCard label="Approved / Indexed" value={counts.approved + counts.indexed} hint={`${counts.approved} Approved · ${counts.indexed} Indexed`} icon={BadgeCheck} />
            <MetricCard label="Serving" value={counts.serving} hint="已进入服务层" icon={ServerCog} />
          </section>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>处理后生命周期进度</CardTitle>
                <CardDescription>Approved、Indexed、Serving 视为已完成；清洗和审核仍在推进。</CardDescription>
              </div>
              <span className="font-display text-2xl font-semibold text-plum">{pipelineTotal ? Math.round((completed / pipelineTotal) * 100) : 0}%</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-line">
                {pipelineTotal ? (
                  <>
                    <div style={{ width: `${(counts.cleaned / pipelineTotal) * 100}%`, backgroundColor: '#ccfbf1' }} />
                    <div style={{ width: `${(counts.review / pipelineTotal) * 100}%`, backgroundColor: '#d97706' }} />
                    <div style={{ width: `${(counts.approved / pipelineTotal) * 100}%`, backgroundColor: '#0d9488' }} />
                    <div style={{ width: `${(counts.indexed / pipelineTotal) * 100}%`, backgroundColor: '#0f766e' }} />
                    <div style={{ width: `${(counts.serving / pipelineTotal) * 100}%`, backgroundColor: '#134e4a' }} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {statuses.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 text-xs text-muted">
                    <ProcessedStatusChip value={item} />
                    {item === 'cleaned' ? counts.cleaned : item === 'waiting_review' ? counts.review : item === 'approved' ? counts.approved : item === 'indexed' ? counts.indexed : counts.serving}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-3">
            {blockers.map((item) => (
              <Card key={item.key} className={item.count ? 'border-warning/30' : undefined}>
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-plum">
                      {item.count ? <AlertTriangle className="size-4 text-warning" /> : <CircleCheck className="size-4 text-plum" />}
                      {item.label}
                    </span>
                    <span className={item.count ? 'font-display text-2xl font-semibold text-warning' : 'font-display text-2xl font-semibold text-plum'}>{item.count}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted">{item.description}</p>
                  {item.key === 'review' && item.count ? <Link to="/review" className="text-sm font-medium text-plum hover:underline">前往审核中心 →</Link> : null}
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>处理后资产列表</CardTitle>
            <CardDescription>列表按状态和业务线筛选；Approved 后可直接入索引，Indexed 后可发布服务。</CardDescription>
          </div>
          <Badge tone="plum">{rows.length} / {counts.processed}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_170px_170px_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="搜索标题、asset_id、负责人、摘要或标签" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </Select>
            <Select value={businessLine} onChange={(event) => setBusinessLine(event.target.value)}>
              <option value="">全部业务线</option>
              {businessLines.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Button variant="outline" onClick={() => { setQuery(''); setStatus(''); setBusinessLine('') }}><Filter className="size-4" />重置</Button>
          </div>

          {assetsQuery.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-panel" />)}</div>
          ) : assetsQuery.error ? (
            <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无符合条件的处理后数据" description="调整筛选条件，或先完成解析、清洗和审核流程。" action={<Button variant="outline" onClick={() => { setQuery(''); setStatus(''); setBusinessLine('') }}>重置筛选</Button>} />
          ) : (
            <TableShell>
              <Table>
                <thead>
                  <tr><Th>资产</Th><Th>业务线</Th><Th>负责人</Th><Th>状态</Th><Th className="w-28">Chunk</Th><Th className="w-40">更新时间</Th><Th className="w-44" /></tr>
                </thead>
                <tbody>
                  {rows.map((asset: Asset) => {
                    const failed = asset.index_status === 'failed'
                    return (
                      <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
                        <Td>
                          <Link to={`/catalog/${asset.asset_id}`} className="line-clamp-1 font-medium text-plum hover:underline">{asset.title}</Link>
                          <div className="mt-1 font-mono text-xs text-muted">{asset.asset_id}</div>
                        </Td>
                        <Td>{asset.business_line}</Td>
                        <Td>{asset.owner}</Td>
                        <Td>
                          <ProcessedStatusChip value={asset.status} />
                          {failed ? <div className="mt-1 text-xs text-danger">索引失败</div> : null}
                        </Td>
                        <Td>{formatNumber(asset.chunk_count)}</Td>
                        <Td className="text-muted">{formatDate(asset.updated_at)}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-2">
                            {asset.status === 'waiting_review' ? (
                              <Link to="/review" className="inline-flex h-8 items-center rounded-full border border-line/90 bg-surface px-3 text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-plum/25 hover:bg-panel hover:text-plum">去审核</Link>
                            ) : asset.status === 'approved' || failed ? (
                              <Button
                                size="sm"
                                loading={actionMutation.isPending && rowAction?.assetId === asset.asset_id && rowAction.action === 'index'}
                                onClick={() => { setRowAction({ assetId: asset.asset_id, action: 'index' }); actionMutation.mutate({ assetId: asset.asset_id, action: 'index' }) }}
                              >
                                <Database className="size-4" />入索引
                              </Button>
                            ) : asset.status === 'indexed' ? (
                              <Button
                                size="sm"
                                loading={actionMutation.isPending && rowAction?.assetId === asset.asset_id && rowAction.action === 'serve'}
                                onClick={() => { setRowAction({ assetId: asset.asset_id, action: 'serve' }); actionMutation.mutate({ assetId: asset.asset_id, action: 'serve' }) }}
                              >
                                <ServerCog className="size-4" />发布
                              </Button>
                            ) : null}
                            <Link to={`/catalog/${asset.asset_id}`} className="inline-flex h-8 items-center rounded-full border border-line/90 bg-surface px-3 text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-plum/25 hover:bg-panel hover:text-plum">查看</Link>
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableShell>
          )}

          {actionMutation.error ? (
            <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
              {actionMutation.error instanceof Error ? actionMutation.error.message : '操作失败'}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
