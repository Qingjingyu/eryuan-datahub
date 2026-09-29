import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Boxes, Database, Eye, EyeOff, Lock, ShieldCheck, User as UserIcon, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Form'
import { datahubApi, getStoredUser } from '@/services/datahub-api'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (getStoredUser()) return <Navigate to="/" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await datahubApi.login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(500px,42%)]">
      <section className="grid-noise relative hidden flex-col justify-between bg-plum p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-plum"><Boxes className="size-6" /></div>
          <div>
            <div className="font-display text-xl font-semibold">二元空间 DataHub</div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Enterprise Context Plane</div>
          </div>
        </div>

        <div className="max-w-[620px]">
          <h1 className="font-display text-6xl leading-[1.08] font-semibold tracking-tight">让企业资料变成<br />可治理、可调用的知识</h1>
          <p className="mt-6 max-w-[520px] text-lg leading-8 text-white/68">原始数据进入受控资产账本，经过解析、清洗、审核、索引后，才能被人与 Agent 检索、引用和调用。每一步都有身份、状态、权限与审计。</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Database, title: 'Asset Registry', text: '唯一资产身份与版本' },
              { icon: Workflow, title: 'Lifecycle', text: '状态机与人工审核' },
              { icon: ShieldCheck, title: 'Trust Boundary', text: '引用可溯与权限控制' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/12 bg-white/8 p-4">
                <item.icon className="size-5" />
                <div className="mt-3 font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-white/58">{item.text}</div>
              </div>
            ))}
          </div>
        </div>

        <footer className="text-sm text-white/42">NocoBase / RAGFlow / PostgreSQL / Object Storage · 第 1-6 期验收版</footer>
      </section>

      <section className="flex items-center justify-center bg-background p-6 md:p-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-7 md:p-8">
            <div className="mb-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-plum-soft text-plum lg:hidden"><Boxes className="size-6" /></div>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-plum">登录控制台</h2>
              <p className="mt-2 text-sm leading-6 text-muted">使用企业账号进入数据资产工作台。</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <Field label="用户名">
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-11" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
                </div>
              </Field>
              <Field label="密码">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-11 pr-11" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted hover:bg-plum-soft/70" onClick={() => setShowPassword((value) => !value)} aria-label="显示或隐藏密码">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {error ? <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

              <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                进入 DataHub <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-7 rounded-2xl border border-line bg-panel p-4 text-sm leading-6 text-muted">
              <div className="font-medium text-plum">验收演示账号</div>
              <p className="mt-1">本地演示账号：demo / demo123<br />正式账号由管理员单独交付</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
