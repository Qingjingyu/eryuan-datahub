export type AssetStatus = 'raw' | 'parsed' | 'cleaned' | 'waiting_review' | 'approved' | 'indexed' | 'serving' | 'rejected' | 'archived'
export type JobStatus = 'queued' | 'running' | 'success' | 'failed'

export interface User {
  username: string
  display_name: string
  role: 'admin' | 'reviewer' | 'member' | string
  business_line: string
}

export interface Asset {
  id?: number
  asset_id: string
  title: string
  asset_type: 'document' | 'spreadsheet' | 'image' | 'audio' | 'video' | 'other' | string
  business_line: string
  owner: string
  status: AssetStatus | string
  review_status: string
  index_status: string
  graph_status?: string
  visibility: 'public' | 'business' | 'private' | string
  source_type?: string
  source_system: string
  source_uri?: string
  description?: string
  summary?: string
  processed_markdown?: string
  source_text?: string
  tags: string[]
  version: string
  checksum?: string
  progress: number
  chunk_count: number
  call_count: number
  parsed_at?: string | null
  approved_at?: string | null
  indexed_at?: string | null
  created_by?: string
  created_at: string
  updated_at: string
}

export interface AssetFile {
  id: number
  asset_id: string
  file_name: string
  file_type: string
  file_size: number
  zone: string
  storage_path: string
  checksum: string
  uploaded_by: string
  created_at: string
}

export interface ProcessingJob {
  id?: number
  job_id: string
  asset_id: string
  asset_title: string
  job_type: 'parse' | 'clean' | 'chunk' | 'embed' | 'index' | 'serve' | string
  status: JobStatus | string
  progress: number
  error_message?: string
  input_uri?: string
  output_uri?: string
  started_at?: string | null
  finished_at?: string | null
  created_at: string
}

export interface ReviewLog {
  id: number
  asset_id: string
  asset_title: string
  reviewer: string
  action: 'approve' | 'reject' | string
  comment: string
  before_status: string
  after_status: string
  created_at: string
}

export interface SearchHit {
  asset_id: string
  title: string
  snippet: string
  score: number
  version: string
  updated_at: string
  owner: string
  tags: string[]
  status: string
}

export interface AskResponse {
  answer: string
  citations: Array<{
    asset_id: string
    title: string
    snippet?: string
    version?: string
    updated_at?: string | null
    score?: number
  }>
  latency_ms: number
}

export interface AgentResponse {
  tool: string
  answer: string
  asset_ids: string[]
  citations: Array<{ asset_id: string; title: string }>
}

export interface GraphNode {
  id: string
  name: string
  type: string
  business_line: string
}

export interface GraphEdge {
  id: string
  source: string
  relation: string
  relation_type: string
  target: string
  asset_id: string
  confidence: number
  status: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface BiMetrics {
  total_assets: number
  status_distribution: Record<string, number>
  processing: { total_jobs: number; success: number; failed: number; success_rate: number }
  review: { approved: number; rejected: number }
  value: { total_chunks: number; total_calls: number }
  agent: { calls: number }
}

export interface AdminUser extends User {
  active: boolean
}

export interface MetricsTrend {
  label: string
  assets: number
  jobs: number
  calls: number
}
