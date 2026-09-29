import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Archive,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderTree,
  Image,
  Layers,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorState } from '@/components/data/States'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { fileLabel, formatDate, statusLabel } from '@/lib/utils'
import type { Asset } from '@/lib/types'

const directories = [
  { id: 'raw', label: '原始数据', path: '01_raw', icon: FolderOpen },
  { id: 'parsed', label: '解析完成', path: '02_parsed', icon: FileText },
  { id: 'cleaned', label: '清洗后的数据', path: '03_cleaned', icon: Workflow },
  { id: 'waiting_review', label: '待审核', path: '04_review', icon: ShieldCheck },
  { id: 'approved', label: '已审核', path: '05_approved', icon: BadgeCheck },
  { id: 'indexed', label: '已入知识库', path: '06_indexed', icon: Database },
  { id: 'serving', label: '服务中', path: '07_serving', icon: ServerCog },
  { id: 'failed', label: '处理失败', path: '08_failed', icon: CircleAlert },
  { id: 'rejected', label: '已驳回', path: '09_rejected', icon: CircleAlert },
  { id: 'archived', label: '归档 / 失效', path: '90_archive', icon: Archive },
]

function TypeIcon({ type }: { type: string }) {
  if (type === 'image') return <Image className="size-4" />
  if (type === 'spreadsheet') return <FileSpreadsheet className="size-4" />
  return <FileText className="size-4" />
}

function DirectoryChip({ value }: { value: string }) {
  const risk = value === 'failed' || value === 'rejected'
  const attention = value === 'waiting_review'
  const active = ['approved', 'indexed', 'serving'].includes(value)
  const style = risk
    ? { color: '#b91c1c', background: '#fee2e2', borderColor: '#fecaca' }
    : attention
      ? { color: '#92400e', background: '#fef3c7', borderColor: '#fde68a' }
      : active
        ? { color: '#ffffff', background: '#0f766e', borderColor: '#0f766e' }
        : { color: '#0f766e', background: '#ccfbf1', borderColor: '#99f6e4' }
  return <span className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium" style={style}>{statusLabel(value)}</span>
}

function matchesDirectory(asset: Asset, directoryId: string) {
  if (directoryId === 'cleaned') {
    return Boolean(asset.processed_markdown) && !['archived', 'rejected'].includes(asset.status)
  }
  if (directoryId === 'failed') {
    return asset.index_status === 'failed'
  }
  return asset.status === directoryId
}

