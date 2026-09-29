import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, Bot, Database, FileCheck2, Gauge, LineChart as LineChartIcon, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryBoundary, StatCard } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber, percent } from '@/lib/utils'

const statusNames: Record<string, string> = {
  raw: '原始数据', parsed: '已解析', cleaned: '已清洗', waiting_review: '待审核',
  approved: '已审核', indexed: '已索引', serving: '服务中', rejected: '已拒绝', archived: '已归档',
}

const businessLines: Record<string, string> = { zhuangzhou: '妆舟', eryuan: '二元空间', general: '通用' }
const tealColors = ['#134e4a', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4']
const tooltipStyle = { borderRadius: 16, border: '1px solid #dbeae7', background: '#fff', fontSize: 12, color: '#0f172a' }

export function AnalyticsPage() {
  const metricsQuery = useQuery({ queryKey: ['bi', 'metrics'], queryFn: () => datahubApi.biMetrics() })
  const trendQuery = useQuery({ queryKey: ['bi', 'trend'], queryFn: () => datahubApi.trend() })
  const assetsQuery = useQuery({ queryKey: ['assets', 'analytics'], queryFn: () => datahubApi.assets({ page_size: 200 }) })

  const metrics = metricsQuery.data
  const trend = trendQuery.data ?? []
  const assets = assetsQuery.data ?? []
  const loading = metricsQuery.isLoading || trendQuery.isLoading || assetsQuery.isLoading
  const error = metricsQuery.error || trendQuery.error || assetsQuery.error

  const distribution = Object.entries(metrics?.status_distribution ?? {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: statusNames[name] || name, value }))

  const serviceCount = (metrics?.status_distribution.approved ?? 0) + (metrics?.status_distribution.indexed ?? 0) + (metrics?.status_distribution.serving ?? 0)
  const serviceCoverage = metrics?.total_assets ? Math.round((serviceCount / metrics.total_assets) * 100) : 0

  const businessSummary = Object.keys(businessLines).map((line) => {
    const rows = assets.filter((asset) => asset.business_line === line)
    const calls = rows.reduce((sum, asset) => sum + asset.call_count, 0)
    const indexed = rows.filter((asset) => ['indexed', 'serving'].includes(asset.status)).length
    return { line, name: businessLines[line], assets: rows.length, indexed, calls, coverage: rows.length ? Math.round((indexed / rows.length) * 100) : 0 }
  })

  const retryAll = () => {
    metricsQuery.refetch()
    trendQuery.refetch()
    assetsQuery.refetch()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据分析"
        description="检查处理效率、服务覆盖和 Agent 使用情况。"
        meta={<><Badge tone="plum">BI 报表</Badge><Badge tone="success">{serviceCoverage}% 服务覆盖</Badge></>}
        actions={<Button variant="outline" onClick={retryAll} loading={loading}>刷新报表</Button>}
      />

      <QueryBoundary
        loading={loading}
        error={error}
        retry={retryAll}
        skeleton={
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />)}</div>
            <div className="h-[380px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="资产规模" value={formatNumber(metrics?.total_assets)} unit="项" icon={LineChartIcon} trend="全生命周期资产" />
          <StatCard label="处理成功率" value={percent(metrics?.processing.success_rate, 1)} icon={Gauge} tone="success" trend={`${metrics?.processing.total_jobs ?? 0} 个任务`} />
          <StatCard label="服务覆盖率" value={`${serviceCoverage}%`} icon={Database} trend={`${formatNumber(serviceCount)} 项可服务资产`} />
          <StatCard label="Agent 调用" value={formatNumber(metrics?.agent.calls)} unit="次" icon={Bot} trend={`知识调用 ${formatNumber(metrics?.value.total_calls)} 次`} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>核心趋势</CardTitle>
                <CardDescription>资产、任务、调用的 7 天变化</CardDescription>
              </div>
              <Badge tone="plum">主图表</Badge>
            </CardHeader>
            <CardContent className="h-[360px]">
              {trend.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-panel text-sm text-muted">暂无趋势数据</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trend} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsAssetsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#dbeae7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="jobs" name="任务数" fill="#0d9488" opacity={0.72} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Area type="monotone" dataKey="assets" name="资产数" stroke="#0f766e" strokeWidth={3} fill="url(#analyticsAssetsFill)" />
                    <Line type="monotone" dataKey="calls" name="调用数" stroke="#134e4a" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="bg-plum text-white">
              <CardHeader className="border-white/15"><CardTitle className="text-white">明细入口</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  { to: '/catalog', label: '资产目录', icon: Database, description: '按业务线和状态筛选' },
                  { to: '/processing', label: '处理任务', icon: Workflow, description: '定位阻塞与失败' },
                  { to: '/knowledge-service', label: '知识服务', icon: FileCheck2, description: '查看服务转化' },
                ].map((item) => (
                  <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3 transition-colors hover:bg-white/20">
                    <span className="flex items-center gap-3"><item.icon className="size-4" /><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-white/70">{item.description}</span></span></span>
                    <ArrowUpRight className="size-4" />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><div><CardTitle className="text-lg">当前风险</CardTitle><CardDescription>按最新指标提示处理重点</CardDescription></div></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: '待审核资产', value: metrics?.status_distribution.waiting_review ?? 0 },
                  { label: '失败任务', value: metrics?.processing.failed ?? 0 },
                  { label: '未进入服务', value: Math.max((metrics?.total_assets ?? 0) - serviceCount, 0) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl bg-panel px-4 py-4">
                    <span className="text-sm text-muted">{item.label}</span>
                    <span className="font-display text-2xl font-semibold text-plum">{formatNumber(item.value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>分析明细</CardTitle>
              <CardDescription>状态、业务线和资产数据</CardDescription>
            </div>
            <Badge>次要区域</Badge>
          </CardHeader>
          <CardContent>
            <Tabs
              items={[
                {
                  id: 'status',
                  label: '状态分布',
                  content: distribution.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-2xl bg-panel text-sm text-muted">暂无状态数据</div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3} cornerRadius={8}>
                              {distribution.map((entry, index) => <Cell key={entry.name} fill={tealColors[index % tealColors.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {distribution.map((item, index) => (
                          <div key={item.name} className="rounded-2xl bg-panel p-4">
                            <div className="flex items-center justify-between text-sm"><span className="font-medium text-plum">{item.name}</span><span className="text-muted">{item.value}</span></div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                              <div className="h-full rounded-full" style={{ width: `${Math.max((item.value / (metrics?.total_assets || 1)) * 100, 4)}%`, background: tealColors[index % tealColors.length] }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'business',
                  label: '业务线效率',
                  content: (
                    <div className="grid gap-4 md:grid-cols-3">
                      {businessSummary.map((item) => (
                        <Card key={item.line}>
                          <CardHeader><div><CardTitle className="text-lg">{item.name}</CardTitle><CardDescription>{formatNumber(item.assets)} 项资产</CardDescription></div></CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl bg-panel p-4"><div className="text-xs text-muted">已索引</div><div className="mt-1 font-display text-2xl font-semibold text-plum">{formatNumber(item.indexed)}</div></div>
                              <div className="rounded-2xl bg-panel p-4"><div className="text-xs text-muted">调用</div><div className="mt-1 font-display text-2xl font-semibold text-plum">{formatNumber(item.calls)}</div></div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-plum" style={{ width: `${item.coverage}%` }} /></div>
                            <p className="text-xs text-muted">{item.coverage}% 资产进入知识服务</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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
                        <thead><tr><Th>资产</Th><Th>业务线</Th><Th>负责人</Th><Th>状态</Th><Th>chunks</Th><Th>调用</Th><Th>更新时间</Th></tr></thead>
                        <tbody>
                          {assets.slice(0, 20).map((asset) => (
                            <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
                              <Td><Link to={`/catalog/${asset.asset_id}`} className="max-w-64 truncate font-medium text-plum hover:underline">{asset.title}</Link></Td>
                              <Td>{businessLines[asset.business_line] || asset.business_line}</Td>
                              <Td>{asset.owner}</Td>
                              <Td><StatusBadge status={asset.status} /></Td>
                              <Td>{formatNumber(asset.chunk_count)}</Td>
                              <Td>{formatNumber(asset.call_count)}</Td>
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
