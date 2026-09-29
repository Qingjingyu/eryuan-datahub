import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpenText, Boxes, BrainCircuit, ChevronDown, Database, FileStack, FolderTree, GaugeCircle,
  LayoutDashboard, PackageCheck, LineChart, LifeBuoy, LogOut, Menu, Network, Search, ServerCog, Settings,
  ShieldCheck, Sparkles, Workflow, X,
} from 'lucide-react'
import { clearSession, currentApiMode, getStoredUser } from '@/services/datahub-api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const navigation = [
  {
    group: '工作台',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard },
      { to: '/catalog', label: '数据目录', icon: FolderTree },
    ],
  },
  {
    group: '数据生命周期',
    items: [
      { to: '/raw', label: '原始数据', icon: FileStack },
      { to: '/processing', label: '解析与清洗', icon: Workflow },
      { to: '/review', label: '审核中心', icon: ShieldCheck },
      { to: '/processed-data', label: '处理后数据', icon: PackageCheck },
      { to: '/knowledge-service', label: '知识服务', icon: ServerCog },
    ],
  },
  {
    group: '智能服务',
    items: [
      { to: '/search', label: '知识检索', icon: Search },
      { to: '/agent', label: 'Agent 助手', icon: BrainCircuit },
      { to: '/graph', label: '知识图谱', icon: Network },
    ],
  },
  {
    group: '分析',
    items: [{ to: '/analytics', label: '数据分析', icon: LineChart }],
  },
  {
    group: '系统',
    items: [
      { to: '/settings', label: '系统设置', icon: Settings },
      { to: '/about', label: '关于 / 设计原理', icon: BookOpenText },
    ],
  },
] as const

const pageMeta: Record<string, { name: string; description: string }> = {
  '/': { name: '总览', description: '资产规模、处理进度、服务调用与风险一目了然。' },
  '/catalog': { name: '数据目录', description: '像文件管理器一样浏览、检索和管理企业知识资产。' },
  '/raw': { name: '原始数据', description: '登记新资料、上传源文件，建立唯一 asset_id 身份。' },
  '/processing': { name: '解析与清洗', description: '跟踪解析、清洗、切分和嵌入任务进度。' },
  '/review': { name: '审核中心', description: '只有通过人审的资产才能进入知识服务。' },
  '/knowledge-service': { name: '知识服务', description: '管理 Approved、Indexed、Serving 的受控知识。' },
  '/processed-data': { name: '处理后数据', description: '集中查看清洗、审核、索引和服务化后的数据资产。' },
  '/search': { name: '知识检索', description: '检索答案均显示来源、版本和可追溯引用。' },
  '/agent': { name: 'Agent 助手', description: 'Agent 通过受控工具读取，不直连业务数据库。' },
  '/graph': { name: '知识图谱', description: '查看实体、关系、来源资产和置信度。' },
  '/analytics': { name: '数据分析', description: '分析处理效率、知识价值和调用趋势。' },
  '/settings': { name: '系统设置', description: '管理用户、业务线、运行模式与安全边界。' },
  '/about': { name: '关于 / 设计原理', description: '理解 DataHub 的方法论、架构依据与验收标准。' },
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-2xl bg-white text-[#0b4f49] shadow-[0_16px_32px_-20px_rgba(0,0,0,.7)]">
        <Boxes className="size-5" />
        <Sparkles className="absolute -right-1 -top-1 size-4 rounded-full bg-surface p-0.5 text-plum" />
      </div>
      <div>
        <div className="font-display text-[17px] font-semibold leading-5 text-surface">二元空间 DataHub</div>
        <div className="text-[11px] font-medium tracking-[0.16em] text-teal-200/70">CONTEXT PLANE</div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const user = getStoredUser()
  const current = useMemo(() => {
    const base = `/${location.pathname.split('/')[1] ?? ''}`
    return pageMeta[base] ?? pageMeta['/']!
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        id="datahub-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r border-white/8 bg-[linear-gradient(180deg,#073a37_0%,#0b4f49_46%,#062e2c_100%)] transition-transform duration-300 lg:translate-x-0',
          mobileOpen && 'translate-x-0 shadow-[var(--shadow-pop)]',
        )}
      >
        <div className="flex h-[76px] items-center justify-between px-5">
          <Logo />
          <Button variant="ghost" size="icon" className="text-white/60 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="关闭导航">
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {navigation.map((group, groupIndex) => {
            const key = group.group
            const open = groupOpen[key] ?? true
            return (
              <div key={key} className={cn('mb-4', groupIndex > 0 && 'border-t border-white/8 pt-4')}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
                  onClick={() => setGroupOpen((state) => ({ ...state, [key]: !open }))}
                >
                  {group.group}
                  <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
                </button>
                {open ? (
                  <div className="mt-1 space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => cn(
                          'group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm text-white/66 transition-all',
                          'hover:bg-white/8 hover:text-white',
                          isActive && 'bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-teal-300',
                        )}
                      >
                        <item.icon className="size-4.5" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/8 p-4">
          <div className="rounded-2xl bg-white/8 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><GaugeCircle className="size-4" />系统状态</div>
            <p className="mt-2 text-xs leading-5 text-white/55">API 模式：{currentApiMode()}<br />后端连接失败时自动切换演示数据。</p>
          </div>
        </div>
      </aside>

      {mobileOpen ? <div className="fixed inset-0 z-30 bg-plum/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[268px]">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-line/70 bg-surface/88 px-4 shadow-[0_1px_0_rgba(255,255,255,.7)] backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开导航"><Menu className="size-4" /></Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-muted"><Database className="size-4 text-plum" /><span className="truncate font-medium tracking-wide">二元空间数据中台</span></div>
              <h2 className="truncate font-display text-xl font-semibold text-plum">{current.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-xs text-muted xl:flex">
              <LifeBuoy className="size-3.5" />
              {current.description}
            </div>
            <div className="flex items-center gap-3 rounded-full border border-line bg-panel py-1.5 pl-2 pr-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-plum text-xs font-semibold text-white">{(user?.display_name || user?.username || '用户').slice(0, 1)}</div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-plum">{user?.display_name || user?.username || '演示用户'}</div>
                <div className="text-[11px] text-muted">{user?.role || 'admin'}</div>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => { clearSession(); window.location.href = '/login' }} aria-label="退出登录"><LogOut className="size-3.5" /></Button>
            </div>
          </div>
        </header>

        <main id="app-main" className="app-shell-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full w-full max-w-[1560px] px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
