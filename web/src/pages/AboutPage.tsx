import { ArrowUpRight, BookOpenCheck, Building2, Boxes, CircleCheck, Database, FileText, GitBranch, Globe2, Layers, Library, Network, ShieldCheck, Workflow } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { Section } from '@/components/data/Section'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

const pipeline = [
  { icon: FileText, title: 'Source', label: '原始资料', desc: '文档、表格、图片、系统导出' },
  { icon: Boxes, title: 'Registry', label: '资产登记', desc: 'asset_id / owner / tags / version' },
  { icon: Workflow, title: 'Process', label: '解析清洗', desc: 'Markdown / chunks / metadata' },
  { icon: ShieldCheck, title: 'Review', label: '人工审核', desc: '合规、事实和业务口径确认' },
  { icon: Database, title: 'Index', label: '受控索引', desc: 'embedding / retrieval / citation' },
  { icon: Globe2, title: 'Serving', label: '服务调用', desc: 'Search / Ask / Agent / Graph' },
]

const principles = [
  { icon: Boxes, title: '资料必须有身份', desc: '没有 asset_id 的文件只是附件；有身份的资料才是可治理资产。', basis: 'Metadata-first Management / OpenMetadata / Apache Atlas' },
  { icon: Workflow, title: '状态机优先于自由上传', desc: 'Raw → Parsed → Cleaned → Waiting Review → Approved → Indexed → Serving，状态不可跳过。', basis: 'Lakehouse Medallion Architecture / Data Contract' },
  { icon: ShieldCheck, title: '人审是信任门槛', desc: '进入知识服务前必须有 Reviewer 和意见；驳回原因也要留痕。', basis: 'Human-in-the-loop / Enterprise Knowledge Governance' },
  { icon: Layers, title: '原文、清洗结果、索引分离', desc: '原始文件不可覆盖；处理结果可重建；索引用于加速而非唯一事实。', basis: 'Bronze / Silver / Gold + Source of Record' },
  { icon: Network, title: '语义图谱承接业务关系', desc: '图谱保留关系来源和置信度，让业务依赖可解释。', basis: 'Knowledge Graph / OpenLineage' },
  { icon: Globe2, title: '人和 Agent 共用同一边界', desc: 'API 只暴露被授权、被过滤、带引用的上下文，Agent 不直连数据库。', basis: 'Context Plane / Tool Gateway / Model Context Protocol' },
]

const references = [
  { name: 'OpenMetadata', url: 'https://open-metadata.org/', use: '元数据、资产目录、血缘和治理字段设计。', org: 'Linux Foundation' },
  { name: 'Apache Atlas', url: 'https://atlas.apache.org/', use: '企业元数据分类、标签和治理模型参考。', org: 'Apache' },
  { name: 'DataHub', url: 'https://datahubproject.io/', use: '资产实体、关系图谱、业务线与所有权建模。', org: 'LinkedIn' },
  { name: 'RAGFlow', url: 'https://github.com/infiniflow/ragflow', use: '文档解析、切分、引用式 RAG 与检索验证。', org: 'Infiniflow' },
  { name: 'NocoBase', url: 'https://www.nocobase.com/', use: '低代码控制台、权限模型和配置式页面参考。', org: 'NocoBase' },
  { name: 'Apache Superset', url: 'https://superset.apache.org/', use: 'BI 指标、图表语义和数据权限分层。', org: 'Apache' },
  { name: 'Neo4j', url: 'https://neo4j.com/', use: '图谱存储、Cypher 查询和关系网络可视化。', org: 'Neo4j' },
  { name: 'Model Context Protocol', url: 'https://modelcontextprotocol.io/', use: 'Agent 工具边界、上下文协议与受控资源访问。', org: 'Open / Anthropic' },
]

const roadmap = [
  { phase: '第 1 期', title: '底座与身份', items: ['FastAPI Core', 'PostgreSQL 账本', 'Raw / Staging / Curated 分区', '用户与角色'] },
  { phase: '第 2 期', title: '资产链路', items: ['资产登记', '文件上传', '解析任务', '状态流转'] },
  { phase: '第 3 期', title: '审核与索引', items: ['审核中心', '审计日志', 'Approved 门槛', '索引/Serving'] },
  { phase: '第 4 期', title: '检索与 Agent', items: ['引用式检索', 'Ask API', 'Agent Tool Gateway', 'AgentLog'] },
  { phase: '第 5 期', title: '知识图谱', items: ['实体与关系', '来源资产', '置信度', '人审 candidate'] },
  { phase: '第 6 期', title: 'BI 与门户', items: ['处理效率', '调用价值', '统一设计系统', '验收入口'] },
]

