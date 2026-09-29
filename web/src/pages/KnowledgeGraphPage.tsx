import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Filter, GitBranch, Link2, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryBoundary, StatCard } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { KnowledgeGraphCanvas } from '@/components/graph/KnowledgeGraphCanvas'
import { datahubApi } from '@/services/datahub-api'
import type { GraphNode } from '@/lib/types'
import { formatNumber, percent, statusLabel } from '@/lib/utils'

const typeColors: Record<string, string> = {
  业务线: '#14b8a6',
  模块: '#0d9488',
  主播: '#7dd3fc',
  产品: '#34d399',
  流程: '#60a5fa',
  风险: '#fb7185',
  系统: '#a78bfa',
  组织: '#f59e0b',
  直播场次: '#38bdf8',
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-plum">{label}</span>
        <span className="text-muted">{formatNumber(value)} · {percent(total ? (value / total) * 100 : 0, 0)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/70">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(total ? (value / total) * 100 : 0, 3)}%`, background: color }} />
      </div>
    </div>
  )
}

export function KnowledgeGraphPage() {
  const queryClient = useQueryClient()
  const graphQuery = useQuery({ queryKey: ['graph'], queryFn: () => datahubApi.graph() })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [query, setQuery] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [businessLineFilter, setBusinessLineFilter] = useState('')
  const [relationTypeFilter, setRelationTypeFilter] = useState('')
  const [minConfidence, setMinConfidence] = useState(0)
  const [entityOpen, setEntityOpen] = useState(false)
  const [relationOpen, setRelationOpen] = useState(false)
  const [ledgerQuery, setLedgerQuery] = useState('')
  const [ledgerStatus, setLedgerStatus] = useState('')
  const [entity, setEntity] = useState({ name: '', entity_type: '模块', business_line: 'zhuangzhou', description: '' })
  const [relation, setRelation] = useState({ source_entity: '', relation_type: '关联', target_entity: '', confidence: 0.9 })

  const graph = graphQuery.data ?? { nodes: [], edges: [] }
  const entityTypeOptions = useMemo(() => Array.from(new Set(graph.nodes.map((node) => node.type))).sort(), [graph.nodes])
  const businessLineOptions = useMemo(() => Array.from(new Set(graph.nodes.map((node) => node.business_line))).sort(), [graph.nodes])
  const relationTypeOptions = useMemo(() => Array.from(new Set(graph.edges.map((edge) => edge.relation_type))).sort(), [graph.edges])

  const filteredNodes = useMemo(() => graph.nodes.filter((node) => {
    const matchText = !query || `${node.name} ${node.type} ${node.business_line}`.toLowerCase().includes(query.toLowerCase())
    const matchType = !entityTypeFilter || node.type === entityTypeFilter
    const matchLine = !businessLineFilter || node.business_line === businessLineFilter
    return matchText && matchType && matchLine
  }), [graph.nodes, query, entityTypeFilter, businessLineFilter])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes])
  const filteredEdges = useMemo(() => graph.edges.filter((edge) => {
    const matchRelation = !relationTypeFilter || edge.relation_type === relationTypeFilter
    const matchConfidence = edge.confidence >= minConfidence
    return matchRelation && matchConfidence && filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  }), [graph.edges, filteredNodeIds, relationTypeFilter, minConfidence])

  const activeRelations = useMemo(() => {
    if (!selectedNode) return []
    return graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
  }, [graph.edges, selectedNode])

  const ledgerRows = useMemo(() => filteredEdges.filter((edge) => {
    const source = graph.nodes.find((node) => node.id === edge.source)?.name || edge.source
    const target = graph.nodes.find((node) => node.id === edge.target)?.name || edge.target
    const matchText = !ledgerQuery || `${source} ${target} ${edge.relation_type} ${edge.asset_id}`.toLowerCase().includes(ledgerQuery.toLowerCase())
    return matchText && (!ledgerStatus || edge.status === ledgerStatus)
  }), [filteredEdges, ledgerQuery, ledgerStatus, graph.nodes])

  const typeDistribution = useMemo(() => entityTypeOptions.map((type) => ({
    type,
    count: graph.nodes.filter((node) => node.type === type).length,
    color: typeColors[type] || '#2dd4bf',
  })).sort((a, b) => b.count - a.count), [entityTypeOptions, graph.nodes])

  const topNodes = useMemo(() => filteredNodes.map((node) => ({
    node,
    degree: filteredEdges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
  })).sort((a, b) => b.degree - a.degree).slice(0, 8), [filteredNodes, filteredEdges])

  const averageConfidence = filteredEdges.length
    ? filteredEdges.reduce((sum, edge) => sum + edge.confidence, 0) / filteredEdges.length
    : 0
  const evidenceCount = new Set(filteredEdges.map((edge) => edge.asset_id).filter(Boolean)).size
  const confirmedCount = filteredEdges.filter((edge) => edge.status === 'confirmed').length

  const entityMutation = useMutation({
    mutationFn: () => datahubApi.createEntity(entity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
      setEntityOpen(false)
      setEntity({ name: '', entity_type: '模块', business_line: 'zhuangzhou', description: '' })
    },
  })

  const relationMutation = useMutation({
    mutationFn: () => datahubApi.createRelationship(relation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph'] })
      setRelationOpen(false)
    },
  })

  const selectedSourceNode = (id: string) => graph.nodes.find((node) => node.id === id)?.name || id

  return (
    <div className="space-y-6">
      <PageHeader
        title="知识图谱"
        description="用可探索的实体网络理解业务关系，每个结论都能回到来源资产。"
        meta={<><Badge tone="plum">Evidence Graph</Badge><Badge tone="success">{formatNumber(evidenceCount)} 个来源资产</Badge><Badge tone="info">平均置信度 {percent(averageConfidence * 100, 0)}</Badge></>}
        actions={<><Button variant="outline" onClick={() => setRelationOpen(true)}><Link2 className="size-4" />新增关系</Button><Button variant="primary" onClick={() => setEntityOpen(true)}><Plus className="size-4" />新增实体</Button></>}
      />

      <QueryBoundary loading={graphQuery.isLoading} error={graphQuery.error} retry={() => graphQuery.refetch()} empty={graph.nodes.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="实体节点" value={formatNumber(filteredNodes.length)} unit={`/ ${graph.nodes.length}`} icon={Boxes} trend="按业务类型聚簇展示" />
          <StatCard label="有效关系" value={formatNumber(filteredEdges.length)} unit={`/ ${graph.edges.length}`} icon={GitBranch} tone="info" trend={`${formatNumber(confirmedCount)} 条已确认`} />
          <StatCard label="平均置信度" value={percent(averageConfidence * 100, 0)} icon={Sparkles} tone="success" trend="低于阈值的边会被隐藏" />
          <StatCard label="证据资产" value={formatNumber(evidenceCount)} unit="项" icon={ShieldCheck} tone="violet" trend="关系均通过资产 ID 回溯" />
        </div>

        <Card className="mt-6">
          <CardHeader className="flex-col gap-4 lg:flex-row lg:items-center">
            <div>
              <CardTitle>图谱探索</CardTitle>
              <CardDescription>节点大小代表连接度；关系线越亮，代表置信度越高。</CardDescription>
            </div>
            <div className="grid w-full gap-3 xl:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,150px))_minmax(140px,170px)]">
              <Input placeholder="搜索实体名称 / 类型 / 业务线" value={query} onChange={(event) => setQuery(event.target.value)} />
              <Select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
                <option value="">全部实体</option>
                {entityTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={businessLineFilter} onChange={(event) => setBusinessLineFilter(event.target.value)}>
                <option value="">全部业务线</option>
                {businessLineOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={relationTypeFilter} onChange={(event) => setRelationTypeFilter(event.target.value)}>
                <option value="">全部关系</option>
                {relationTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <div className="flex h-10 items-center gap-3 rounded-full border border-line bg-surface px-4">
                <Filter className="size-3.5 text-muted" />
                <input
                  aria-label="最低置信度"
                  className="w-full accent-[#0f766e]"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={minConfidence}
                  onChange={(event) => setMinConfidence(Number(event.target.value))}
                />
                <span className="w-8 text-right text-xs text-muted">{minConfidence.toFixed(2)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid min-h-0 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
              <KnowledgeGraphCanvas
                className="border-0 xl:rounded-r-none"
                nodes={filteredNodes}
                edges={filteredEdges}
                selectedId={selectedNode?.id || null}
                onSelect={setSelectedNode}
              />
              <aside className="border-t border-line bg-panel/70 p-5 xl:border-l xl:border-t-0">
                {selectedNode ? (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge tone="plum">{selectedNode.type}</Badge>
                        <h3 className="mt-3 font-display text-2xl font-semibold text-plum">{selectedNode.name}</h3>
                        <p className="mt-1 text-sm text-muted">业务线：{selectedNode.business_line}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>清除</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-line bg-surface p-4"><div className="text-xs text-muted">直接关联</div><div className="mt-1 font-display text-2xl font-semibold text-plum">{activeRelations.length}</div></div>
                      <div className="rounded-2xl border border-line bg-surface p-4"><div className="text-xs text-muted">证据资产</div><div className="mt-1 font-display text-2xl font-semibold text-plum">{new Set(activeRelations.map((edge) => edge.asset_id).filter(Boolean)).size}</div></div>
                    </div>
                    <div>
                      <div className="mb-3 text-sm font-semibold text-plum">关联路径</div>
                      <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
                        {activeRelations.slice(0, 20).map((edge) => {
                          const other = edge.source === selectedNode.id ? edge.target : edge.source
                          return (
                            <div key={edge.id} className="rounded-2xl border border-line bg-surface p-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-ink">{selectedSourceNode(other)}</span>
                                <span className="text-xs font-semibold text-plum">{percent(edge.confidence * 100, 0)}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                                <span>{edge.relation_type}</span>
                                <span className="font-mono">{edge.asset_id || '无资产证据'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-dashed border-line bg-surface/70 p-5 text-center">
                      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-plum-soft text-plum"><Sparkles className="size-5" /></div>
                      <h3 className="mt-4 font-display text-lg font-semibold text-plum">选择一个实体</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">点击节点查看关系方向、置信度和来源资产；悬停可快速定位邻域。</p>
                    </div>
                    <div>
                      <div className="mb-3 text-sm font-semibold text-plum">实体类型分布</div>
                      <div className="space-y-4">
                        {typeDistribution.map((item) => <ProgressRow key={item.type} label={item.type} value={item.count} total={graph.nodes.length} color={item.color} />)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 text-sm font-semibold text-plum">高连接实体</div>
                      <div className="space-y-2">
                        {topNodes.map((item, index) => (
                          <button key={item.node.id} type="button" onClick={() => setSelectedNode(item.node)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-plum/25 hover:bg-plum-soft/40">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="w-4 text-xs text-muted">{index + 1}</span>
                              <span className="truncate text-sm font-medium text-ink">{item.node.name}</span>
                            </span>
                            <Badge tone="info">{item.degree} 度</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Tabs
            items={[
              {
                id: 'ledger',
                label: '关系台账',
                content: (
                  <Card>
                    <CardContent className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
                      <Input placeholder="搜索关系或 asset_id" value={ledgerQuery} onChange={(event) => setLedgerQuery(event.target.value)} />
                      <Select value={ledgerStatus} onChange={(event) => setLedgerStatus(event.target.value)}>
                        <option value="">全部状态</option>
                        {['confirmed', 'candidate', 'rejected', 'archived'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                      </Select>
                      <Button variant="outline" onClick={() => { setLedgerQuery(''); setLedgerStatus('') }}>重置</Button>
                    </CardContent>
                    <QueryBoundary loading={graphQuery.isLoading} error={graphQuery.error} retry={() => graphQuery.refetch()} empty={ledgerRows.length === 0}>
                      <TableShell className="border-0 border-t">
                        <Table>
                          <thead>
                            <tr><Th>起点</Th><Th>关系</Th><Th>终点</Th><Th>来源资产</Th><Th>置信度</Th><Th>状态</Th></tr>
                          </thead>
                          <tbody>
                            {ledgerRows.slice(0, 100).map((edge) => (
                              <tr key={edge.id} className={selectedNode && [edge.source, edge.target].includes(selectedNode.id) ? 'bg-plum-soft/40' : ''}>
                                <Td>{selectedSourceNode(edge.source)}</Td>
                                <Td className="font-medium text-plum">{edge.relation_type}</Td>
                                <Td>{selectedSourceNode(edge.target)}</Td>
                                <Td className="font-mono text-xs text-muted">{edge.asset_id || '—'}</Td>
                                <Td>{percent(edge.confidence * 100, 0)}</Td>
                                <Td><StatusBadge status={edge.status} /></Td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </TableShell>
                      {ledgerRows.length > 100 ? <div className="border-t border-line px-6 py-3 text-xs text-muted">已展示前 100 条，可用筛选继续缩小范围。</div> : null}
                    </QueryBoundary>
                  </Card>
                ),
              },
              {
                id: 'insight',
                label: '图谱洞察',
                content: (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card>
                      <CardHeader><div><CardTitle>类型聚簇</CardTitle><CardDescription>图谱按实体类型生成业务集群。</CardDescription></div></CardHeader>
                      <CardContent className="space-y-4">
                        {typeDistribution.map((item) => <ProgressRow key={item.type} label={item.type} value={item.count} total={graph.nodes.length} color={item.color} />)}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><div><CardTitle>关系结构</CardTitle><CardDescription>发现连接度最高的业务枢纽。</CardDescription></div></CardHeader>
                      <CardContent className="space-y-4">
                        {topNodes.map((item) => (
                          <div key={item.node.id} className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3">
                            <div><div className="text-sm font-medium text-ink">{item.node.name}</div><div className="text-xs text-muted">{item.node.type}</div></div>
                            <Badge tone="success">{item.degree} 条连接</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </QueryBoundary>

      <Modal open={entityOpen} title="新增实体" onClose={() => setEntityOpen(false)} footer={<><Button onClick={() => setEntityOpen(false)}>取消</Button><Button variant="primary" disabled={!entity.name} loading={entityMutation.isPending} onClick={() => entityMutation.mutate()}>创建</Button></>}>
        <div className="grid gap-4">
          <Field label="实体名称"><Input value={entity.name} onChange={(event) => setEntity((state) => ({ ...state, name: event.target.value }))} /></Field>
          <Field label="实体类型"><Select value={entity.entity_type} onChange={(event) => setEntity((state) => ({ ...state, entity_type: event.target.value }))}>{Object.keys(typeColors).map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="业务线"><Select value={entity.business_line} onChange={(event) => setEntity((state) => ({ ...state, business_line: event.target.value }))}><option value="zhuangzhou">妆舟</option><option value="eryuan">二元空间</option><option value="general">通用</option></Select></Field>
          <Field label="说明"><Input value={entity.description} onChange={(event) => setEntity((state) => ({ ...state, description: event.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal open={relationOpen} title="新增关系" onClose={() => setRelationOpen(false)} footer={<><Button onClick={() => setRelationOpen(false)}>取消</Button><Button variant="primary" disabled={!relation.source_entity || !relation.target_entity} loading={relationMutation.isPending} onClick={() => relationMutation.mutate()}>创建</Button></>}>
        <div className="grid gap-4">
          <Field label="起点实体"><Select value={relation.source_entity} onChange={(event) => setRelation((state) => ({ ...state, source_entity: event.target.value }))}><option value="">请选择</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</Select></Field>
          <Field label="关系类型"><Input value={relation.relation_type} onChange={(event) => setRelation((state) => ({ ...state, relation_type: event.target.value }))} /></Field>
          <Field label="终点实体"><Select value={relation.target_entity} onChange={(event) => setRelation((state) => ({ ...state, target_entity: event.target.value }))}><option value="">请选择</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</Select></Field>
          <Field label="置信度"><Input type="number" min={0} max={1} step={0.01} value={relation.confidence} onChange={(event) => setRelation((state) => ({ ...state, confidence: Number(event.target.value) }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}
