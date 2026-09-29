import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BookOpen, Database, Layers, Link2, Search, Sparkles, Timer, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryBoundary, StatCard } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Form'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { datahubApi } from '@/services/datahub-api'
import { formatDate, formatNumber } from '@/lib/utils'
import type { AskResponse } from '@/lib/types'

const examples = ['妆舟的分销策略是什么？', '哪些功效表述不能使用？', 'Agent 如何接入 DataHub？', '数据资产登记需要哪些字段？']
const businessLines: Record<string, string> = { zhuangzhou: '妆舟', eryuan: '二元空间', general: '通用' }

export function SearchPage() {
  const [query, setQuery] = useState('妆舟的分销策略是什么？')
  const [result, setResult] = useState<AskResponse | null>(null)
  const askMutation = useMutation({
    mutationFn: () => datahubApi.ask(query),
    onSuccess: setResult,
  })

  const metricsQuery = useQuery({ queryKey: ['bi', 'metrics'], queryFn: () => datahubApi.biMetrics() })
  const assetsQuery = useQuery({ queryKey: ['assets', 'search'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const assets = assetsQuery.data ?? []
  const serviceAssets = assets.filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status))
  const loading = metricsQuery.isLoading || assetsQuery.isLoading
  const error = metricsQuery.error || assetsQuery.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="知识检索"
        description="回答只来自通过审核的资产，并保留原文引用。"
        meta={<><Badge tone="success">受控引用</Badge><Badge tone="plum">Top 5 检索</Badge></>}
      />

      <QueryBoundary
        loading={loading}
        error={error}
        retry={() => { metricsQuery.refetch(); assetsQuery.refetch() }}
        skeleton={
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />)}</div>
            <div className="h-[240px] animate-pulse rounded-[var(--radius-card)] bg-surface" />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="可检索资产" value={formatNumber(serviceAssets.length)} unit="项" icon={Database} trend="Approved / Indexed / Serving" />
          <StatCard label="知识片段" value={formatNumber(metricsQuery.data?.value.total_chunks)} unit="chunks" icon={Layers} trend="来自已审核资产" />
          <StatCard label="服务调用" value={formatNumber(metricsQuery.data?.value.total_calls)} unit="次" icon={Workflow} trend="包含检索、问答和 Agent" />
          <StatCard label="引用数量" value={result ? `${result.citations.length}` : '—'} unit="条" icon={BookOpen} tone="success" trend={result ? `${formatNumber(result.latency_ms)} ms` : '等待检索'} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>受控检索</CardTitle>
                <CardDescription>提问后自动检索并生成带引用的答案</CardDescription>
              </div>
              <Badge tone="plum">主流程</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="flex flex-col gap-3 md:flex-row" onSubmit={(event) => { event.preventDefault(); askMutation.mutate() }}>
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
                  <Input className="h-12 pl-12 text-base" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入业务问题，例如：新品发布需要注意哪些合规词？" />
                </div>
                <Button type="submit" variant="primary" size="lg" loading={askMutation.isPending} disabled={!query.trim()}>
                  <Sparkles className="size-4" />生成答案
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {examples.map((item) => (
                  <button key={item} type="button" onClick={() => { setQuery(item); setResult(null) }} className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted transition-colors hover:border-plum/20 hover:text-plum">
                    {item}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle className="text-lg">执行路径</CardTitle><CardDescription>每一步都限定知识边界</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              {[
                { title: '解析问题', description: '识别业务意图与关键词。', active: Boolean(query.trim()) },
                { title: '检索受控库', description: '只查询已审核资产。', active: askMutation.isPending || Boolean(result) },
                { title: '组织引用', description: '绑定 asset_id 和原文片段。', active: Boolean(result) },
                { title: '输出答案', description: '结果可追溯到原始资产。', active: Boolean(result) },
              ].map((step, index) => (
                <div key={step.title} className={`rounded-2xl border p-4 transition-colors ${step.active ? 'border-plum/25 bg-plum-soft/60' : 'border-line bg-panel'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-plum">{step.title}</span>
                    <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{step.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {askMutation.error ? (
          <Card className="mt-5 border-danger/25">
            <CardContent className="flex items-center justify-between gap-4">
              <span className="text-sm text-danger">{askMutation.error instanceof Error ? askMutation.error.message : '检索失败'}</span>
              <Button variant="outline" onClick={() => askMutation.reset()}>关闭</Button>
            </CardContent>
          </Card>
        ) : null}

        {askMutation.isPending ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card><CardContent className="space-y-4"><div className="h-8 w-48 animate-pulse rounded-full bg-panel" /><div className="h-4 animate-pulse rounded-full bg-panel" /><div className="h-4 w-4/5 animate-pulse rounded-full bg-panel" /><div className="h-4 w-3/5 animate-pulse rounded-full bg-panel" /></CardContent></Card>
            <Card><CardContent className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-panel" />)}</CardContent></Card>
          </div>
        ) : result ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <div><CardTitle>检索答案</CardTitle><CardDescription>只基于命中的已审核资产生成</CardDescription></div>
                <Badge tone="info"><Timer className="mr-1 size-3" />{formatNumber(result.latency_ms)} ms</Badge>
              </CardHeader>
              <CardContent>{result.answer ? <div className="whitespace-pre-wrap text-[15px] leading-8 text-ink">{result.answer}</div> : <EmptyState title="暂无答案内容" description="接口已返回，但没有生成文本。" />}</CardContent>
            </Card>

            <Card>
              <CardHeader><div><CardTitle>引用依据</CardTitle><CardDescription>点击可打开原始资产</CardDescription></div><BookOpen className="size-5 text-plum" /></CardHeader>
              <CardContent className="space-y-3">
                {result.citations.length === 0 ? (
                  <EmptyState title="没有命中资产" description="当前问题没有命中的已审核资产，系统不会编造答案。" />
                ) : result.citations.map((citation, index) => (
                  <a key={citation.asset_id} href={`/catalog/${citation.asset_id}`} className="block rounded-2xl border border-line bg-panel p-4 transition-all hover:border-plum/20 hover:bg-surface">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-semibold text-white">{index + 1}</span>
                        <span className="truncate font-medium text-plum">{citation.title}</span>
                      </div>
                      <Link2 className="size-4 shrink-0 text-muted" />
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{citation.snippet || '未返回原文片段'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{citation.asset_id}</span>
                      {citation.version ? <Badge>{citation.version}</Badge> : null}
                      {citation.score ? <Badge tone="plum">score {citation.score.toFixed(2)}</Badge> : null}
                      {citation.updated_at ? <span>{formatDate(citation.updated_at)}</span> : null}
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="mt-5 border-dashed bg-panel/60">
            <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-plum-soft text-plum"><Search className="size-6" /></div>
              <h3 className="mt-4 font-display text-xl font-semibold text-plum">开始一次受控检索</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">输入问题后，系统只使用已审核知识生成答案。</p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>检索资产池</CardTitle>
              <CardDescription>本次服务可用的知识明细</CardDescription>
            </div>
            <Badge>次要区域</Badge>
          </CardHeader>
          <CardContent>
            <Tabs
              items={[
                {
                  id: 'pool',
                  label: `可检索 ${serviceAssets.length}`,
                  content: serviceAssets.length === 0 ? (
                    <EmptyState title="暂无可检索资产" description="请先在审核中心通过资产审核。" />
                  ) : (
                    <TableShell>
                      <Table>
                        <thead><tr><Th>资产</Th><Th>业务线</Th><Th>状态</Th><Th>chunks</Th><Th>更新时间</Th></tr></thead>
                        <tbody>
                          {serviceAssets.slice(0, 20).map((asset) => (
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
                {
                  id: 'excluded',
                  label: `未开放 ${assets.length - serviceAssets.length}`,
                  content: (
                    <EmptyState title="未开放资产不参与检索" description="以下状态不会暴露给模型：原始、处理中、待审核、拒绝或归档。" />
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
