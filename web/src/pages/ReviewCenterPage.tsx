import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCheck, ClipboardCheck, Eye, MessageSquareWarning, RefreshCw, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorState } from '@/components/data/States'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, statusLabel } from '@/lib/utils'
import type { Asset } from '@/lib/types'

function ReviewChip({ value }: { value: 'pending' | 'approved' | 'rejected' }) {
  const style = value === 'pending'
    ? { color: '#92400e', background: '#fef3c7', borderColor: '#fde68a' }
    : value === 'rejected'
      ? { color: '#b91c1c', background: '#fee2e2', borderColor: '#fecaca' }
      : { color: '#ffffff', background: '#0f766e', borderColor: '#0f766e' }
  const label = value === 'pending' ? '待审核' : value === 'approved' ? '已通过' : '已驳回'
  return <span className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium" style={style}>{label}</span>
}

function MetricCard({ label, value, hint, icon: Icon, emphasis = false }: {
  label: string
  value: number
  hint: string
  icon: typeof ClipboardCheck
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

export function ReviewCenterPage() {
  const queryClient = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [selected, setSelected] = useState<Asset | null>(null)
  const [comment, setComment] = useState('')
  const [q, setQ] = useState('')
  const [businessLine, setBusinessLine] = useState('')
  const [visibility, setVisibility] = useState('')
  const [recordFilter, setRecordFilter] = useState('')

  const pendingQuery = useQuery({ queryKey: ['assets', 'review-pending'], queryFn: () => datahubApi.assets({ status: 'waiting_review', page_size: 100 }) })
  const assetsQuery = useQuery({ queryKey: ['assets', 'review-all'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const reviewsQuery = useQuery({ queryKey: ['reviews'], queryFn: () => datahubApi.reviews() })
  const optionsQuery = useQuery({ queryKey: ['options'], queryFn: () => datahubApi.options() })

  const reviewMutation = useMutation({
    mutationFn: () => datahubApi.action(selected!.asset_id, action!, { comment: comment.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      setSelected(null)
      setAction(null)
      setComment('')
    },
  })

  const loading = pendingQuery.isLoading || assetsQuery.isLoading || reviewsQuery.isLoading
  const error = pendingQuery.error || assetsQuery.error || reviewsQuery.error
  const retry = () => { pendingQuery.refetch(); assetsQuery.refetch(); reviewsQuery.refetch() }

  const pending = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data])
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data])
  const approvals = reviews.filter((item) => item.action === 'approve').length
  const rejections = reviews.filter((item) => item.action === 'reject').length
  const readyAssets = assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status)).length
  const reviewTotal = pending.length + approvals + rejections
  const reviewProgress = approvals + rejections

  const blockers = useMemo(() => [
    {
      key: 'missing-summary',
      label: '缺摘要待审',
      count: pending.filter((asset) => !asset.summary && !asset.description).length,
      description: '没有业务摘要的资料缺少人审依据，建议先补齐或驳回。',
    },
    {
      key: 'public',
      label: '公开可见待审',
      count: pending.filter((asset) => asset.visibility === 'public').length,
      description: '公开资产需要额外确认权限范围和合规表述。',
    },
    {
      key: 'rejected',
      label: '历史驳回',
      count: rejections,
      description: '驳回意见应回流给负责人修正后再提交。',
    },
  ], [pending, rejections])

  const filteredPending = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return pending
      .filter((asset) => !businessLine || asset.business_line === businessLine)
      .filter((asset) => !visibility || asset.visibility === visibility)
      .filter((asset) => !keyword || [asset.title, asset.asset_id, asset.owner, asset.summary || ''].join(' ').toLowerCase().includes(keyword))
  }, [pending, q, businessLine, visibility])

  const filteredReviews = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return reviews
      .filter((item) => !recordFilter || item.action === recordFilter)
      .filter((item) => !keyword || [item.asset_title, item.asset_id, item.reviewer, item.comment].join(' ').toLowerCase().includes(keyword))
  }, [reviews, q, recordFilter])

  const businessLines = useMemo(() => {
    const optionLines = optionsQuery.data?.business_lines ?? []
    const names = new Map(optionLines.map((item) => [item.slug, item.name]))
    assets.forEach((asset) => { if (!names.has(asset.business_line)) names.set(asset.business_line, asset.business_line) })
    return [...names.entries()].map(([slug, name]) => ({ slug, name }))
  }, [assets, optionsQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="审核中心"
        description="审核给知识上保险。通过人审后资产才能进入 Approved、Indexed 和 Serving。"
        meta={(
          <>
            <Badge tone="warning">{pending.length} 项待审</Badge>
            <Badge tone="success">{approvals} 项通过</Badge>
            <Badge tone="danger">{rejections} 项驳回</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="outline" onClick={retry} loading={pendingQuery.isFetching || reviewsQuery.isFetching || assetsQuery.isFetching}><RefreshCw className="size-4" />刷新审核</Button>
            <Button variant="primary" disabled={pending.length === 0} onClick={() => { setSelected(pending[0]); setAction('approve') }}><ClipboardCheck className="size-4" />审核第一项</Button>
          </>
        )}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-[24px] border border-line bg-surface" />)}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="待审核资产" value={pending.length} hint="处理中的人审队列" icon={ClipboardCheck} emphasis />
            <MetricCard label="累计通过" value={approvals} hint="写入 review_logs 的通过记录" icon={ShieldCheck} />
            <MetricCard label="累计驳回" value={rejections} hint="需要负责人修正后重新提交" icon={ShieldX} />
            <MetricCard label="全库可用资产" value={readyAssets} hint={`生命周期总数 ${assets.length}`} icon={Eye} />
          </section>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>审核完成度</CardTitle>
                <CardDescription>以进入审核队列的资产计算：已形成通过或驳回结论的比例。</CardDescription>
              </div>
              <span className="font-display text-2xl font-semibold text-plum">{reviewTotal ? Math.round((reviewProgress / reviewTotal) * 100) : 0}%</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-line">
                {reviewTotal ? (
                  <>
                    <div style={{ width: `${(approvals / reviewTotal) * 100}%`, backgroundColor: '#0f766e' }} />
                    <div style={{ width: `${(rejections / reviewTotal) * 100}%`, backgroundColor: '#d1568a' }} />
                    <div style={{ width: `${(pending.length / reviewTotal) * 100}%`, backgroundColor: '#d97706' }} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <ReviewChip value="approved" /><span className="text-sm text-muted">{approvals}</span>
                <ReviewChip value="rejected" /><span className="text-sm text-muted">{rejections}</span>
                <ReviewChip value="pending" /><span className="text-sm text-muted">{pending.length}</span>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-3">
            {blockers.map((item) => (
              <Card key={item.key} className={item.count ? 'border-warning/30' : undefined}>
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-plum">
                      {item.count ? <AlertTriangle className="size-4 text-warning" /> : <ShieldCheck className="size-4 text-plum" />}
                      {item.label}
                    </span>
                    <span className={item.count ? 'font-display text-2xl font-semibold text-warning' : 'font-display text-2xl font-semibold text-plum'}>{item.count}</span>
                  </div>
                  <p className="text-sm leading-6 text-muted">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>待审核队列</CardTitle>
            <CardDescription>逐项检查来源、摘要、合规表述、标签和可见范围。审核意见必填。</CardDescription>
          </div>
          <Badge tone="plum">{filteredPending.length} 项</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_170px_170px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="搜索标题、asset_id、负责人或摘要" value={q} onChange={(event) => setQ(event.target.value)} />
            </div>
            <Select value={businessLine} onChange={(event) => setBusinessLine(event.target.value)}>
              <option value="">全部业务线</option>
              {businessLines.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </Select>
            <Select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="">全部可见性</option>
              <option value="public">公开</option>
              <option value="business">业务线内</option>
              <option value="private">私有</option>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setQ(''); setBusinessLine(''); setVisibility('') }}>重置筛选</Button>

          {pendingQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-44 animate-pulse rounded-[24px] bg-panel" />)}</div>
          ) : pendingQuery.error ? (
            <ErrorState error={pendingQuery.error} onRetry={() => pendingQuery.refetch()} />
          ) : filteredPending.length === 0 ? (
            <EmptyState title="队列已清空" description="当前筛选下没有待审核资产。" action={<Button variant="outline" onClick={() => { setQ(''); setBusinessLine(''); setVisibility('') }}>重置筛选</Button>} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredPending.map((asset) => {
                const missingSummary = !asset.summary && !asset.description
                return (
                  <Card key={asset.asset_id} className={missingSummary ? 'border-warning/30' : undefined}>
                    <CardContent>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 font-display text-xl font-semibold text-plum">{asset.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{asset.summary || asset.description || '缺少业务摘要，建议补充后再通过。'}</p>
                        </div>
                        <ReviewChip value="pending" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="plum">{asset.asset_id}</Badge>
                        <Badge>{asset.business_line}</Badge>
                        <Badge>{asset.owner || '未填写负责人'}</Badge>
                        <Badge tone={asset.visibility === 'public' ? 'warning' : 'neutral'}>{asset.visibility}</Badge>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button variant="primary" onClick={() => { setSelected(asset); setAction('approve') }}><CheckCheck className="size-4" />通过</Button>
                        <Button variant="danger" onClick={() => { setSelected(asset); setAction('reject') }}><ShieldX className="size-4" />驳回</Button>
                        <Link to={`/catalog/${asset.asset_id}`} className="inline-flex h-10 items-center rounded-full border border-line/90 bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:border-plum/25 hover:bg-panel hover:text-plum">查看详情</Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>审核记录</CardTitle>
            <CardDescription>所有通过和驳回都会留下 reviewer、comment 和状态变化。</CardDescription>
          </div>
          <Badge tone="neutral">{filteredReviews.length} 条</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select className="w-40" value={recordFilter} onChange={(event) => setRecordFilter(event.target.value)}>
              <option value="">全部记录</option>
              <option value="approve">通过</option>
              <option value="reject">驳回</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setRecordFilter('') }}>重置记录</Button>
          </div>
          {reviewsQuery.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-panel" />)}</div>
          ) : reviewsQuery.error ? (
            <ErrorState error={reviewsQuery.error} onRetry={() => reviewsQuery.refetch()} />
          ) : filteredReviews.length === 0 ? (
            <EmptyState title="暂无审核记录" description="完成第一笔通过或驳回后会在这里留痕。" />
          ) : (
            <TableShell>
              <Table>
                <thead><tr><Th>资产</Th><Th>动作</Th><Th>Reviewer</Th><Th>意见</Th><Th>状态变化</Th><Th>时间</Th></tr></thead>
                <tbody>
                  {filteredReviews.map((review) => (
                    <tr key={review.id} className="transition-colors hover:bg-panel/70">
                      <Td>
                        <Link to={`/catalog/${review.asset_id}`} className="line-clamp-1 font-medium text-plum hover:underline">{review.asset_title}</Link>
                        <div className="mt-1 font-mono text-xs text-muted">{review.asset_id}</div>
                      </Td>
                      <Td><ReviewChip value={review.action === 'approve' ? 'approved' : 'rejected'} /></Td>
                      <Td>{review.reviewer}</Td>
                      <Td><div className="max-w-80 text-sm leading-6 text-muted">{review.comment || '—'}</div></Td>
                      <Td className="font-mono text-xs">{statusLabel(review.before_status || '')} → {statusLabel(review.after_status)}</Td>
                      <Td className="text-muted">{formatDate(review.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selected && action)}
        title={action === 'approve' ? '通过审核' : '驳回资产'}
        description={selected ? `${selected.title} · ${selected.asset_id}` : ''}
        onClose={() => { setSelected(null); setAction(null); setComment('') }}
        footer={(
          <>
            <Button onClick={() => { setSelected(null); setAction(null); setComment('') }}>取消</Button>
            <Button
              variant={action === 'approve' ? 'primary' : 'danger'}
              disabled={!comment.trim()}
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              确认{action === 'approve' ? '通过' : '驳回'}
            </Button>
          </>
        )}
      >
        <Field label={action === 'approve' ? '审核意见' : '驳回原因'} hint={action === 'approve' ? '说明通过依据。' : '请指出需要修改的内容。'}>
          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={action === 'approve' ? '例如：来源完整，合规表述已确认。' : '例如：第 3 页功效表述缺少依据，需要补充临床或法规来源。'} />
        </Field>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-panel p-4 text-sm text-muted">
          <MessageSquareWarning className="size-4 text-plum" />提交后写入 review_logs 和 audit_logs。
        </div>
        {reviewMutation.error ? (
          <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {reviewMutation.error instanceof Error ? reviewMutation.error.message : '审核提交失败'}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
