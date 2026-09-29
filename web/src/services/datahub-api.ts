import {
  mockAgentResponse,
  mockAsk,
  mockAssets,
  mockBi,
  mockDemoUser,
  mockFiles,
  mockGraph,
  mockJobs,
  mockReviews,
  mockSearchResults,
  mockTrend,
  mockUsers,
} from '@/lib/mock-data'
import type {
  AgentResponse,
  AskResponse,
  Asset,
  AssetFile,
  AdminUser,
  BiMetrics,
  GraphData,
  MetricsTrend,
  ProcessingJob,
  ReviewLog,
  SearchHit,
  User,
} from '@/lib/types'

export type ApiMode = 'mock' | 'live' | 'auto'
export type { User }

const mode = (import.meta.env.VITE_API_MODE || 'auto') as ApiMode
const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TOKEN_KEY = 'datahub.token'
const USER_KEY = 'datahub.user'

export function currentApiMode(): ApiMode {
  return mode
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const data = await response.json()
      message = typeof data.detail === 'string' ? data.detail : data.message || message
    } catch {
      /* keep fallback message */
    }
    throw new ApiError(message, response.status)
  }
  return (await response.json()) as T
}

async function withDemoFallback<T>(live: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (mode === 'mock') return fallback()
  try {
    return await live()
  } catch (error) {
    const demoSession = getToken().startsWith('demo-')
    if (mode === 'auto' && (error instanceof TypeError || (error instanceof ApiError && (error.status >= 500 || (demoSession && error.status === 401))))) {
      return fallback()
    }
    throw error
  }
}

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const writableAssets = [...mockAssets]
const writableJobs = [...mockJobs]
const writableReviews = [...mockReviews]
const writableFiles = [...mockFiles]
const writableGraph: GraphData = JSON.parse(JSON.stringify(mockGraph))
const writableUsers = [...mockUsers]
let nextAssetId = writableAssets.length + 1
let nextJobId = writableJobs.length + 1

export interface AssetFilters {
  q?: string
  status?: string
  business_line?: string
  asset_type?: string
  owner?: string
  tag?: string
  page?: number
  page_size?: number
}