function AssetTable({ rows }: { rows: Asset[] }) {
  return (
    <TableShell>
      <Table>
        <thead>
          <tr>
            <Th className="w-24">类型</Th><Th>资产名称</Th><Th className="w-40">asset_id</Th><Th className="w-32">状态</Th><Th className="w-32">负责人</Th><Th className="w-44">标签</Th><Th className="w-40">更新时间</Th><Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {rows.map((asset) => (
            <tr key={asset.asset_id} className="transition-colors hover:bg-panel/70">
              <Td>
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-plum-soft text-plum"><TypeIcon type={asset.asset_type} /></span>
              </Td>
              <Td>
                <Link to={`/catalog/${asset.asset_id}`} className="line-clamp-1 font-medium text-plum hover:underline">{asset.title}</Link>
                <div className="mt-1 line-clamp-1 text-xs text-muted">{asset.summary || asset.description || '缺少摘要'}</div>
              </Td>
              <Td className="font-mono text-xs text-muted">{asset.asset_id}</Td>
              <Td><DirectoryChip value={asset.status} /></Td>
              <Td>{asset.owner || '—'}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {asset.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  {asset.tags.length > 2 ? <Badge>+{asset.tags.length - 2}</Badge> : null}
                  {asset.tags.length === 0 ? <span className="text-xs text-muted">—</span> : null}
                </div>
              </Td>
              <Td className="text-muted">{formatDate(asset.updated_at)}</Td>
              <Td>
                <Link to={`/catalog/${asset.asset_id}`} className="inline-flex h-8 items-center rounded-full bg-plum-soft px-3 text-[13px] font-medium text-plum transition-colors hover:bg-[#cdece6]">
                  查看
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableShell>
  )
}

export function DataCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [assetType, setAssetType] = useState('')

  const assetsQuery = useQuery({ queryKey: ['assets', 'catalog'], queryFn: () => datahubApi.assets({ page_size: 200 }) })
  const optionsQuery = useQuery({ queryKey: ['options'], queryFn: () => datahubApi.options() })

  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data])
  const optionLines = useMemo(() => optionsQuery.data?.business_lines ?? [], [optionsQuery.data])
  const businessLines = useMemo(() => {
    const names = new Map(optionLines.map((item) => [item.slug, item.name]))
    assets.forEach((asset) => { if (!names.has(asset.business_line)) names.set(asset.business_line, asset.business_line) })
    return [...names.entries()]
      .map(([slug, name]) => ({ slug, name, count: assets.filter((asset) => asset.business_line === slug).length }))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
  }, [assets, optionLines])

  const requestedLine = searchParams.get('line')
  const activeLine = requestedLine || businessLines[0]?.slug || ''
  const requestedFolder = searchParams.get('folder') || 'all'
  const activeDirectory = directories.find((item) => item.id === requestedFolder)
  const activeLineName = businessLines.find((item) => item.slug === activeLine)?.name || activeLine || '未选择业务线'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const lineAssets = useMemo(() => assets.filter((asset) => asset.business_line === activeLine), [assets, activeLine])

  const counts = useMemo(() => {
    const count = (predicate: (asset: Asset) => boolean) => lineAssets.filter(predicate).length
    return {
      total: lineAssets.length,
      raw: count((asset) => asset.status === 'raw'),
      processing: count((asset) => ['parsed', 'cleaned'].includes(asset.status)),
      review: count((asset) => asset.status === 'waiting_review'),
      ready: count((asset) => ['approved', 'indexed', 'serving'].includes(asset.status)),
      failed: count((asset) => asset.status === 'rejected' || asset.index_status === 'failed'),
    }
  }, [lineAssets])

  const directoryCounts = useMemo(() => {
    const result: Record<string, number> = { all: lineAssets.length }
    directories.forEach((directory) => {
      result[directory.id] = lineAssets.filter((asset) => matchesDirectory(asset, directory.id)).length
    })
    return result
  }, [lineAssets])

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    return lineAssets
      .filter((asset) => !status || asset.status === status)
      .filter((asset) => !assetType || asset.asset_type === assetType)
      .filter((asset) => !keyword || [asset.title, asset.asset_id, asset.owner, asset.summary || '', ...(asset.tags ?? [])].join(' ').toLowerCase().includes(keyword))
      .filter((asset) => requestedFolder === 'all' || matchesDirectory(asset, requestedFolder))
  }, [lineAssets, q, status, assetType, requestedFolder])

  const directorySections = useMemo(() => {
    const keyword = q.trim().toLowerCase()
    const searchable = lineAssets
      .filter((asset) => !status || asset.status === status)
      .filter((asset) => !assetType || asset.asset_type === assetType)
      .filter((asset) => !keyword || [asset.title, asset.asset_id, asset.owner, asset.summary || '', ...(asset.tags ?? [])].join(' ').toLowerCase().includes(keyword))
    return directories
      .map((directory) => ({ directory, rows: searchable.filter((asset) => matchesDirectory(asset, directory.id)) }))
      .filter((item) => requestedFolder === 'all' || item.directory.id === requestedFolder)
  }, [lineAssets, q, status, assetType, requestedFolder])

  const loading = assetsQuery.isLoading || optionsQuery.isLoading
  const error = assetsQuery.error || optionsQuery.error
  const retry = () => { assetsQuery.refetch(); optionsQuery.refetch() }
  const pipelineTotal = counts.total
  const pipelineProgress = counts.processing + counts.review + counts.ready
  const hasDirectoryResults = requestedFolder === 'all'
    ? directorySections.some((item) => item.rows.length > 0)
    : filtered.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据目录"
        description="按“业务线 → 生命周期目录 → 资产列表”浏览企业知识资产。每份资料保留唯一 asset_id 和详情入口。"
        meta={(
          <>
            <Badge tone="plum">{assets.length} 项资产</Badge>
            <Badge tone="neutral">{businessLines.length} 条业务线</Badge>
            <Badge tone="warning">{counts.failed} 项阻塞</Badge>
          </>
        )}
        actions={<Button variant="primary" onClick={retry} loading={assetsQuery.isFetching || optionsQuery.isFetching}><RefreshCw className="size-4" />刷新目录</Button>}
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
            {[
              { label: '当前业务线资产', value: counts.total, hint: activeLineName, icon: Layers },
              { label: '待处理 Raw', value: counts.raw, hint: '尚未进入解析' , icon: FolderOpen },
              { label: '处理中 / 待审核', value: counts.processing + counts.review, hint: `${counts.processing} 处理中 · ${counts.review} 待审核`, icon: Workflow },
              { label: '成功 / 阻塞', value: counts.ready, hint: `${counts.failed} 项失败或驳回`, icon: BadgeCheck },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-muted">{item.label}</p>
                      <p className="mt-2 font-display text-3xl leading-none font-semibold text-plum">{item.value}</p>
                      <p className="mt-3 truncate text-xs text-muted">{item.hint}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-plum-soft text-plum"><item.icon className="size-5" /></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>生命周期状态摘要</CardTitle>
                <CardDescription>摘要范围跟随当前选中的一级业务线。</CardDescription>
              </div>
              <span className="font-display text-2xl font-semibold text-plum">{pipelineTotal ? Math.round((pipelineProgress / pipelineTotal) * 100) : 0}%</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-line">
                {pipelineTotal ? (
                  <>
                    <div style={{ width: `${(counts.raw / pipelineTotal) * 100}%`, backgroundColor: '#ccfbf1' }} />
                    <div style={{ width: `${(counts.processing / pipelineTotal) * 100}%`, backgroundColor: '#0d9488' }} />
                    <div style={{ width: `${(counts.review / pipelineTotal) * 100}%`, backgroundColor: '#d97706' }} />
                    <div style={{ width: `${(counts.ready / pipelineTotal) * 100}%`, backgroundColor: '#0f766e' }} />
                    <div style={{ width: `${(counts.failed / pipelineTotal) * 100}%`, backgroundColor: '#d1568a' }} />
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">Raw · {counts.raw}</Badge>
                <Badge tone="plum">处理中 · {counts.processing}</Badge>
                <Badge tone="warning">待审核 · {counts.review}</Badge>
                <Badge tone="success">成功 · {counts.ready}</Badge>
                <Badge tone="danger">失败 · {counts.failed}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>一级业务线</CardTitle>
                <CardDescription>先选择业务线，再进入它的生命周期目录。</CardDescription>
              </div>
              <FolderTree className="size-5 text-plum" />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {businessLines.map((line) => {
                const active = line.slug === activeLine
                const lineTotal = assets.filter((asset) => asset.business_line === line.slug).length
                return (
                  <button
                    key={line.slug}
                    type="button"
                    onClick={() => setParam('line', line.slug)}
                    className={`flex min-h-20 items-center justify-between rounded-2xl border p-4 text-left transition-all ${active ? 'border-plum/30 bg-plum-soft shadow-sm' : 'border-line bg-panel hover:border-plum/20 hover:bg-surface'}`}
                  >
                    <span>
                      <span className={`block text-sm font-semibold ${active ? 'text-plum' : 'text-ink'}`}>{line.name}</span>
                      <span className="mt-1 block font-mono text-xs text-muted">{line.slug}</span>
                    </span>
                    <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs ${active ? 'bg-surface text-plum' : 'bg-surface text-muted'}`}>{lineTotal}</span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>二级生命周期目录</CardTitle>
                <CardDescription>{activeLineName} · 选择目录后，下方只展示对应资产。</CardDescription>
              </div>
              <Badge tone="plum">{activeDirectory ? activeDirectory.label : '全部目录'}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <button
                type="button"
                onClick={() => setParam('folder', 'all')}
                className={`flex min-h-20 flex-col justify-between rounded-2xl border p-4 text-left transition-all ${requestedFolder === 'all' ? 'border-plum/30 bg-plum-soft shadow-sm' : 'border-line bg-panel hover:border-plum/20 hover:bg-surface'}`}
              >
                <Layers className="size-4 text-plum" />
                <span className="mt-3 block text-sm font-medium text-plum">全部目录</span>
                <span className="text-xs text-muted">{directoryCounts.all ?? 0} 项</span>
              </button>
              {directories.map((directory) => {
                const active = requestedFolder === directory.id
                return (
                  <button
                    key={directory.id}
                    type="button"
                    onClick={() => setParam('folder', directory.id)}
                    className={`flex min-h-20 flex-col justify-between rounded-2xl border p-4 text-left transition-all ${active ? 'border-plum/30 bg-plum-soft shadow-sm' : 'border-line bg-panel hover:border-plum/20 hover:bg-surface'}`}
                  >
                    <directory.icon className="size-4 text-plum" />
                    <span className="mt-3 block text-sm font-medium text-plum">{directory.label}</span>
                    <span className="font-mono text-xs text-muted">{directory.path} · {directoryCounts[directory.id] ?? 0}</span>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>资产列表</CardTitle>
            <CardDescription>这是目录的第三层。筛选只影响资产列表，不改变上方目录计数。</CardDescription>
          </div>
          <Badge tone="plum">{filtered.length} 项</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-11" placeholder="搜索标题、asset_id、负责人或标签" value={q} onChange={(event) => setQ(event.target.value)} />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部状态</option>
              {['raw', 'parsed', 'cleaned', 'waiting_review', 'approved', 'indexed', 'serving', 'rejected', 'archived'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </Select>
            <Select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
              <option value="">全部类型</option>
              {(optionsQuery.data?.asset_types ?? []).map((item) => <option key={item} value={item}>{fileLabel(item)}</option>)}
            </Select>
            <Button variant="outline" onClick={() => { setQ(''); setStatus(''); setAssetType('') }}>重置筛选</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-medium text-plum">{activeLineName}</span>
            <ArrowRight className="size-4" />
            <span className="font-medium text-ink">{activeDirectory?.label || '全部生命周期目录'}</span>
            <ArrowRight className="size-4" />
            <span>资产列表</span>
          </div>

          {assetsQuery.isLoading || optionsQuery.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-panel" />)}</div>
          ) : assetsQuery.error || optionsQuery.error ? (
            <ErrorState error={assetsQuery.error || optionsQuery.error} onRetry={retry} />
          ) : !hasDirectoryResults ? (
            <EmptyState
              title="当前目录没有资产"
              description="切换其他生命周期目录，或重置筛选。新资料应先从原始数据页接入。"
              action={(
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setQ(''); setStatus(''); setAssetType(''); setParam('folder', 'all') }}>重置筛选</Button>
                  <Link to="/raw" className="inline-flex h-10 items-center rounded-full bg-[linear-gradient(135deg,#0f766e,#0d9488)] px-4 text-sm font-medium text-white shadow-[0_12px_28px_-18px_rgba(15,118,110,.95)] transition-transform hover:-translate-y-px">登记原始资产</Link>
                </div>
              )}
            />
          ) : (
            <div className="space-y-7">
              {directorySections.map(({ directory, rows }) => rows.length === 0 ? null : (
                <section key={directory.id} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-plum">
                        <directory.icon className="size-5" />{directory.label}
                      </h2>
                      <p className="mt-1 font-mono text-xs text-muted">{activeLineName} / {directory.path}</p>
                    </div>
                    {requestedFolder === 'all' ? (
                      <Button size="sm" variant="ghost" onClick={() => setParam('folder', directory.id)}>
                        只看此目录<ArrowRight className="size-4" />
                      </Button>
                    ) : null}
                    <Badge tone="neutral">{rows.length} 项</Badge>
                  </div>
                  <AssetTable rows={rows} />
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