const acceptance = [
  { label: '资产可登记 / 上传', value: 100 },
  { label: '解析成功率', value: 90 },
  { label: '检索 Top5 命中', value: 90 },
  { label: '回答引用覆盖率', value: 100 },
  { label: '关键操作审计覆盖率', value: 100 },
]

export function AboutPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="关于 / 设计原理"
        description="这一页解释 DataHub 的底层逻辑：为什么资料要变成资产、为什么要有审核、为什么 AI 只能使用 Approved 后的知识，以及每个阶段对应什么操作。"
      />

      <Section title="先看懂怎么用" description="你可以把 DataHub 理解成一个“企业知识工厂”：资料进来、变成资产、经过处理和审核，最后变成可调用的知识服务。">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: '01', title: '看数据在哪', desc: '进入数据目录，按原始数据、解析完成、清洗完成、待审核、已审核、知识服务等目录查找。' },
            { step: '02', title: '看处理过程', desc: '进入解析与清洗、审核中心，查看每个任务是否成功、失败原因和当前负责人。' },
            { step: '03', title: '问结果', desc: '在知识检索或 Agent 助手里提问，系统只使用已审核资产，并返回来源引用。' },
          ].map((item) => (
            <Card key={item.step}>
              <CardHeader>
                <div>
                  <div className="text-xs font-bold text-muted">{item.step}</div>
                  <CardTitle className="mt-2 text-lg">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-muted">{item.desc}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

<PageHeader
        title="关于 / 设计原理"
        description="这份页面是 DataHub 的总纲：说明我们为什么做、方法来自哪里、每一步怎么落地、为什么这套方法对人和 Agent 都更稳定。"
        meta={<><Badge tone="plum">Enterprise Context Plane</Badge><Badge tone="success">1-6 期验收版</Badge><Badge tone="info">中文优先</Badge></>}
        actions={<Button variant="outline" onClick={() => window.print()}><BookOpenCheck className="size-4" />导出 / 打印</Button>}
      />

      <Card className="overflow-hidden bg-plum text-white">
        <CardContent className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]">
          <div>
            <Badge className="border-white/20 bg-white/10 text-white">产品判断</Badge>
            <h2 className="mt-4 font-display text-4xl leading-tight font-semibold">企业不缺文件，缺的是可信上下文</h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">资料散落在网盘、邮件、会议、CRM 和个人电脑里，文件本身不产生决策。只有把资料变成有身份、有负责人、有业务口径、有审核边界和引用关系的资产，才能被人复用，也才能被 Agent 安全调用。</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['Asset Registry', 'Lifecycle', 'Human Review', 'Controlled Index', 'Citations', 'Agent Boundary'].map((item) => <span key={item} className="rounded-full border border-white/16 bg-white/8 px-4 py-2 text-sm">{item}</span>)}
            </div>
          </div>
          <div className="rounded-[var(--radius-card)] border border-white/12 bg-white/8 p-6">
            <div className="text-sm text-white/55">一句话定义</div>
            <p className="mt-3 font-display text-2xl leading-9">DataHub 是企业的 Context Plane：把分散资料治理成可信知识，并把知识安全地供给人和 Agent。</p>
            <div className="mt-6 space-y-3 text-sm text-white/68">
              <div className="flex items-center gap-2"><CircleCheck className="size-4" />对业务人员：可找、可看、可追溯。</div>
              <div className="flex items-center gap-2"><CircleCheck className="size-4" />对治理人员：可审、可管、可审计。</div>
              <div className="flex items-center gap-2"><CircleCheck className="size-4" />对 Agent：可调用、可引用、可限权。</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Section title="标准处理链路" description="每一步都有输入、输出、责任人和失败处理。任何一步没有完成，资产不能进入下一阶段。">
        <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {pipeline.map((item, index) => (
            <Card key={item.title}>
              <CardContent>
                <div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-2xl bg-plum-soft text-plum"><item.icon className="size-5" /></span><span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, '0')}</span></div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{item.title}</div>
                <div className="mt-1 font-display text-lg font-semibold text-plum">{item.label}</div>
                <p className="mt-2 text-sm leading-6 text-muted">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="设计原则与依据" description="这些原则不是凭感觉定的，而是参考元数据治理、Medallion 架构、知识图谱、RAG 和 Agent 协议后收敛成的企业规则。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {principles.map((item) => (
            <Card key={item.title}>
              <CardContent>
                <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-plum text-white"><item.icon className="size-5" /></span><div><h3 className="font-display text-xl font-semibold text-plum">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{item.desc}</p></div></div>
                <div className="mt-4 rounded-2xl bg-panel p-3 text-xs leading-5 text-muted"><strong className="text-plum">依据：</strong>{item.basis}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="技术架构" description="前端只做控制台；Core API 承载业务规则；PostgreSQL 是资产账本；对象存储保存文件；Worker 执行解析；检索和图谱作为服务层。">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
          <Card><CardHeader><CardTitle>分层拓扑</CardTitle><CardDescription>边界清楚，才能替换单个组件而不重写系统。</CardDescription></CardHeader><CardContent><pre className="overflow-auto rounded-2xl bg-panel p-5 text-sm leading-7 text-plum">{`Web Frontend  React / TS / Tailwind / Recharts
      ↓
Core API      Asset / Workflow / Search / Agent / Graph / BI
      ↓
PostgreSQL    Asset Registry / Jobs / Review / Audit
      ↓
Object Storage  raw / staging / curated / index_input / agent_output
      ↓
Worker        parse → clean → chunk → embed → graph_extract
      ↓
Services      Retrieval / RAG / Graph / BI / Agent Gateway`}</pre></CardContent></Card>
          <Card><CardHeader><CardTitle>组件职责</CardTitle><CardDescription>每个组件只做一件事。</CardDescription></CardHeader><CardContent className="space-y-4">
            {[
              { name: 'PostgreSQL', desc: '唯一资产事实源，不保存大文件本体。' },
              { name: 'Object Storage', desc: '保存原始文件和处理文件，保留 checksum。' },
              { name: 'Worker', desc: '只能按资产状态处理，不能绕过审核。' },
              { name: 'RAG / Index', desc: '加速检索，不替代 PostgreSQL 账本。' },
              { name: 'Agent Gateway', desc: '只暴露受控工具，所有调用写日志。' },
            ].map((item) => <div key={item.name} className="rounded-2xl border border-line bg-panel p-4"><div className="font-medium text-plum">{item.name}</div><p className="mt-1 text-sm leading-6 text-muted">{item.desc}</p></div>)}
          </CardContent></Card>
        </div>
      </Section>

      <Section title="开源参考与选型证据" description="我们不是复制某个单一产品，而是吸收企业数据平台、知识治理、RAG 和 Agent 协议中的成熟方法。以下都是公开项目，可继续查阅。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {references.map((item) => (
            <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="group">
              <Card className="h-full transition-all group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-pop)]"><CardContent><div className="flex items-start justify-between gap-3"><div><div className="font-display text-lg font-semibold text-plum">{item.name}</div><div className="mt-1 text-xs text-muted">{item.org}</div></div><ArrowUpRight className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><p className="mt-3 text-sm leading-6 text-muted">{item.use}</p></CardContent></Card>
            </a>
          ))}
        </div>
      </Section>

      <Section title="1-6 期开发结果" description="第一版的目标不是覆盖所有数据平台能力，而是打通可演示、可验收、可继续扩展的完整闭环。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roadmap.map((item) => (
            <Card key={item.phase}><CardHeader><div><CardTitle className="text-lg">{item.phase} · {item.title}</CardTitle><CardDescription>已进入验收版</CardDescription></div><Badge tone="success">Done</Badge></CardHeader><CardContent className="space-y-2">{item.items.map((feature) => <div key={feature} className="flex items-center gap-2 text-sm text-muted"><CircleCheck className="size-4 text-success" />{feature}</div>)}</CardContent></Card>
          ))}
        </div>
      </Section>

      <Section title="验收口径" description="没有指标的“做完”不可信。以下口径用于内部验收和客户演示。">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {acceptance.map((item) => (
            <Card key={item.label}><CardContent className="text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-full border border-success/25 bg-success/10 font-display text-xl font-semibold text-[#2b7a50]">{item.value}%</div><p className="mt-4 text-sm font-medium text-plum">{item.label}</p></CardContent></Card>
          ))}
        </div>
      </Section>

      <Section title="下一步演进" description="完成 1-6 期后，再增加连接器、血缘、权限审批、指标口径、数据质量规则和多租户。">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Library, title: '连接器生态', desc: '飞书、Notion、Confluence、S3、OSS、CRM、ERP 批量接入。' },
            { icon: GitBranch, title: '血缘与版本', desc: '字段级血缘、版本对比、影响分析和回滚。' },
            { icon: Building2, title: '企业治理', desc: '多租户、审批流、分类分级、保留删除和数据质量规则。' },
          ].map((item) => <Card key={item.title}><CardContent><span className="flex size-11 items-center justify-center rounded-2xl bg-plum-soft text-plum"><item.icon className="size-5" /></span><div className="mt-4 font-display text-xl font-semibold text-plum">{item.title}</div><p className="mt-2 text-sm leading-6 text-muted">{item.desc}</p></CardContent></Card>)}
        </div>
      </Section>
    </div>
  )
}