export const datahubApi = {
  async health() {
    return withDemoFallback(() => request<{ status: string; service: string }>('/api/health'), () => delay({ status: 'ok', service: 'mock-datahub' }, 80))
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    if (mode !== 'mock' && !(username === 'demo' && password === 'demo123')) {
      const result = await request<{ token: string; user: User }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      setSession(result.token, result.user)
      return result
    }

    await delay(null, 300)
    if (!username.trim() || !password.trim()) throw new ApiError('请输入用户名和密码', 401)
    const known = mockUsers.find((item) => item.username === username)
    const accepted = username === 'demo' && password === 'demo123'
    if (!accepted) throw new ApiError('本地演示账号为 demo / demo123，正式账号请使用企业管理员交付的凭据', 401)
    const user: User = known ?? { ...mockDemoUser, username, display_name: username }
    const result = { token: `demo-${username}-${Date.now()}`, user }
    setSession(result.token, result.user)
    return result
  },

  async me() {
    return withDemoFallback(
      () => request<User>('/api/v1/auth/me'),
      () => delay(getStoredUser() ?? mockDemoUser, 60),
    )
  },

  async options() {
    return withDemoFallback(
      () => request<{ business_lines: Array<{ name: string; slug: string }>; statuses: string[]; asset_types: string[] }>('/api/v1/meta/options'),
      () =>
        delay({
          business_lines: [
            { name: '妆舟', slug: 'zhuangzhou' },
            { name: '二元空间', slug: 'eryuan' },
            { name: '通用', slug: 'general' },
          ],
          statuses: ['raw', 'parsed', 'cleaned', 'waiting_review', 'approved', 'indexed', 'serving', 'rejected', 'archived'],
          asset_types: ['document', 'spreadsheet', 'image', 'audio', 'video', 'other'],
        }, 80),
    )
  },

  async assets(filters: AssetFilters = {}): Promise<Asset[]> {
    const query = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, String(value))
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return withDemoFallback(
      () => request<Asset[]>(`/api/v1/assets${suffix}`),
      () => {
        const keyword = (filters.q || '').toLowerCase()
        const rows = writableAssets.filter((asset) => {
          const matchesKeyword = !keyword || [asset.title, asset.asset_id, asset.owner, ...(asset.tags ?? [])].join(' ').toLowerCase().includes(keyword)
          const matchesStatus = !filters.status || asset.status === filters.status
          const matchesLine = !filters.business_line || asset.business_line === filters.business_line
          const matchesType = !filters.asset_type || asset.asset_type === filters.asset_type
          const matchesOwner = !filters.owner || asset.owner.toLowerCase().includes(filters.owner.toLowerCase())
          const matchesTag = !filters.tag || asset.tags.some((tag) => tag.includes(filters.tag!))
          return matchesKeyword && matchesStatus && matchesLine && matchesType && matchesOwner && matchesTag
        })
        return delay(rows)
      },
    )
  },

  async asset(assetId: string): Promise<Asset> {
    return withDemoFallback(
      () => request<Asset>(`/api/v1/assets/${assetId}`),
      () => {
        const asset = writableAssets.find((item) => item.asset_id === assetId)
        if (!asset) throw new ApiError('资产不存在', 404)
        return delay(asset)
      },
    )
  },

  async createAsset(payload: Partial<Asset> & { title: string; source_text?: string }): Promise<Asset> {
    return withDemoFallback(
      () => request<Asset>('/api/v1/assets', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const prefix = payload.business_line === 'zhuangzhou' ? 'ZZ' : payload.business_line === 'eryuan' ? 'EY' : 'GEN'
        const created: Asset = {
          id: nextAssetId,
          asset_id: `${prefix}-DOC-${String(nextAssetId).padStart(6, '0')}`,
          title: payload.title,
          asset_type: payload.asset_type || 'document',
          business_line: payload.business_line || 'general',
          owner: payload.owner || '演示用户',
          status: 'raw',
          review_status: 'pending',
          index_status: 'not_indexed',
          graph_status: 'not_generated',
          visibility: payload.visibility || 'business',
          source_type: 'upload',
          source_system: 'DataHub Console',
          source_uri: payload.source_uri || '',
          description: payload.description || '',
          summary: payload.summary || '',
          processed_markdown: '',
          source_text: payload.source_text || '',
          tags: payload.tags || [],
          version: 'v1',
          checksum: `sha256-${Date.now()}`,
          progress: 0,
          chunk_count: 0,
          call_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'demo',
        }
        writableAssets.unshift(created)
        nextAssetId += 1
        return delay(created)
      },
    )
  },

  async updateAsset(assetId: string, payload: Partial<Asset>): Promise<Asset> {
    return withDemoFallback(
      () => request<Asset>(`/api/v1/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      () => {
        const asset = writableAssets.find((item) => item.asset_id === assetId)
        if (!asset) throw new ApiError('资产不存在', 404)
        Object.assign(asset, payload, { updated_at: new Date().toISOString() })
        return delay(asset)
      },
    )
  },

  async deleteAsset(assetId: string): Promise<{ ok: boolean }> {
    return withDemoFallback(
      () => request<{ ok: boolean }>(`/api/v1/assets/${assetId}`, { method: 'DELETE' }),
      () => {
        const asset = writableAssets.find((item) => item.asset_id === assetId)
        if (asset) {
          asset.status = 'archived'
          asset.updated_at = new Date().toISOString()
        }
        return delay({ ok: true })
      },
    )
  },

  async uploadFile(assetId: string, file: File): Promise<AssetFile> {
    const form = new FormData()
    form.append('file', file)
    return withDemoFallback(
      () => request<AssetFile>(`/api/v1/assets/${assetId}/files`, { method: 'POST', body: form }),
      () => {
        const result: AssetFile = {
          id: writableFiles.length + 1,
          asset_id: assetId,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          zone: '01_raw',
          storage_path: `01_raw/${assetId}-${Date.now()}-${file.name}`,
          checksum: `sha256-file-${Date.now()}`,
          uploaded_by: '演示用户',
          created_at: new Date().toISOString(),
        }
        writableFiles.unshift(result)
        return delay(result, 600)
      },
    )
  },

  async files(assetId: string): Promise<AssetFile[]> {
    return withDemoFallback(
      () => request<AssetFile[]>(`/api/v1/assets/${assetId}/files`),
      () => delay(writableFiles.filter((file) => file.asset_id === assetId)),
    )
  },

  async action(assetId: string, action: 'process' | 'approve' | 'reject' | 'archive' | 'index' | 'serve', payload: Record<string, unknown> = {}): Promise<Asset | ProcessingJob> {
    return withDemoFallback(
      () => request<Asset | ProcessingJob>(`/api/v1/assets/${assetId}/${action}`, { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const asset = writableAssets.find((item) => item.asset_id === assetId)
        if (!asset) throw new ApiError('资产不存在', 404)
        const transitions: Record<string, Asset['status']> = {
          process: 'parsed',
          approve: 'approved',
          reject: 'rejected',
          archive: 'archived',
          index: 'indexed',
          serve: 'serving',
        }
        if (action === 'process') {
          const job: ProcessingJob = {
            id: nextJobId,
            job_id: `JOB-${Date.now()}`,
            asset_id: asset.asset_id,
            asset_title: asset.title,
            job_type: 'parse',
            status: 'running',
            progress: 12,
            error_message: '',
            input_uri: asset.source_uri || `01_raw/${asset.asset_id}`,
            output_uri: '',
            started_at: new Date().toISOString(),
            finished_at: null,
            created_at: new Date().toISOString(),
          }
          writableJobs.unshift(job)
          nextJobId += 1
          asset.status = 'parsed'
          asset.progress = Math.max(asset.progress, 55)
          return delay(job, 520)
        }

        asset.status = transitions[action] ?? asset.status
        asset.progress = action === 'approve' ? 94 : action === 'index' ? 98 : 100
        if (action === 'approve') asset.approved_at = new Date().toISOString()
        if (action === 'index') asset.indexed_at = new Date().toISOString()
        if (action === 'index' || action === 'serve') asset.index_status = action === 'index' ? 'indexed' : 'serving'
        if (action === 'approve' || action === 'reject') {
          writableReviews.unshift({
            id: writableReviews.length + 1,
            asset_id: asset.asset_id,
            asset_title: asset.title,
            reviewer: '演示用户',
            action,
            comment: String(payload.comment || ''),
            before_status: 'waiting_review',
            after_status: asset.status,
            created_at: new Date().toISOString(),
          })
        }
        asset.updated_at = new Date().toISOString()
        return delay(asset, 360)
      },
    )
  },

  async jobs(): Promise<ProcessingJob[]> {
    return withDemoFallback(() => request<ProcessingJob[]>('/api/v1/jobs'), () => delay(writableJobs))
  },

  async reviews(): Promise<ReviewLog[]> {
    return withDemoFallback(() => request<ReviewLog[]>('/api/v1/reviews'), () => delay(writableReviews))
  },

  async auditLogs() {
    return withDemoFallback(
      () => request<Array<Record<string, unknown>>>('/api/v1/audit-logs'),
      () =>
        delay([
          { id: 1, actor: '苏白', action: 'approve_asset', resource: 'ZZ-DOC-000005', reason: '人审通过', created_at: '2026-09-23T11:20:00+08:00' },
          { id: 2, actor: '周宁', action: 'create_entity', resource: 'ENT-RISK-001', reason: '图谱补录', created_at: '2026-09-23T10:18:00+08:00' },
          { id: 3, actor: 'system', action: 'index_asset', resource: 'ZZ-DOC-000003', reason: 'Approved 后自动索引', created_at: '2026-09-23T09:42:00+08:00' },
        ]),
    )
  },

  async search(query: string, topK = 5): Promise<{ results: SearchHit[] }> {
    return withDemoFallback(
      () => request<{ results: SearchHit[] }>(`/api/v1/search?q=${encodeURIComponent(query)}&top_k=${topK}`),
      () => {
        const keyword = query.toLowerCase()
        const rows = mockSearchResults
          .filter((row) => `${row.title} ${row.snippet} ${row.tags.join(' ')}`.toLowerCase().includes(keyword))
          .slice(0, topK)
        return delay({ results: rows.length ? rows : mockSearchResults.slice(0, topK) }, 420)
      },
    )
  },

  async ask(query: string): Promise<AskResponse> {
    return withDemoFallback(
      () => request<AskResponse>('/api/v1/ask', { method: 'POST', body: JSON.stringify({ query }) }),
      () => delay({ ...mockAsk, answer: mockAsk.answer.includes('妆舟') ? mockAsk.answer : `根据当前知识库，关于“${query}”的受控答案如下：\n\n${mockAsk.answer}` }, 820),
    )
  },

  async graph(): Promise<GraphData> {
    return withDemoFallback(
      async () => {
        const raw = await request<{
          nodes: Array<{ entity_id: string; name: string; entity_type: string; business_line: string }>
          edges: Array<{ relation_id: string; source_entity: string; relation_type: string; target_entity: string; asset_id: string; confidence: number; status: string }>
        }>('/api/v1/graph')
        return {
          nodes: raw.nodes.map((node) => ({ id: node.entity_id, name: node.name, type: node.entity_type, business_line: node.business_line })),
          edges: raw.edges.map((edge) => ({
            id: edge.relation_id,
            source: edge.source_entity,
            relation: edge.relation_type,
            relation_type: edge.relation_type,
            target: edge.target_entity,
            asset_id: edge.asset_id,
            confidence: edge.confidence,
            status: edge.status,
          })),
        }
      },
      () => delay(writableGraph, 240),
    )
  },

  async createEntity(payload: { name: string; entity_type: string; business_line: string; description?: string }) {
    return withDemoFallback(
      () => request<{ entity_id: string }>('/api/v1/graph/entities', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const entity_id = `ENT-${Date.now()}`
        writableGraph.nodes.push({ id: entity_id, name: payload.name, type: payload.entity_type, business_line: payload.business_line })
        return delay({ entity_id }, 300)
      },
    )
  },

  async createRelationship(payload: { source_entity: string; relation_type: string; target_entity: string; asset_id?: string; confidence?: number }) {
    return withDemoFallback(
      () => request<{ relation_id: string }>('/api/v1/graph/relationships', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const relation_id = `REL-${Date.now()}`
        writableGraph.edges.push({
          id: relation_id,
          source: payload.source_entity,
          relation: payload.relation_type,
          relation_type: payload.relation_type,
          target: payload.target_entity,
          asset_id: payload.asset_id || '',
          confidence: payload.confidence ?? 1,
          status: 'confirmed',
        })
        return delay({ relation_id }, 300)
      },
    )
  },

  async biMetrics(): Promise<BiMetrics> {
    return withDemoFallback(
      async () => {
        const raw = await request<{
          total_assets: number
          total_chunks: number
          total_asset_calls: number
          distributions: { status_distribution: Record<string, number> }
          processing: BiMetrics['processing']
          review: { approvals: number; rejections: number }
          agent: { calls: number }
        }>('/api/v1/bi/metrics')
        return {
          total_assets: raw.total_assets,
          status_distribution: raw.distributions.status_distribution,
          processing: raw.processing,
          review: { approved: raw.review.approvals, rejected: raw.review.rejections },
          value: { total_chunks: raw.total_chunks, total_calls: raw.total_asset_calls },
          agent: { calls: raw.agent.calls },
        }
      },
      () => delay(mockBi, 180),
    )
  },

  async trend(): Promise<MetricsTrend[]> {
    return withDemoFallback(
      async () => {
        const payload = await request<{ items: Array<{ date: string; count: number; cumulative: number }> }>('/api/v1/bi/assets/trend?days=7')
        return payload.items.map((item) => ({ label: item.date.slice(5), assets: item.cumulative, jobs: item.count, calls: 0 }))
      },
      () => delay(mockTrend, 180),
    )
  },

  async retryJob(jobId: string): Promise<Asset> {
    return withDemoFallback(
      () => request<Asset>(`/api/v1/jobs/${jobId}/retry`, { method: 'POST' }),
      () => {
        const job = writableJobs.find((item) => item.job_id === jobId)
        if (!job) throw new ApiError('任务不存在', 404)
        return this.action(job.asset_id, 'process') as Promise<Asset>
      },
    )
  },

  async agentExecute(tool: 'search_assets' | 'read_asset' | 'generate_report', payload: { query?: string; asset_id?: string }): Promise<AgentResponse> {
    return withDemoFallback(
      async () => {
        if (tool === 'search_assets') {
          const result = await request<{ answer: string; asset_ids: string[]; citations: AgentResponse['citations'] }>('/api/v1/agent/search', {
            method: 'POST',
            body: JSON.stringify({ query: payload.query || '', top_k: 5 }),
          })
          return { tool, answer: result.answer, asset_ids: result.asset_ids, citations: result.citations }
        }
        if (tool === 'read_asset') {
          const result = await request<{ asset_id: string; title: string; content: string; citations: AgentResponse['citations'] }>(`/api/v1/agent/read?asset_id=${encodeURIComponent(payload.asset_id || '')}`, { method: 'POST' })
          return { tool, answer: result.content, asset_ids: [result.asset_id], citations: result.citations }
        }
        const result = await request<{ answer: string; citations: AgentResponse['citations'] }>('/api/v1/agent/report', {
          method: 'POST',
          body: JSON.stringify({ query: payload.query || '', top_k: 5 }),
        })
        return { tool, answer: result.answer, asset_ids: result.citations.map((item) => item.asset_id), citations: result.citations }
      },
      () => delay({ ...mockAgentResponse, tool }, 700),
    )
  },

  async adminUsers(): Promise<AdminUser[]> {
    return withDemoFallback(() => request<AdminUser[]>('/api/v1/admin/users'), () => delay(writableUsers, 160))
  },

  async lifecycle() {
    return request<{
      total: number
      processed: number
      pending: number
      failed: number
      serving: number
      archived: number
      processed_rate: number
      stages: Array<{ key: string; label: string; count: number; owners: string[]; latest_updated_at: string | null; failed_jobs: number }>
    }>('/api/v1/catalog/lifecycle')
  },

  async assetTimeline(assetId: string) {
    return request<{ asset_id: string; timeline: Array<{
      source: string; time: string | null; event_type: string; title: string; detail: string;
      actor: string; status_from: string; status_to: string; data: Record<string, unknown>
    }> }>(`/api/v1/assets/${encodeURIComponent(assetId)}/timeline`)
  },

  async businessOverview(domain = '') {
    return request<{
      total_items: number; domain_distribution: Record<string, number>; gmv: number; ad_spend: number;
      roi: number | null; orders: number
    }>(`/api/v1/business/overview?domain=${encodeURIComponent(domain)}`)
  },

  async businessItems(domain = '', businessLine = 'zhuangzhou') {
    return request<Array<{
      asset_id: string; title: string; domain: string; entity: string; metrics: Record<string, number | string>;
      status: string; owner: string; updated_at: string
    }>>(`/api/v1/business/items?domain=${encodeURIComponent(domain)}&business_line=${encodeURIComponent(businessLine)}`)
  },

  async businessTrends() {
    return request<Array<{ date: string; gmv: number; spend: number; orders: number; roi: number | null }>>('/api/v1/business/trends')
  },

  async businessHosts() {
    return request<Array<{ host: string; gmv: number; spend: number; orders: number; lives: number; roi: number | null }>>('/api/v1/business/hosts')
  },
}
