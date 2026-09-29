import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, Database, FileText, History, Paperclip, Save, ShieldCheck, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryBoundary } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Table, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { fileLabel, formatDate, formatNumber } from '@/lib/utils'
import type { Asset } from '@/lib/types'

export function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const assetQuery = useQuery({ queryKey: ['asset', assetId], queryFn: () => datahubApi.asset(assetId) })
  const filesQuery = useQuery({ queryKey: ['files', assetId], queryFn: () => datahubApi.files(assetId) })
  const timelineQuery = useQuery({ queryKey: ['timeline', assetId], queryFn: () => datahubApi.assetTimeline(assetId) })
  const [form, setForm] = useState<Partial<Asset>>({})

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Asset>) => datahubApi.updateAsset(assetId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['asset', assetId] }); queryClient.invalidateQueries({ queryKey: ['assets'] }) },
  })

  const asset = assetQuery.data
  const draft = { ...asset, ...form }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/catalog')}><ArrowLeft className="size-4" />返回数据目录</Button>

      <QueryBoundary loading={assetQuery.isLoading} error={assetQuery.error} retry={() => assetQuery.refetch()} empty={!asset}>
        {asset ? (
          <>
            <PageHeader
              title={asset.title}
              description={asset.summary || asset.description || '这份资产还没有摘要，可在下方补充业务含义。'}
              meta={<><Badge tone="plum">{asset.asset_id}</Badge><StatusBadge status={asset.status} /><Badge>{asset.business_line}</Badge><Badge>{fileLabel(asset.asset_type)}</Badge><Badge tone={asset.visibility === 'public' ? 'success' : 'info'}>{asset.visibility}</Badge></>}
              actions={<>
                <Button variant="outline" onClick={() => updateMutation.mutate(draft)} loading={updateMutation.isPending}><Save className="size-4" />保存修改</Button>
                <Button variant="primary" onClick={() => datahubApi.action(asset.asset_id, 'process').then(() => queryClient.invalidateQueries({ queryKey: ['asset', assetId] }))}><Workflow className="size-4" />发起处理</Button>
              </>}
            />

            {updateMutation.isSuccess ? <div className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-[#2b7a50]">资产已保存。</div> : null}
            {updateMutation.error ? <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{updateMutation.error instanceof Error ? updateMutation.error.message : '保存失败'}</div> : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <Card>
                  <CardHeader><div><CardTitle>基础信息</CardTitle><CardDescription>修改后写入审计日志，并生成新的 updated_at。</CardDescription></div><Database className="size-5 text-plum" /></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="标题"><Input value={draft.title ?? ''} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} /></Field>
                    <Field label="负责人"><Input value={draft.owner ?? ''} onChange={(event) => setForm((state) => ({ ...state, owner: event.target.value }))} /></Field>
                    <Field label="业务线"><Select value={draft.business_line ?? 'general'} onChange={(event) => setForm((state) => ({ ...state, business_line: event.target.value }))}><option value="zhuangzhou">妆舟</option><option value="eryuan">二元空间</option><option value="general">通用</option></Select></Field>
                    <Field label="资产类型"><Select value={draft.asset_type ?? 'document'} onChange={(event) => setForm((state) => ({ ...state, asset_type: event.target.value }))}>{['document', 'spreadsheet', 'image', 'audio', 'video', 'other'].map((item) => <option key={item} value={item}>{fileLabel(item)}</option>)}</Select></Field>
                    <Field label="标签" className="md:col-span-2" hint="使用中文逗号或英文逗号分隔。"><Input value={(draft.tags ?? []).join(', ')} onChange={(event) => setForm((state) => ({ ...state, tags: event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }))} /></Field>
                    <Field label="业务摘要" className="md:col-span-2"><Textarea value={draft.summary ?? ''} onChange={(event) => setForm((state) => ({ ...state, summary: event.target.value }))} /></Field>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><div><CardTitle>处理内容预览</CardTitle><CardDescription>这里是清洗后的 Markdown，供知识服务与 Agent 使用。</CardDescription></div><FileText className="size-5 text-plum" /></CardHeader>
                  <CardContent>
                    <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-2xl bg-panel p-5 text-sm leading-7 text-ink">{asset.processed_markdown || '尚未生成 processed_markdown。请先发起解析与清洗。'}</pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><div><CardTitle>生命周期历史</CardTitle><CardDescription>登记、解析、审核、索引、服务调用和异常全部可追溯。</CardDescription></div><History className="size-5 text-plum" /></CardHeader>
                  <CardContent className="space-y-4">
                    <QueryBoundary loading={timelineQuery.isLoading} error={timelineQuery.error} retry={() => timelineQuery.refetch()} empty={(timelineQuery.data?.timeline ?? []).length === 0}>
                      {(timelineQuery.data?.timeline ?? []).map((event, index) => (
                        <div key={`${event.source}-${index}`} className="relative rounded-2xl bg-panel p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-plum">{event.title}</div>
                            <div className="text-xs text-muted">{formatDate(event.time)}</div>
                          </div>
                          {event.detail ? <p className="mt-2 text-sm leading-6 text-muted">{event.detail}</p> : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted"><span>类型：{event.event_type}</span><span>操作人：{event.actor}</span>{event.status_to ? <span>状态：{event.status_to}</span> : null}</div>
                        </div>
                      ))}
                    </QueryBoundary>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><div><CardTitle>文件分区</CardTitle><CardDescription>raw 为原始文件，不可修改；处理结果进入后续分区。</CardDescription></div><Paperclip className="size-5 text-plum" /></CardHeader>
                  <CardContent className="p-0">
                    <QueryBoundary loading={filesQuery.isLoading} error={filesQuery.error} retry={() => filesQuery.refetch()} empty={(filesQuery.data ?? []).length === 0}>
                      <Table>
                        <thead><tr><Th>文件名</Th><Th>zone</Th><Th>大小</Th><Th>上传人</Th><Th>时间</Th></tr></thead>
                        <tbody>
                          {(filesQuery.data ?? []).map((file) => (
                            <tr key={file.id}><Td className="max-w-72 truncate">{file.file_name}</Td><Td className="font-mono text-xs">{file.zone}</Td><Td>{(file.file_size / 1024 / 1024).toFixed(2)} MB</Td><Td>{file.uploaded_by}</Td><Td className="text-muted">{formatDate(file.created_at)}</Td></tr>
                          ))}
                        </tbody>
                      </Table>
                    </QueryBoundary>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card>
                  <CardHeader><CardTitle className="text-lg">生命周期</CardTitle><Workflow className="size-5 text-plum" /></CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: '进度', value: `${asset.progress}%` },
                      { label: '版本', value: asset.version },
                      { label: 'chunk_count', value: formatNumber(asset.chunk_count) },
                      { label: 'call_count', value: formatNumber(asset.call_count) },
                      { label: 'parsed_at', value: formatDate(asset.parsed_at) },
                      { label: 'approved_at', value: formatDate(asset.approved_at) },
                      { label: 'indexed_at', value: formatDate(asset.indexed_at) },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3 text-sm"><span className="text-muted">{item.label}</span><span className="font-medium text-plum">{item.value}</span></div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">使用边界</CardTitle><ShieldCheck className="size-5 text-plum" /></CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6 text-muted">
                    <p>只有 <strong className="text-plum">Approved</strong> 之后的资产能进入索引。</p>
                    <p>Agent 只能通过受控 API 读取，不能直连 PostgreSQL。</p>
                    <p>回答必须返回 asset_id、标题和版本，便于人审追溯。</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">相关操作</CardTitle><History className="size-5 text-plum" /></CardHeader>
                  <CardContent className="grid gap-2">
                    <Button variant="outline" onClick={() => datahubApi.action(asset.asset_id, 'approve').then(() => queryClient.invalidateQueries({ queryKey: ['asset', assetId] }))}><ShieldCheck className="size-4" />Approve</Button>
                    <Button variant="outline" onClick={() => datahubApi.action(asset.asset_id, 'index').then(() => queryClient.invalidateQueries({ queryKey: ['asset', assetId] }))}><Database className="size-4" />建立索引</Button>
                    <Button variant="outline" onClick={() => datahubApi.action(asset.asset_id, 'serve').then(() => queryClient.invalidateQueries({ queryKey: ['asset', assetId] }))}><Bot className="size-4" />开放 Serving</Button>
                    <Link to="/processing" className="mt-2 text-center text-sm font-medium text-plum hover:underline">前往处理中心</Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : <EmptyState title="资产不存在" description="可能已被归档，或当前账号没有访问权限。" action={<Button onClick={() => navigate('/catalog')}>返回目录</Button>} />}
      </QueryBoundary>
    </div>
  )
}
