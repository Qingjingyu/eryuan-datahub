import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BadgeCheck, Database, DollarSign, Megaphone, ShoppingCart, Users } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryBoundary, StatCard } from '@/components/data/States'
import { Section } from '@/components/data/Section'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableShell, Td, Th } from '@/components/ui/Table'
import { datahubApi } from '@/services/datahub-api'
import { formatNumber } from '@/lib/utils'

const tooltip = { borderRadius: 16, border: '1px solid #dbeae7', background: '#fff', fontSize: 12 }

export function ZhuangzhouOperationsPage() {
  const overviewQuery = useQuery({ queryKey: ['business', 'overview'], queryFn: () => datahubApi.businessOverview() })
  const trendsQuery = useQuery({ queryKey: ['business', 'trends'], queryFn: () => datahubApi.businessTrends() })
  const hostsQuery = useQuery({ queryKey: ['business', 'hosts'], queryFn: () => datahubApi.businessHosts() })
  const itemsQuery = useQuery({ queryKey: ['business', 'items'], queryFn: () => datahubApi.businessItems() })

  const overview = overviewQuery.data
  const trends = trendsQuery.data ?? []
  const hosts = hostsQuery.data ?? []
  const items = itemsQuery.data ?? []
  const loading = overviewQuery.isLoading || trendsQuery.isLoading || hostsQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="妆舟业务运营"
        description="围绕主播、直播、投流、产品、订单、售后和合规风险，查看妆舟全生命周期业务表现。"
        meta={<><BadgeCheck className="size-4 text-success" /><span className="text-sm text-muted">数据来自 PostgreSQL 真实资产账本</span></>}
      />

      <QueryBoundary loading={loading} error={overviewQuery.error || trendsQuery.error} retry={() => { overviewQuery.refetch(); trendsQuery.refetch(); hostsQuery.refetch() }}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="业务数据集" value={formatNumber(overview?.total_items)} icon={Database} />
          <StatCard label="GMV" value={`¥${formatNumber(overview?.gmv)}`} icon={DollarSign} tone="success" />
          <StatCard label="投流消耗" value={`¥${formatNumber(overview?.ad_spend)}`} icon={Megaphone} tone="warning" />
          <StatCard label="整体 ROI" value={overview?.roi ?? '—'} icon={BadgeCheck} tone="info" />
          <StatCard label="订单量" value={formatNumber(overview?.orders)} icon={ShoppingCart} tone="violet" />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div><CardTitle>GMV / 投流 / 订单趋势</CardTitle><CardDescription>按业务数据最近更新日期聚合。</CardDescription></div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0} /></linearGradient>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b86d1" stopOpacity={0.3} /><stop offset="100%" stopColor="#5b86d1" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#f0ede9" /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip contentStyle={tooltip} />
                <Area type="monotone" dataKey="gmv" stroke="#0f766e" fill="url(#gmvFill)" /><Area type="monotone" dataKey="spend" stroke="#5b86d1" fill="url(#spendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><div><CardTitle>主播 GMV 排行</CardTitle><CardDescription>按业务数据聚合。</CardDescription></div><Users className="size-5 text-plum" /></CardHeader>
            <CardContent className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={hosts}><CartesianGrid stroke="#f0ede9" /><XAxis dataKey="host" fontSize={11} /><YAxis fontSize={11} /><Tooltip contentStyle={tooltip} /><Bar dataKey="gmv" fill="#0f766e" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>主播经营明细</CardTitle><CardDescription>GMV、投流、订单和直播场次。</CardDescription></div><Users className="size-5 text-plum" /></CardHeader>
            <CardContent>
              <TableShell><Table><thead><tr><Th>主播</Th><Th>GMV</Th><Th>投流</Th><Th>ROI</Th><Th>订单</Th><Th>场次</Th></tr></thead><tbody>{hosts.map(row => <tr key={row.host}><Td>{row.host}</Td><Td>¥{formatNumber(row.gmv)}</Td><Td>¥{formatNumber(row.spend)}</Td><Td>{row.roi ?? '—'}</Td><Td>{formatNumber(row.orders)}</Td><Td>{row.lives}</Td></tr>)}</tbody></Table></TableShell>
            </CardContent>
          </Card>
        </div>

        <Section title="妆舟业务数据清单" description="包含主播、直播、投流、订单、售后、内容、供应商、SOP、风险和复盘。">
          <TableShell><Table><thead><tr><Th>资产</Th><Th>业务域</Th><Th>业务对象</Th><Th>状态</Th><Th>负责人</Th><Th>关键指标</Th></tr></thead><tbody>{items.map(item => <tr key={item.asset_id} className="hover:bg-panel/70"><Td><a href={`/catalog/${item.asset_id}`} className="font-medium text-plum hover:underline">{item.title}</a><div className="font-mono text-xs text-muted">{item.asset_id}</div></Td><Td>{item.domain}</Td><Td>{item.entity}</Td><Td>{item.status}</Td><Td>{item.owner}</Td><Td className="font-mono text-xs">{Object.entries(item.metrics).slice(0,3).map(([key,value]) => `${key}: ${value}`).join(' · ')}</Td></tr>)}</tbody></Table></TableShell>
        </Section>
      </QueryBoundary>
    </div>
  )
}
