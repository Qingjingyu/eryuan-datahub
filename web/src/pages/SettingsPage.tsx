import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, BadgeCheck, Cog, Database, KeyRound, LifeBuoy, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryBoundary } from '@/components/data/States'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { currentApiMode, datahubApi } from '@/services/datahub-api'
import { formatDate } from '@/lib/utils'

export function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const optionsQuery = useQuery({ queryKey: ['options'], queryFn: () => datahubApi.options() })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => datahubApi.adminUsers() })
  const auditQuery = useQuery({ queryKey: ['audit-logs'], queryFn: () => datahubApi.auditLogs() })
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: () => datahubApi.health(), refetchInterval: 30_000 })

  async function save() { setSaving(true); await new Promise((resolve) => setTimeout(resolve, 500)); setSaving(false) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="集中管理用户、业务线、数据边界、运行模式和安全策略。生产环境必须关闭演示模式。"
        meta={<><Badge tone={currentApiMode() === 'live' ? 'success' : 'warning'}>API 模式：{currentApiMode()}</Badge><Badge tone={healthQuery.data?.status === 'ok' ? 'success' : 'warning'}>Health：{healthQuery.data?.status || 'checking'}</Badge></>}
        actions={<Button variant="primary" loading={saving} onClick={save}><Cog className="size-4" />保存配置</Button>}
      />

      <Tabs
        items={[
          {
            id: 'users',
            label: '用户与角色',
            content: (
              <QueryBoundary loading={usersQuery.isLoading} error={usersQuery.error} retry={() => usersQuery.refetch()} skeleton={<div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
                <TableShell>
                  <Table>
                    <thead><tr><Th>用户</Th><Th>username</Th><Th>role</Th><Th>业务线</Th><Th>状态</Th><Th className="w-28" /></tr></thead>
                    <tbody>
                      {(usersQuery.data ?? []).map((user) => (
                        <tr key={user.username} className="hover:bg-panel/70">
                          <Td><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-plum text-xs font-semibold text-white">{(user.display_name || user.username).slice(0, 1)}</span><span className="font-medium">{user.display_name || user.username}</span></div></Td>
                          <Td className="font-mono text-xs">{user.username}</Td>
                          <Td><Badge tone={user.role === 'admin' ? 'plum' : user.role === 'reviewer' ? 'info' : 'neutral'}>{user.role}</Badge></Td>
                          <Td>{user.business_line}</Td>
                          <Td><StatusBadge status={user.active ? 'success' : 'archived'} /></Td>
                          <Td><Button size="sm" variant="outline">编辑</Button></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableShell>
              </QueryBoundary>
            ),
          },
          {
            id: 'metadata',
            label: '业务线与元数据',
            content: (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader><div><CardTitle className="text-lg">业务线</CardTitle><CardDescription>资产隔离的第一层边界。</CardDescription></div><Database className="size-5 text-plum" /></CardHeader>
                  <CardContent className="space-y-3">
                    <QueryBoundary loading={optionsQuery.isLoading} error={optionsQuery.error} retry={() => optionsQuery.refetch()}>
                      {(optionsQuery.data?.business_lines ?? []).map((line) => (
                        <div key={line.slug} className="flex items-center justify-between rounded-2xl bg-panel px-4 py-3"><div><div className="text-sm font-medium text-plum">{line.name}</div><div className="mt-1 font-mono text-xs text-muted">{line.slug}</div></div><Badge tone="info">启用</Badge></div>
                      ))}
                    </QueryBoundary>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><div><CardTitle className="text-lg">状态与类型</CardTitle><CardDescription>这些枚举用于统一状态机。</CardDescription></div><Activity className="size-5 text-plum" /></CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-2">{(optionsQuery.data?.statuses ?? []).map((status) => <StatusBadge key={status} status={status} />)}</div>
                    <div className="flex flex-wrap gap-2">{(optionsQuery.data?.asset_types ?? []).map((type) => <Badge key={type}>{type}</Badge>)}</div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'security',
            label: '安全与审计',
            content: (
              <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-4">
                  {[
                    { icon: ShieldCheck, title: '最小权限', desc: 'Admin / Reviewer / Member 分离。' },
                    { icon: KeyRound, title: 'Token 认证', desc: '前端仅保存 Bearer Token。' },
                    { icon: BadgeCheck, title: '动作留痕', desc: '创建、审核、索引、Agent 读取均写入 audit_logs。' },
                    { icon: LifeBuoy, title: '演示边界', desc: 'Mock 数据只用于验收演示，不得用于生产。' },
                  ].map((item) => (
                    <Card key={item.title}><CardContent className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-plum-soft text-plum"><item.icon className="size-5" /></span><div><div className="font-medium text-plum">{item.title}</div><p className="mt-1 text-sm leading-6 text-muted">{item.desc}</p></div></CardContent></Card>
                  ))}
                </div>
                <QueryBoundary loading={auditQuery.isLoading} error={auditQuery.error} retry={() => auditQuery.refetch()} skeleton={<div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
                  <TableShell>
                    <Table>
                      <thead><tr><Th>actor</Th><Th>action</Th><Th>resource</Th><Th>reason</Th><Th>时间</Th></tr></thead>
                      <tbody>
                        {(auditQuery.data ?? []).map((log, index) => (
                          <tr key={index} className="hover:bg-panel/70">
                            <Td>{String(log.actor ?? '—')}</Td><Td><Badge>{String(log.action ?? '—')}</Badge></Td><Td className="font-mono text-xs">{String(log.resource ?? '—')}</Td><Td className="text-muted">{String(log.reason ?? '—')}</Td><Td className="text-muted">{formatDate(String(log.created_at ?? ''))}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableShell>
                </QueryBoundary>
              </div>
            ),
          },
          {
            id: 'runtime',
            label: '运行模式',
            content: (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: 'Mock', desc: '使用内置 22 个资产和完整演示链路。', value: currentApiMode() === 'mock', code: 'VITE_API_MODE=mock' },
                  { title: 'Auto', desc: '先请求 FastAPI，后端不可用时回退 Mock。', value: currentApiMode() === 'auto', code: 'VITE_API_MODE=auto' },
                  { title: 'Live', desc: '只连接真实后端，失败直接提示错误。', value: currentApiMode() === 'live', code: 'VITE_API_MODE=live' },
                ].map((item) => (
                  <Card key={item.title} className={item.value ? 'border-plum' : ''}><CardContent><div className="flex items-center justify-between"><div className="font-display text-xl font-semibold text-plum">{item.title}</div>{item.value ? <Badge tone="plum">当前</Badge> : null}</div><p className="mt-3 text-sm leading-6 text-muted">{item.desc}</p><code className="mt-4 block rounded-xl bg-panel px-3 py-2 text-xs text-muted">{item.code}</code></CardContent></Card>
                ))}
              </div>
            ),
          },
        ]}
      />

      <Card className="bg-plum text-white">
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><div className="font-display text-xl font-semibold">生产切换清单</div><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">使用 PostgreSQL 持久化、对象存储保存原始文件、HTTPS + 域名、独立 Worker、只开放受控 API，并关闭 Mock 回退。</p></div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-3"><Users className="size-5" /><span className="text-sm">数据不入模型训练</span></div>
        </CardContent>
      </Card>
    </div>
  )
}
