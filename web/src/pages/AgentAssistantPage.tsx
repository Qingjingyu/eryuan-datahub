import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, Bot, Braces, FileSearch, FileText, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryBoundary, StatCard } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Form'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber } from '@/lib/utils'
import type { AgentResponse } from '@/lib/types'

const tools = [
  { id: 'search_assets', label: '检索资产', icon: FileSearch, description: '返回命中资产摘要和引用。' },
  { id: 'read_asset', label: '读取资产', icon: FileText, description: '只读取审核后的单个资产。' },
  { id: 'generate_report', label: '生成简报', icon: ListChecks, description: '基于 Top 5 资产生成摘要。' },
] as const

const businessLines: Record<string, string> = { zhuangzhou: '妆舟', eryuan: '二元空间', general: '通用' }

export function AgentAssistantPage() {
  const [tool, setTool] = useState<(typeof tools)[number]['id']>('generate_report')
  const [query, setQuery] = useState('整理妆舟渠道运营和内容合规要求')
  const [assetId, setAssetId] = useState('')
  const [result, setResult] = useState<AgentResponse | null>(null)

  const metricsQuery = useQuery({ queryKey: ['bi', 'metrics'], queryFn: () => datahubApi.biMetrics() })
  const assetsQuery = useQuery({ queryKey: ['assets', 'agent'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const assets = assetsQuery.data ?? []
  const serviceAssets = assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status))
  const selectedAssetId = serviceAssets.some((asset) => asset.asset_id === assetId) ? assetId : serviceAssets[0]?.asset_id ?? ''

  const agentMutation = useMutation({
    mutationFn: () => datahubApi.agentExecute(tool, { query, asset_id: selectedAssetId }),
    onSuccess: setResult,
  })

  const loading = metricsQuery.isLoading || assetsQuery.isLoading
  const error = metricsQuery.error || assetsQuery.error
  const activeTool = tools.find((item) => item.id === tool)!

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent 助手"
        description="通过受控工具读取知识，不直接连接数据库。"
        meta={<><Badge tone="plum">Tool Gateway</Badge><Badge tone="success">引用可追溯</Badge></>}
      />

      <QueryBoundary
        loading={loading}
        error={error}
        retry={() => { metricsQuery.refetch(); assetsQuery.refetch() }}
        skeleton={
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />)}</div>
            <div className="h-[340px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="受控工具" value={tools.length} unit="个" icon={Braces} trend="检索 / 读取 / 简报" />
          <StatCard label="可读资产" value={formatNumber(serviceAssets.length)} unit="项" icon={FileText} trend="Approved 之后的资产" />
          <StatCard label="知识片段" value={formatNumber(metricsQuery.data?.value.total_chunks)} unit="chunks" icon={ListChecks} trend="受控上下文片段" />
          <StatCard label="Agent 调用" value={formatNumber(metricsQuery.data?.agent.calls)} unit="次" icon={Bot} trend="调用写入 AgentLog" />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>执行流程</CardTitle>
                <CardDescription>选择工具、配置目标、执行并核对引用</CardDescription>
              </div>
              <Badge tone="plum">主流程</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {tools.map((item) => {
                  const active = tool === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTool(item.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${active ? 'border-plum bg-plum-soft/60 shadow-[var(--shadow-soft)]' : 'border-line bg-panel hover:bg-surface'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`flex size-10 items-center justify-center rounded-2xl ${active ? 'bg-plum text-white' : 'bg-surface text-plum'}`}><item.icon className="size-5" /></span>
                        {active ? <Badge tone="plum">已选择</Badge> : null}
                      </div>
                      <div className="mt-3 font-medium text-plum">{item.label}</div>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                {[
                  { label: '选择工具', value: activeTool.label },
                  { label: '目标资产', value: selectedAssetId || '待选择' },
                  { label: '执行状态', value: agentMutation.isPending ? '执行中' : result ? '已完成' : '待执行' },
                ].map((step) => (
                  <div key={step.label} className="rounded-2xl bg-panel px-4 py-3">
                    <div className="text-xs text-muted">{step.label}</div>
                    <div className="mt-1 truncate text-sm font-medium text-plum">{step.value}</div>
                  </div>
                ))}
                <ArrowRight className="hidden size-4 text-muted lg:hidden" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>执行参数</CardTitle><CardDescription>当前工具的输入目标</CardDescription></div><ShieldCheck className="size-5 text-plum" /></CardHeader>
            <CardContent className="space-y-4">
              <Field label="目标资产" hint="read_asset 只能选择 Approved 之后的资产。">
                <Select value={selectedAssetId} onChange={(event) => setAssetId(event.target.value)} disabled={serviceAssets.length === 0}>
                  {serviceAssets.length === 0 ? <option value="">暂无可读资产</option> : serviceAssets.map((asset) => <option key={asset.asset_id} value={asset.asset_id}>{asset.title}</option>)}
                </Select>
              </Field>
              <Field label="任务 / 查询">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入 Agent 需要完成的任务" />
              </Field>
              <Button variant="primary" size="lg" className="w-full" loading={agentMutation.isPending} disabled={!selectedAssetId || !query.trim()} onClick={() => agentMutation.mutate()}>
                <Bot className="size-4" />执行工具
              </Button>
              <div className="rounded-2xl bg-panel p-4 text-sm leading-6 text-muted">
                <div className="mb-1 font-medium text-plum">权限边界</div>
                Agent 没有数据库密码，也不能修改资产状态。
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-5">
          <CardHeader>
            <div><CardTitle>执行结果</CardTitle><CardDescription>输出必须能回到可审计资产</CardDescription></div>
            {agentMutation.error ? <Badge tone="danger">执行失败</Badge> : result ? <Badge tone="plum">{result.tool}</Badge> : null}
          </CardHeader>
          <CardContent>
            {agentMutation.error ? (
              <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
                {agentMutation.error instanceof Error ? agentMutation.error.message : 'Agent 工具执行失败'}
              </div>
            ) : agentMutation.isPending ? (
              <div className="space-y-4">
                <div className="h-8 w-40 animate-pulse rounded-full bg-panel" />
                <div className="h-4 animate-pulse rounded-full bg-panel" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-panel" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-panel" />
              </div>
            ) : result ? (
              <div className="whitespace-pre-wrap text-[15px] leading-8">{result.answer}</div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center text-center text-sm text-muted"><Sparkles className="mb-3 size-6 text-plum" />选择工具后点击执行。</div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>Agent 资产明细</CardTitle>
              <CardDescription>可读资产和结果引用</CardDescription>
            </div>
            <Badge>次要区域</Badge>
          </CardHeader>
          <CardContent>
            <Tabs
              items={[
                {
                  id: 'citations',
                  label: `结果引用 ${result?.citations.length ?? 0}`,
                  content: !result ? (
                    <EmptyState title="暂无引用" description="执行 Agent 工具后会展示引用资产。" />
                  ) : result.citations.length === 0 ? (
                    <EmptyState title="本次没有引用资产" description="工具返回结果未绑定可追溯资产。" />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {result.citations.map((citation) => {
                        const asset = assets.find((item) => item.asset_id === citation.asset_id)
                        return (
                          <a key={citation.asset_id} href={`/catalog/${citation.asset_id}`} className="rounded-2xl border border-line bg-panel p-4 transition-colors hover:bg-surface">
                            <div className="line-clamp-1 font-medium text-plum">{citation.title}</div>
                            <div className="mt-2 flex items-center gap-2"><span className="font-mono text-xs text-muted">{citation.asset_id}</span>{asset ? <StatusBadge status={asset.status} /> : null}</div>
                          </a>
                        )
                      })}
                    </div>
                  ),
                },
                {
                  id: 'pool',
                  label: `可读资产 ${serviceAssets.length}`,
                  content: serviceAssets.length === 0 ? (
                    <EmptyState title="暂无可读资产" description="请先完成审核和索引。" />
                  ) : (
                    <TableShell>
                      <Table>
                        <thead><tr><Th>资产</Th><Th>业务线</Th><Th>状态</Th><Th>chunks</Th><Th>更新时间</Th></tr></thead>
                        <tbody>
                          {serviceAssets.map((asset) => (
                            <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
                              <Td><a href={`/catalog/${asset.asset_id}`} className="max-w-72 truncate font-medium text-plum hover:underline">{asset.title}</a></Td>
                              <Td>{businessLines[asset.business_line] || asset.business_line}</Td>
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
