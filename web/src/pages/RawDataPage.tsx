import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, CircleCheck, CloudUpload, FilePlus2, FileStack, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorState } from '@/components/data/States'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { fileLabel, formatDate, statusLabel } from '@/lib/utils'
import type { Asset } from '@/lib/types'

const defaultForm = {
  title: '',
  business_line: 'zhuangzhou',
  asset_type: 'document',
  owner: '',
  tags: [] as string[],
  visibility: 'business',
  description: '',
  summary: '',
  source_text: '',
}

function StatusChip({ value }: { value: string }) {
  const risk = value === 'failed' || value === 'rejected'
  const attention = value === 'waiting_review'
  const active = value === 'raw'
  return (
    <span
      className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium"
      style={{
        color: risk ? '#b91c1c' : attention ? '#92400e' : '#0f766e',
        backgroundColor: risk ? '#fee2e2' : attention ? '#fef3c7' : active ? '#f0fdfa' : '#ccfbf1',
        borderColor: risk ? '#fecaca' : attention ? '#fde68a' : '#99f6e4',
      }}
    >
      {statusLabel(value)}
    </span>
  )
}

function MetricCard({ label, value, hint, icon: Icon, emphasis = false }: {
  label: string
  value: number
  hint?: string
  icon: typeof FileStack
  emphasis?: boolean
}) {
  return (
    <Card className={emphasis ? 'border-plum/25 bg-gradient-to-br from-plum-soft/90 to-surface' : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl leading-none font-semibold text-plum">{value}</p>
            {hint ? <p className="mt-3 text-xs leading-5 text-muted">{hint}</p> : null}
          </div>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-plum-soft text-plum"><Icon className="size-5" /></span>
        </div>
      </CardContent>
    </Card>
  )
}

export function RawDataPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [businessLine, setBusinessLine] = useState('')
  const [assetType, setAssetType] = useState('')
  const [owner, setOwner] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [uploadAsset, setUploadAsset] = useState<Asset | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [form, setForm] = useState(defaultForm)

  const assetsQuery = useQuery({ queryKey: ['assets', 'raw'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const optionsQuery = useQuery({ queryKey: ['options'], queryFn: () => datahubApi.options() })
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])

  const counts = useMemo(() => {
    const count = (predicate: (asset: Asset) => boolean) => assets.filter(predicate).length
    return {
      total: assets.length,
      raw: count((asset) => asset.status === 'raw'),
      processing: count((asset) => ['parsed', 'cleaned'].includes(asset.status)),
      review: count((asset) => asset.status === 'waiting_review'),
      ready: count((asset) => ['approved', 'indexed', 'serving'].includes(asset.status)),
      failed: count((asset) => asset.status === 'rejected' || asset.index_status === 'failed'),
    }
  }, [assets])

  const blockers = useMemo(() => {
    const raw = assets.filter((asset) => asset.status === 'raw')
    const withoutSource = raw.filter((asset) => !asset.source_uri && !asset.source_text)
    const withoutOwner = assets.filter((asset) => !asset.owner)
    const withoutSummary = assets.filter((asset) => !asset.summary)
    return [
      { key: 'source', label: '缺少源内容', count: withoutSource.length, description: 'Raw 资产还没有文件或初始文本，不能可靠进入解析。' },
      { key: 'owner', label: '缺少负责人', count: withoutOwner.length, description: '没有负责人的问题资料会在生命周期中失管。' },
      { key: 'summary', label: '缺少业务摘要', count: withoutSummary.length, description: '摘要为空会影响审核判断和后续检索质量。' },
    ]
  }, [assets])

  const owners = useMemo(() => [...new Set(assets.map((asset) => asset.owner).filter(Boolean))], [assets])
  const rawAssets = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return assets
      .filter((asset) => asset.status === 'raw')
      .filter((asset) => !businessLine || asset.business_line === businessLine)
      .filter((asset) => !assetType || asset.asset_type === assetType)
      .filter((asset) => !owner || asset.owner === owner)
      .filter((asset) => !keyword || [asset.title, asset.asset_id, asset.owner, ...(asset.tags ?? [])].join(' ').toLowerCase().includes(keyword))
  }, [assets, businessLine, assetType, owner, q])

  const createMutation = useMutation({
    mutationFn: () => datahubApi.createAsset(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setCreateOpen(false)
      setForm(defaultForm)
    },
  })
  const uploadMutation = useMutation({
    mutationFn: () => datahubApi.uploadFile(uploadAsset!.asset_id, uploadFile!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setUploadAsset(null)
      setUploadFile(null)
    },
  })

  const progressTotal = counts.total || 0
  const progressValue = counts.processing + counts.review + counts.ready

  return (
    <div className="space-y-6">
      <PageHeader
        title="原始数据"
        description="所有资料先进入 Raw 分区。先补齐来源、负责人和业务含义，再进入解析与清洗。"
        meta={(
          <>
            <Badge tone="plum">{counts.total} 项全生命周期</Badge>
            <Badge tone="neutral">{counts.raw} 项 Raw</Badge>
            <Badge tone="warning">{counts.failed} 项阻塞</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="outline" onClick={() => assetsQuery.refetch()} loading={assetsQuery.isFetching}>
              <RefreshCw className="size-4" />刷新
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <FilePlus2 className="size-4" />登记资料
            </Button>
          </>
        )}
      />

      {assetsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-[24px] border border-line bg-surface" />)}
        </div>
      ) : assetsQuery.error ? (
        <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="生命周期总数" value={counts.total} hint="包含 Raw 到 Serving 的全部资产" icon={FileStack} emphasis />
            <MetricCard label="待处理 Raw" value={counts.raw} hint="可登记文件并进入解析" icon={CloudUpload} />
            <MetricCard label="处理中 / 待审核" value={counts.processing + counts.review} hint={`${counts.processing} 处理中 · ${counts.review} 待审核`} icon={RefreshCw} />
            <MetricCard label="成功 / 阻塞" value={counts.ready} hint={`${counts.failed} 项失败或被驳回`} icon={CircleCheck} />
          </section>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>生命周期进度</CardTitle>
                <CardDescription>已离开 Raw 的资产占全库比例；失败项不计入完成度。</CardDescription>
              </div>
              <span className="font-display text-2xl font-semibold text-plum">{progressTotal ? Math.round((progressValue / progressTotal) * 100) : 0}%</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-line">
                {progressTotal ? (
                  <>
                    <div style={{ width: `${(counts.raw / progressTotal) * 100}%`, backgroundColor: '#ccfbf1' }} />
                    <div style={{ width: `${(counts.processing / progressTotal) * 100}%`, backgroundColor: '#0d9488' }} />
                    <div style={{ width: `${(counts.review / progressTotal) * 100}%`, backgroundColor: '#d97706' }} />
                    <div style={{ width: `${(counts.ready / progressTotal) * 100}%`, backgroundColor: '#0f766e' }} />
                    <div style={{ width: `${(counts.failed / progressTotal) * 100}%`, backgroundColor: '#d1568a' }} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <Badge tone="neutral">Raw · {counts.raw}</Badge>
                <Badge tone="plum">处理中 · {counts.processing}</Badge>
                <Badge tone="warning">待审核 · {counts.review}</Badge>
                <Badge tone="success">成功 · {counts.ready}</Badge>
                <Badge tone="danger">失败 · {counts.failed}</Badge>
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
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>原始资产</CardTitle>
            <CardDescription>列表是本页的次要工作区；核心判断优先看上方状态和阻塞点。</CardDescription>
          </div>
          <Badge tone="plum">{rawAssets.length} 项</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(140px,170px))]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="搜索标题、asset_id 或负责人" value={q} onChange={(event) => setQ(event.target.value)} />
            </div>
            <Select value={businessLine} onChange={(event) => setBusinessLine(event.target.value)}>
              <option value="">全部业务线</option>
              {(optionsQuery.data?.business_lines ?? []).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </Select>
            <Select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
              <option value="">全部类型</option>
              {(optionsQuery.data?.asset_types ?? []).map((item) => <option key={item} value={item}>{fileLabel(item)}</option>)}
            </Select>
            <Select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="">全部负责人</option>
              {owners.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setQ(''); setBusinessLine(''); setAssetType(''); setOwner('') }}>重置筛选</Button>
            <Link to="/processing" className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:bg-plum-soft/70 hover:text-plum">前往处理看板<ArrowUpRight className="size-4" /></Link>
          </div>

          {assetsQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-panel" />)}
            </div>
          ) : assetsQuery.error ? (
            <ErrorState error={assetsQuery.error} onRetry={() => assetsQuery.refetch()} />
          ) : rawAssets.length === 0 ? (
            <EmptyState
              title="没有符合条件的 Raw 资产"
              description="调整筛选，或登记一份新资料并补充来源信息。"
              action={<Button variant="primary" onClick={() => setCreateOpen(true)}>登记资料</Button>}
            />
          ) : (
            <TableShell>
              <Table>
                <thead>
                  <tr>
                    <Th>资产</Th><Th>业务线</Th><Th>类型</Th><Th>负责人</Th><Th className="w-32">接入就绪</Th><Th className="w-40">创建时间</Th><Th className="w-36" />
                  </tr>
                </thead>
                <tbody>
                  {rawAssets.map((asset) => {
                    const hasSource = Boolean(asset.source_uri || asset.source_text)
                    return (
                      <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
                        <Td>
                          <Link to={`/catalog/${asset.asset_id}`} className="line-clamp-1 font-medium text-plum hover:underline">{asset.title}</Link>
                          <div className="mt-1 font-mono text-xs text-muted">{asset.asset_id}</div>
                        </Td>
                        <Td>{asset.business_line}</Td>
                        <Td>{fileLabel(asset.asset_type)}</Td>
                        <Td>{asset.owner || <span className="text-warning">未填写</span>}</Td>
                        <Td><StatusChip value={hasSource ? 'success' : 'waiting_review'} /><div className="mt-1 text-xs text-muted">{hasSource ? '源内容已补' : '缺源内容'}</div></Td>
                        <Td className="text-muted">{formatDate(asset.created_at)}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setUploadAsset(asset)}><CloudUpload className="size-4" />上传</Button>
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
        </CardContent>
      </Card>

      <Modal
        open={createOpen}
        title="登记原始资料"
        description="系统会生成唯一 asset_id，并把资料标记为 Raw 状态。"
        onClose={() => setCreateOpen(false)}
        footer={(
          <>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button variant="primary" disabled={!form.title.trim()} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>创建资产</Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="标题" className="md:col-span-2"><Input value={form.title} onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))} placeholder="例如：2026 Q4 渠道政策说明" /></Field>
          <Field label="业务线">
            <Select value={form.business_line} onChange={(event) => setForm((state) => ({ ...state, business_line: event.target.value }))}>
              {(optionsQuery.data?.business_lines ?? []).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="资产类型">
            <Select value={form.asset_type} onChange={(event) => setForm((state) => ({ ...state, asset_type: event.target.value }))}>
              {(optionsQuery.data?.asset_types ?? []).map((item) => <option key={item} value={item}>{fileLabel(item)}</option>)}
            </Select>
          </Field>
          <Field label="负责人"><Input value={form.owner} onChange={(event) => setForm((state) => ({ ...state, owner: event.target.value }))} placeholder="例如：苏白" /></Field>
          <Field label="可见性">
            <Select value={form.visibility} onChange={(event) => setForm((state) => ({ ...state, visibility: event.target.value }))}>
              <option value="business">业务线内</option>
              <option value="public">公开</option>
              <option value="private">私有</option>
            </Select>
          </Field>
          <Field label="标签" className="md:col-span-2" hint="使用逗号分隔，例如：渠道, 政策, Q4">
            <Input value={form.tags.join(', ')} onChange={(event) => setForm((state) => ({ ...state, tags: event.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="业务摘要" className="md:col-span-2"><Textarea value={form.summary} onChange={(event) => setForm((state) => ({ ...state, summary: event.target.value }))} placeholder="这份资料解决什么问题？谁会在什么场景使用？" /></Field>
          <Field label="正文 / 初始文本" className="md:col-span-2"><Textarea className="min-h-36" value={form.source_text} onChange={(event) => setForm((state) => ({ ...state, source_text: event.target.value }))} placeholder="可以直接粘贴正文，后续再上传原始文件。" /></Field>
        </div>
        {createMutation.error ? (
          <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {createMutation.error instanceof Error ? createMutation.error.message : '创建失败'}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(uploadAsset)}
        title="上传源文件"
        description={uploadAsset ? `${uploadAsset.title} · ${uploadAsset.asset_id}` : ''}
        onClose={() => setUploadAsset(null)}
        footer={(
          <>
            <Button onClick={() => setUploadAsset(null)}>取消</Button>
            <Button variant="primary" disabled={!uploadFile} loading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>开始上传</Button>
          </>
        )}
      >
        <Field label="选择文件" hint="上传后保存到 Raw 分区，并生成文件记录。">
          <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
        </Field>
        {uploadFile ? (
          <div className="mt-4 rounded-2xl bg-panel p-4 text-sm text-muted">
            <div className="font-medium text-plum">{uploadFile.name}</div>
            {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · {uploadFile.type || '未知类型'}
          </div>
        ) : null}
        {uploadMutation.error ? (
          <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {uploadMutation.error instanceof Error ? uploadMutation.error.message : '上传失败'}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
