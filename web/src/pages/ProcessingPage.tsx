import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CircleDashed, Cog, Link2, ListRestart, RefreshCw, Search, Timer } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorState } from '@/components/data/States'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, statusLabel } from '@/lib/utils'

const jobTypeLabels: Record<string, string> = {
  parse: '解析',
  clean: '清洗',
  chunk: '分块',
  embed: '向量化',
  index: '入索引',
  serve: '服务发布',
}

function jobTypeLabel(value: string) {
  return jobTypeLabels[value] || value
}

function JobStatusChip({ value }: { value: string }) {
  const failed = value === 'failed'
  const active = value === 'running'
  const waiting = value === 'queued'
  const style = failed
    ? { color: '#b91c1c', background: '#fee2e2', borderColor: '#fecaca' }
    : active || waiting
      ? { color: '#92400e', background: '#fef3c7', borderColor: '#fde68a' }
      : { color: '#ffffff', background: '#0f766e', borderColor: '#0f766e' }
  return (
    <span className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium" style={style}>
      {statusLabel(value)}
    </span>
  )
}

function MetricCard({ label, value, hint, icon: Icon, emphasis = false }: {
  label: string
  value: number
  hint: string
  icon: typeof Cog
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

export function ProcessingPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [jobType, setJobType] = useState('')

  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: () => datahubApi.jobs() })
  const assetsQuery = useQuery({ queryKey: ['assets', 'processing'], queryFn: () => datahubApi.assets({ page_size: 200 }) })

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])
  const loading = jobsQuery.isLoading || assetsQuery.isLoading
  const error = jobsQuery.error || assetsQuery.error
  const retry = () => { jobsQuery.refetch(); assetsQuery.refetch() }

  const jobCounts = useMemo(() => ({
    total: jobs.length,
    running: jobs.filter((job) => job.status === 'running').length,
    queued: jobs.filter((job) => job.status === 'queued').length,
    success: jobs.filter((job) => job.status === 'success').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  }), [jobs])

  const lifecycleCounts = useMemo(() => ({
    raw: assets.filter((asset) => asset.status === 'raw').length,
    processing: assets.filter((asset) => ['parsed', 'cleaned'].includes(asset.status)).length,
    review: assets.filter((asset) => asset.status === 'waiting_review').length,
    ready: assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status)).length,
  }), [assets])

  const failedJobs = useMemo(() => jobs.filter((job) => job.status === 'failed'), [jobs])
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>()
    jobs.forEach((job) => map.set(job.job_type, (map.get(job.job_type) ?? 0) + 1))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return jobs
      .filter((job) => !status || job.status === status)
      .filter((job) => !jobType || job.job_type === jobType)
      .filter((job) => !keyword || [job.job_id, job.asset_id, job.asset_title, job.error_message || ''].join(' ').toLowerCase().includes(keyword))
  }, [jobs, q, status, jobType])

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => {
      const assetId = jobs.find((job) => job.job_id === jobId)?.asset_id
      if (!assetId) throw new Error('找不到任务对应的资产')
      return datahubApi.action(assetId, 'process')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const pipelineTotal = lifecycleCounts.raw + lifecycleCounts.processing + lifecycleCounts.review + lifecycleCounts.ready
  const pipelineProgress = lifecycleCounts.processing + lifecycleCounts.review + lifecycleCounts.ready
  const successRate = jobCounts.success + jobCounts.failed
    ? Math.round((jobCounts.success / (jobCounts.success + jobCounts.failed)) * 100)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="解析与清洗"
        description="Worker 按资产状态执行 parse、clean、chunk、embed 和 index。失败任务保留错误原因，优先处理阻塞点。"
        meta={(
          <>
            <Badge tone="plum">{jobCounts.total} 个任务</Badge>
            <Badge tone="warning">{jobCounts.running + jobCounts.queued} 个未完成</Badge>
            <Badge tone="danger">{jobCounts.failed} 个失败</Badge>
          </>
        )}
        actions={<Button variant="primary" onClick={retry} loading={jobsQuery.isFetching || assetsQuery.isFetching}><RefreshCw className="size-4" />刷新全链路</Button>}
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
            <MetricCard label="任务总数" value={jobCounts.total} hint={`${jobCounts.running} 处理中 · ${jobCounts.queued} 排队`} icon={Cog} emphasis />
            <MetricCard label="处理中" value={jobCounts.running} hint={`${jobCounts.queued} 个任务排队等待`} icon={Timer} />
            <MetricCard label="成功" value={jobCounts.success} hint={`失败后成功率 ${successRate}%`} icon={CheckCircle2} />
            <MetricCard label="失败阻塞" value={jobCounts.failed} hint="需要人工确认或重试" icon={AlertTriangle} />
          </section>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>生命周期状态分布</CardTitle>
                <CardDescription>上半部分是资产进度，下半部分是任务执行结果。</CardDescription>
              </div>
              <span className="font-display text-2xl font-semibold text-plum">{pipelineTotal ? Math.round((pipelineProgress / pipelineTotal) * 100) : 0}%</span>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex h-3 overflow-hidden rounded-full bg-line">
                  {pipelineTotal ? (
                    <>
                      <div style={{ width: `${(lifecycleCounts.raw / pipelineTotal) * 100}%`, backgroundColor: '#ccfbf1' }} />
                      <div style={{ width: `${(lifecycleCounts.processing / pipelineTotal) * 100}%`, backgroundColor: '#0d9488' }} />
                      <div style={{ width: `${(lifecycleCounts.review / pipelineTotal) * 100}%`, backgroundColor: '#d97706' }} />
                      <div style={{ width: `${(lifecycleCounts.ready / pipelineTotal) * 100}%`, backgroundColor: '#0f766e' }} />
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <Badge tone="neutral">待处理 · {lifecycleCounts.raw}</Badge>
                  <Badge tone="plum">处理中 · {lifecycleCounts.processing}</Badge>
                  <Badge tone="warning">待审核 · {lifecycleCounts.review}</Badge>
                  <Badge tone="success">成功 · {lifecycleCounts.ready}</Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex h-3 overflow-hidden rounded-full bg-line">
                  {jobCounts.total ? (
                    <>
                      <div style={{ width: `${(jobCounts.running / jobCounts.total) * 100}%`, backgroundColor: '#0d9488' }} />
                      <div style={{ width: `${(jobCounts.queued / jobCounts.total) * 100}%`, backgroundColor: '#99f6e4' }} />
                      <div style={{ width: `${(jobCounts.success / jobCounts.total) * 100}%`, backgroundColor: '#0f766e' }} />
                      <div style={{ width: `${(jobCounts.failed / jobCounts.total) * 100}%`, backgroundColor: '#d1568a' }} />
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <Badge tone="plum">处理中 · {jobCounts.running}</Badge>
                  <Badge tone="neutral">排队中 · {jobCounts.queued}</Badge>
                  <Badge tone="success">成功 · {jobCounts.success}</Badge>
                  <Badge tone="danger">失败 · {jobCounts.failed}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={failedJobs.length ? 'border-danger/25' : undefined}>
            <CardHeader>
              <div>
                <CardTitle>阻塞点与操作</CardTitle>
                <CardDescription>失败任务会阻断后续清洗、索引或服务发布。</CardDescription>
              </div>
              <Badge tone={failedJobs.length ? 'danger' : 'success'}>{failedJobs.length ? `${failedJobs.length} 项需处理` : '无阻塞'}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {failedJobs.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl bg-panel p-4 text-sm text-muted">
                  <CheckCircle2 className="size-5 text-plum" />当前没有失败任务，可继续观察 running 和 queued 任务。
                </div>
              ) : failedJobs.slice(0, 3).map((job) => (
                <div key={job.job_id} className="rounded-2xl border border-line bg-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium text-plum">{job.asset_title}</div>
                      <div className="mt-1 font-mono text-xs text-muted">{job.job_id} · {job.asset_id}</div>
                      <p className="mt-2 text-sm leading-6 text-danger">{job.error_message || '任务失败，但后端未返回错误原因。'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={retryMutation.isPending && retryMutation.variables === job.job_id}
                      onClick={() => retryMutation.mutate(job.job_id)}
                    >
                      <ListRestart className="size-4" />重试
                    </Button>
                  </div>
                </div>
              ))}
              {failedJobs.length > 3 ? <p className="text-sm text-muted">其余 {failedJobs.length - 3} 个失败任务在下方列表中处理。</p> : null}
              {retryMutation.error ? (
                <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {retryMutation.error instanceof Error ? retryMutation.error.message : '重试失败'}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-plum">任务类型分布</p>
                <div className="mt-4 space-y-3">
                  {typeCounts.length === 0 ? <p className="text-sm text-muted">暂无任务。</p> : typeCounts.map(([type, value]) => (
                    <div key={type}>
                      <div className="flex items-center justify-between text-xs text-muted"><span>{jobTypeLabel(type)}</span><span>{value}</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#0d9488)]" style={{ width: `${Math.round((value / (typeCounts[0]?.[1] || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3"><div><CardTitle className="text-lg">待继续处理资产</CardTitle></div><Link2 className="size-5 text-plum" /></CardHeader>
              <CardContent className="space-y-3">
                {assets
                  .filter((asset) => ['raw', 'parsed', 'cleaned', 'waiting_review'].includes(asset.status))
                  .slice(0, 6)
                  .map((asset) => (
                    <Link key={asset.asset_id} to={`/catalog/${asset.asset_id}`} className="block rounded-2xl border border-line bg-panel p-4 transition-colors hover:bg-plum-soft/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm font-medium text-plum">{asset.title}</div>
                          <div className="mt-1 font-mono text-xs text-muted">{asset.asset_id}</div>
                        </div>
                        <JobStatusChip value={asset.status} />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#0d9488)]" style={{ width: `${asset.progress}%` }} />
                        </div>
                        <span className="text-xs text-muted">{asset.progress}%</span>
                      </div>
                    </Link>
                  ))}
                {assets.filter((asset) => ['raw', 'parsed', 'cleaned', 'waiting_review'].includes(asset.status)).length === 0 ? (
                  <p className="text-sm text-muted">当前没有待继续处理的资产。</p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>任务列表</CardTitle>
            <CardDescription>支持按状态、类型和关键字筛选；先处理失败，再看长时间运行任务。</CardDescription>
          </div>
          <Badge tone="plum">{filteredJobs.length} / {jobs.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_160px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="搜索 job、资产或错误信息" value={q} onChange={(event) => setQ(event.target.value)} />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              {['queued', 'running', 'success', 'failed'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </Select>
            <Select value={jobType} onChange={(event) => setJobType(event.target.value)}>
              <option value="">全部类型</option>
              {Object.keys(jobTypeLabels).map((item) => <option key={item} value={item}>{jobTypeLabel(item)}</option>)}
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setQ(''); setStatus(''); setJobType('') }}>重置筛选</Button>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-panel" />)}</div>
          ) : error ? (
            <ErrorState error={error} onRetry={retry} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState title="没有匹配的处理任务" description="调整筛选条件，或先从原始数据页接入资料。" action={<Link to="/raw" className="inline-flex h-10 items-center rounded-full bg-[linear-gradient(135deg,#0f766e,#0d9488)] px-4 text-sm font-medium text-white shadow-[0_12px_28px_-18px_rgba(15,118,110,.95)] transition-transform hover:-translate-y-px">前往接入</Link>} />
          ) : (
            <TableShell>
              <Table>
                <thead>
                  <tr><Th>job_id</Th><Th>资产</Th><Th>类型</Th><Th>状态</Th><Th className="w-52">进度</Th><Th>错误信息</Th><Th className="w-32" /></tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.job_id} className="transition-colors hover:bg-panel/70">
                      <Td className="whitespace-nowrap font-mono text-xs">{job.job_id}</Td>
                      <Td>
                        <Link to={`/catalog/${job.asset_id}`} className="line-clamp-1 font-medium text-plum hover:underline">{job.asset_title}</Link>
                        <div className="mt-1 font-mono text-xs text-muted">{job.asset_id}</div>
                      </Td>
                      <Td>{jobTypeLabel(job.job_type)}</Td>
                      <Td><JobStatusChip value={job.status} /></Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${job.progress}%`,
                                backgroundColor: job.status === 'failed' ? '#d1568a' : '#0f766e',
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-muted">{job.progress}%</span>
                        </div>
                      </Td>
                      <Td><div className="max-w-64 text-xs leading-5 text-muted">{job.error_message || '—'}</div></Td>
                      <Td>
                        {job.status === 'failed' ? (
                          <Button size="sm" variant="outline" loading={retryMutation.isPending && retryMutation.variables === job.job_id} onClick={() => retryMutation.mutate(job.job_id)}>
                            <ListRestart className="size-4" />重试
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            {job.status === 'queued' ? <CircleDashed className="size-3" /> : <Timer className="size-3" />}
                            {formatDate(job.started_at || job.created_at)}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
