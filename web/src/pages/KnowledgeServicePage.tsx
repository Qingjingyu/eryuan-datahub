import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Database, Globe2, Rocket, ServerCog, ShieldCheck, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryBoundary, StatCard } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber } from '@/lib/utils'
import type { Asset } from '@/lib/types'

const tooltipStyle = { borderRadius: 16, border: '1px solid #dbeae7', background: '#fff', fontSize: 12, color: '#0f172a' }
const businessLines: Record<string, string> = { zhuangzhou: '妆舟', eryuan: '二元空间', general: '通用' }

export function KnowledgeServicePage() {
  const queryClient = useQueryClient()
  const assetsQuery = useQuery({ queryKey: ['assets', 'knowledge-service'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const metricsQuery = useQuery({ queryKey: ['bi', 'metrics'], queryFn: () => datahubApi.biMetrics() })

  const assets = assetsQuery.data ?? []
  const serviceAssets = assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status))
  const approvedCount = assets.filter((asset) => asset.status === 'approved').length
  const indexedCount = assets.filter((asset) => asset.status === 'indexed').length
  const servingCount = assets.filter((asset) => asset.status === 'serving').length

  const indexMutation = useMutation({
    mutationFn: (asset: Asset) => datahubApi.action(asset.asset_id, 'index'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['bi'] })
    },
  })
  const serveMutation = useMutation({
    mutationFn: (asset: Asset) => datahubApi.action(asset.asset_id, 'serve'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['bi'] })
    },
  })

  const loading = assetsQuery.isLoading || metricsQuery.isLoading
  const error = assetsQuery.error || metricsQuery.error
  const mutationError = indexMutation.error || serveMutation.error
  const chartData = [
    { stage: '已审核', assets: approvedCount, chunks: serviceAssets.filter((asset) => asset.status === 'approved').reduce((sum, asset) => sum + asset.chunk_count, 0) },
    { stage: '已索引', assets: indexedCount, chunks: serviceAssets.filter((asset) => asset.status === 'indexed').reduce((sum, asset) => sum + asset.chunk_count, 0) },
    { stage: '服务中', assets: servingCount, chunks: serviceAssets.filter((asset) => asset.status === 'serving').reduce((sum, asset) => sum + asset.chunk_count, 0) },
  ]

  const retryAll = () => {
    assetsQuery.refetch()
    metricsQuery.refetch()
  }

  const assetRows = (rows: Asset[], actions: boolean) => rows.length === 0 ? (
    <div className="flex min-h-40 items-center justify-center rounded-2xl bg-panel text-sm text-muted">暂无资产数据</div>
  ) : (
    <TableShell>
      <Table>
        <thead><tr><Th>资产</Th><Th>业务线</Th><Th>状态</Th><Th>chunks</Th><Th>调用</Th><Th>更新时间</Th>{actions ? <Th className="w-44" /> : null}</tr></thead>
        <tbody>
          {rows.map((asset) => (
            <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
              <Td><Link to={`/catalog/${asset.asset_id}`} className="block max-w-72"><span className="line-clamp-1 font-medium text-plum hover:underline">{asset.title}</span><span className="mt-1 block font-mono text-xs text-muted">{asset.asset_id}</span></Link></Td>
              <Td>{businessLines[asset.business_line] || asset.business_line}</Td>
              <Td><StatusBadge status={asset.status} /></Td>
              <Td>{formatNumber(asset.chunk_count)}</Td>
              <Td>{formatNumber(asset.call_count)}</Td>
              <Td className="text-muted">{formatDate(asset.updated_at)}</Td>
              {actions ? (
                <Td>
                  <div className="flex gap-2">
                    {asset.status === 'approved' ? (
                      <Button size="sm" variant="primary" loading={indexMutation.isPending} onClick={() => indexMutation.mutate(asset)}>
                        <Database className="size-4" />索引
                      </Button>
                    ) : null}
                    {['indexed', 'serving'].includes(asset.status) ? (
                      <Button size="sm" variant="outline" loading={serveMutation.isPending} onClick={() => serveMutation.mutate(asset)}>
                        <ServerCog className="size-4" />服务
                      </Button>
                    ) : null}
                  </div>
                </Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableShell>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="知识服务"
        description="控制哪些知识可被检索、问答和 Agent 使用。"
        meta={<><Badge tone="success">{serviceAssets.length} 项可服务</Badge><Badge tone="plum">{formatNumber(metricsQuery.data?.value.total_chunks)} chunks</Badge></>}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="已审核" value={approvedCount} unit="项" icon={ShieldCheck} tone="success" trend="人审已通过" />
          <StatCard label="已索引" value={indexedCount} unit="项" icon={Database} trend="已生成检索上下文" />
          <StatCard label="服务中" value={servingCount} unit="项" icon={Globe2} trend="可被业务消费" />
          <StatCard label="总调用" value={formatNumber(metricsQuery.data?.value.total_calls)} unit="次" icon={Rocket} trend={`Agent 调用 ${formatNumber(metricsQuery.data?.agent.calls)} 次`} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>服务漏斗</CardTitle>
                <CardDescription>审核、索引、服务三道门槛的资产与片段量</CardDescription>
              </div>
              <Badge tone="plum">主图表</Badge>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#dbeae7" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5f6f6d', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="assets" name="资产数" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={52} />
                  <Bar dataKey="chunks" name="chunks" fill="#0d9488" radius={[8, 8, 0, 0]} maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="bg-plum text-white">
              <CardHeader className="border-white/15"><CardTitle className="text-white">明细入口</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  { to: '/review', label: '审核中心', description: '处理人审门槛' },
                  { to: '/search', label: '知识检索', description: '验证服务效果' },
                  { to: '/agent', label: 'Agent 助手', description: '检查受控读取' },
                ].map((item) => (
                  <Link key={item.to} to={item.to} className="flex items-center justify-between rounded-2xl bg-white/12 px-4 py-3 transition-colors hover:bg-white/20">
                    <span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-white/70">{item.description}</span></span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><div><CardTitle className="text-lg">服务流程</CardTitle><CardDescription>三步进入受控服务</CardDescription></div><Workflow className="size-5 text-plum" /></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { title: 'Approved → Indexed', description: '切分片段并写入索引。' },
                  { title: 'Indexed → Serving', description: '开放检索、问答和 Agent 调用。' },
                  { title: '调用留痕', description: '每次消费都累计并写入日志。' },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl bg-panel p-4">
                    <div className="font-medium text-plum">{item.title}</div>
                    <div className="mt-1 text-sm text-muted">{item.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>服务资产明细</CardTitle>
              <CardDescription>在次要区域执行索引和服务操作</CardDescription>
            </div>
            {mutationError ? <Badge tone="danger">操作失败</Badge> : <Badge>次要区域</Badge>}
          </CardHeader>
          <CardContent>
            {mutationError ? (
              <div className="mb-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                {mutationError instanceof Error ? mutationError.message : '资产服务操作失败'}
              </div>
            ) : null}
            <Tabs
              items={[
                {
                  id: 'service',
                  label: `可服务 ${serviceAssets.length}`,
                  content: serviceAssets.length === 0 ? (
                    <EmptyState title="还没有可服务资产" description="请先完成审核，再执行索引。" action={<Link to="/review"><Button>前往审核</Button></Link>} />
                  ) : assetRows(serviceAssets, true),
                },
                {
                  id: 'blocked',
                  label: `未服务 ${assets.length - serviceAssets.length}`,
                  content: assetRows(assets.filter((asset) => !['approved', 'indexed', 'serving'].includes(asset.status)), false),
                },
              ]}
            />
          </CardContent>
        </Card>
      </QueryBoundary>
    </div>
  )
}
