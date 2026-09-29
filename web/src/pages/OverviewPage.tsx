import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Boxes, Database, FileCheck2, Gauge, Layers, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { StatCard } from '@/components/data/StatCard'
import { StageFlow } from '@/components/data/StageFlow'
import { QueryBoundary } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber, percent } from '@/lib/utils'

const chartTooltipStyle = {
  borderRadius: 16,
  border: '1px solid #dbeae7',
  background: '#fff',
  boxShadow: '0 18px 48px -22px rgba(36,26,30,.24)',
  fontSize: 12,
  color: '#0f172a',
}

const jobTypeNames: Record<string, string> = {
  parse: '解析', clean: '清洗', chunk: '切分', embed: '向量化', index: '索引', serve: '服务',
}

const assetTypeNames: Record<string, string> = {
  document: '文档', spreadsheet: '表格', image: '图片', audio: '音频', video: '视频', other: '其他',
}

export function OverviewPage() {
  const metricsQuery = useQuery({ queryKey: ['bi', 'metrics'], queryFn: () => datahubApi.biMetrics() })
  const trendQuery = useQuery({ queryKey: ['bi', 'trend'], queryFn: () => datahubApi.trend() })
  const jobsQuery = useQuery({ queryKey: ['jobs'], queryFn: () => datahubApi.jobs() })
  const assetsQuery = useQuery({ queryKey: ['assets', 'overview'], queryFn: () => datahubApi.assets({ page_size: 100 }) })

  const metrics = metricsQuery.data
  const trend = trendQuery.data ?? []
  const jobs = (jobsQuery.data ?? []).slice(0, 8)
  const assets = (assetsQuery.data ?? []).slice(0, 8)
  const loading = metricsQuery.isLoading || trendQuery.isLoading || jobsQuery.isLoading || assetsQuery.isLoading
  const error = metricsQuery.error || trendQuery.error || jobsQuery.error || assetsQuery.error

  const retryAll = () => {
    metricsQuery.refetch()
    trendQuery.refetch()
    jobsQuery.refetch()
    assetsQuery.refetch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="总览"
        description="统一查看资产、处理、审核和服务调用。"
        meta={<><Badge tone="plum">运行驾驶舱</Badge><Badge tone="warning">{metrics?.status_distribution.waiting_review ?? 0} 待审核</Badge><Badge tone="success">人审与审计执行中</Badge></>}
        actions={
          <>
            <Button variant="outline" onClick={retryAll} loading={loading}>刷新数据</Button>
            <Button variant="primary" onClick={() => { window.location.href = '/raw' }}>登记原始数据</Button>
          </>
        }
      />

      <QueryBoundary
        loading={loading}
        error={error}
        retry={retryAll}
        skeleton={
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />)}</div>
            <div className="h-[360px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="资产总数" value={formatNumber(metrics?.total_assets)} unit="项" icon={Boxes} trend="覆盖全生命周期" />
          <StatCard label="处理成功率" value={percent(metrics?.processing.success_rate, 1)} icon={Gauge} tone="success" trend={`${metrics?.processing.success ?? 0} 成功 / ${metrics?.processing.failed ?? 0} 失败`} />
          <StatCard label="知识片段" value={formatNumber(metrics?.value.total_chunks)} unit="chunks" icon={Layers} trend="Approved 后进入索引" />
          <StatCard label="服务调用" value={formatNumber(metrics?.value.total_calls)} unit="次" icon={Activity} trend={`Agent 调用 ${formatNumber(metrics?.agent.calls)} 次`} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>资产生命周期</CardTitle>
                  <CardDescription>从登记到服务的流转与阻塞点</CardDescription>
                </div>
                <Badge tone="plum">主流程</Badge>
              </CardHeader>
              <CardContent><StageFlow distribution={metrics?.status_distribution ?? {}} /></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>处理与服务趋势</CardTitle>
                  <CardDescription>最近 7 天资产、任务和调用变化</CardDescription>
                </div>
                <Badge>7 天</Badge>
              </CardHeader>
              <CardContent className="h-[280px]">
                {trend.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl bg-panel text-sm text-muted">最近 7 天暂无趋势数据</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="overviewAssetsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0f766e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dbeae7" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="assets" name="资产数" stroke="#0f766e" strokeWidth={3} fill="url(#overviewAssetsFill)" />
                      <Area type="monotone" dataKey="jobs" name="任务数" stroke="#0d9488" strokeWidth={2.5} fill="#0d948814" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="bg-plum text-white">
              <CardHeader className="border-white/15"><CardTitle className="text-white">明细入口</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  { to: '/processing', label: '处理任务', icon: Workflow, description: '查看运行与失败任务' },
                  { to: '/review', label: '审核中心', icon: FileCheck2, description: '处理待审核资产' },
                  { to: '/knowledge-service', label: '知识服务', icon: Database, description: '控制索引与开放范围' },
                ].map((item) => (
                  <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3 transition-colors hover:bg-white/20">
                    <span className="flex items-center gap-3"><item.icon className="size-4" /><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-white/70">{item.description}</span></span></span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><div><CardTitle className="text-lg">健康信号</CardTitle><CardDescription>优先处理阻塞链路的资产</CardDescription></div></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: '待审核', value: metrics?.status_distribution.waiting_review ?? 0, to: '/review' },
                  { label: '处理失败', value: metrics?.processing.failed ?? 0, to: '/processing' },
                  { label: '可服务资产', value: (metrics?.status_distribution.approved ?? 0) + (metrics?.status_distribution.indexed ?? 0) + (metrics?.status_distribution.serving ?? 0), to: '/knowledge-service' },
                ].map((item) => (
                  <Link key={item.label} to={item.to} className="flex items-center justify-between rounded-2xl bg-panel px-4 py-4 transition-colors hover:bg-plum-soft/60">
                    <span className="text-sm text-muted">{item.label}</span>
                    <span className="font-display text-2xl font-semibold text-plum">{formatNumber(item.value)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>运行明细</CardTitle>
              <CardDescription>任务与资产的最新状态</CardDescription>
            </div>
            <Badge tone="plum">次要区域</Badge>
          </CardHeader>
          <CardContent>
            <Tabs
              items={[
                {
                  id: 'jobs',
                  label: `任务明细 ${jobs.length}`,
                  content: jobs.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center rounded-2xl bg-panel text-sm text-muted">暂无处理任务</div>
                  ) : (
                    <TableShell>
                      <Table>
                        <thead><tr><Th>资产</Th><Th>asset_id</Th><Th>任务类型</Th><Th>状态</Th><Th>进度</Th><Th>开始时间</Th></tr></thead>
                        <tbody>
                          {jobs.map((job) => (
                            <tr key={job.job_id} className="transition-colors hover:bg-panel/70">
                              <Td><div className="max-w-64 truncate font-medium">{job.asset_title}</div></Td>
                              <Td className="font-mono text-xs">{job.asset_id}</Td>
                              <Td>{jobTypeNames[job.job_type] || job.job_type}</Td>
                              <Td><StatusBadge status={job.status} /></Td>
                              <Td>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-plum" style={{ width: `${job.progress}%` }} /></div>
                                  <span className="text-xs text-muted">{job.progress}%</span>
                                </div>
                              </Td>
                              <Td className="text-muted">{formatDate(job.started_at)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableShell>
                  ),
                },
                {
                  id: 'assets',
                  label: `资产明细 ${assets.length}`,
                  content: assets.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center rounded-2xl bg-panel text-sm text-muted">暂无资产数据</div>
                  ) : (
                    <TableShell>
                      <Table>
                        <thead><tr><Th>资产</Th><Th>类型</Th><Th>负责人</Th><Th>状态</Th><Th>chunks</Th><Th>更新时间</Th></tr></thead>
                        <tbody>
                          {assets.map((asset) => (
                            <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
                              <Td><Link to={`/catalog/${asset.asset_id}`} className="max-w-72 truncate font-medium text-plum hover:underline">{asset.title}</Link></Td>
                              <Td>{assetTypeNames[asset.asset_type] || asset.asset_type}</Td>
                              <Td>{asset.owner}</Td>
                              <Td><StatusBadge status={asset.status} /></Td>
                              <Td>{formatNumber(asset.chunk_count)}</Td>
                              <Td className="text-muted">{formatDate(asset.updated_at)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableShell>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  )
}
