import type { AdminUser, AgentResponse, Asset, AssetFile, AskResponse, BiMetrics, GraphData, MetricsTrend, ProcessingJob, ReviewLog, SearchHit, User } from './types'

const now = new Date('2026-09-24T09:30:00+08:00').toISOString()
const time = (day: number, hour = 9, minute = 20) => new Date(Date.UTC(2026, 8, day, hour - 8, minute)).toISOString()

const assetSeeds: Array<Partial<Asset> & { asset_id: string; title: string; status: Asset['status'] }> = [
  { asset_id: 'ZZ-DOC-000001', title: '妆舟品牌知识总纲', status: 'serving', asset_type: 'document', business_line: 'zhuangzhou', owner: '苏白', tags: ['品牌', '总纲'], progress: 100, chunk_count: 28, call_count: 462, summary: '妆舟的品牌定位、人群、产品线和内容边界。', updated_at: time(24, 9), created_at: time(12) },
  { asset_id: 'ZZ-DOC-000002', title: '全渠道分销运营手册', status: 'serving', asset_type: 'document', business_line: 'zhuangzhou', owner: '林可', tags: ['分销', '运营'], progress: 100, chunk_count: 54, call_count: 318, summary: '覆盖经销商、门店、直播、私域的分销规则。', updated_at: time(24, 8), created_at: time(11) },
  { asset_id: 'ZZ-DOC-000003', title: '草沐知摇摇水产品说明', status: 'indexed', asset_type: 'document', business_line: 'zhuangzhou', owner: '王晓', tags: ['产品', '功效'], progress: 100, chunk_count: 32, call_count: 188, summary: '产品成分、使用方法、适用人群与禁用表述。', updated_at: time(23, 17), created_at: time(10) },
  { asset_id: 'ZZ-DOC-000004', title: '内容生产流程 SOP', status: 'indexed', asset_type: 'document', business_line: 'zhuangzhou', owner: '陈青', tags: ['SOP', '内容'], progress: 100, chunk_count: 36, call_count: 145, summary: '选题、脚本、审核、投放与复盘流程。', updated_at: time(23, 15), created_at: time(10) },
  { asset_id: 'ZZ-DOC-000005', title: '功效表述风险清单', status: 'approved', asset_type: 'spreadsheet', business_line: 'zhuangzhou', owner: '周宁', tags: ['合规', '风险'], progress: 92, chunk_count: 21, call_count: 64, summary: '禁止词、限用词、替代表述与审核依据。', updated_at: time(23, 11), created_at: time(9) },
  { asset_id: 'ZZ-DOC-000006', title: '新品发布会脚本 v3', status: 'waiting_review', asset_type: 'document', business_line: 'zhuangzhou', owner: '李树', tags: ['发布会', '脚本'], progress: 88, chunk_count: 18, call_count: 12, summary: '新品价值、产品演示和渠道政策讲解稿。', updated_at: time(24, 8, 50), created_at: time(20) },
  { asset_id: 'ZZ-IMG-000007', title: '摇摇水产品主图素材包', status: 'cleaned', asset_type: 'image', business_line: 'zhuangzhou', owner: '刘一', tags: ['素材', '产品图'], progress: 70, chunk_count: 0, call_count: 8, summary: '含主图、细节图、直播封面与尺寸规范。', updated_at: time(24, 7), created_at: time(21) },
  { asset_id: 'ZZ-DOC-000008', title: '经销商返利政策 2026Q4', status: 'parsed', asset_type: 'spreadsheet', business_line: 'zhuangzhou', owner: '林可', tags: ['政策', '返利'], progress: 54, chunk_count: 0, call_count: 0, summary: '阶梯返利、结算周期、考核与例外审批。', updated_at: time(24, 6), created_at: time(22) },
  { asset_id: 'ZZ-DOC-000009', title: '门店陈列标准照片集', status: 'raw', asset_type: 'image', business_line: 'zhuangzhou', owner: '陈青', tags: ['门店', '陈列'], progress: 0, chunk_count: 0, call_count: 0, summary: '门店入口、货架、收银台和堆头陈列样例。', updated_at: time(24, 5), created_at: time(23) },
  { asset_id: 'ZZ-DOC-000010', title: '消费者咨询 FAQ', status: 'raw', asset_type: 'document', business_line: 'zhuangzhou', owner: '王晓', tags: ['FAQ', '客服'], progress: 0, chunk_count: 0, call_count: 0, summary: '人群、用法、物流、售后与投诉处理答案。', updated_at: time(24, 4), created_at: time(23) },
  { asset_id: 'EY-DOC-000011', title: '二元空间数据中台方案', status: 'serving', asset_type: 'document', business_line: 'eryuan', owner: '苏白', tags: ['中台', '架构'], progress: 100, chunk_count: 42, call_count: 274, summary: 'Context Plane、资产账本、检索和治理方法。', updated_at: time(24, 9, 10), created_at: time(8) },
  { asset_id: 'EY-DOC-000012', title: 'Agent 接入与权限边界', status: 'indexed', asset_type: 'document', business_line: 'eryuan', owner: '苏白', tags: ['Agent', '安全'], progress: 100, chunk_count: 30, call_count: 112, summary: '受控 API、最小权限、引用和审计要求。', updated_at: time(23, 18), created_at: time(9) },
  { asset_id: 'EY-DOC-000013', title: '数据资产登记规范', status: 'approved', asset_type: 'document', business_line: 'eryuan', owner: '周宁', tags: ['规范', '资产'], progress: 96, chunk_count: 26, call_count: 72, summary: 'asset_id、版本、负责人、标签和生命周期。', updated_at: time(23, 12), created_at: time(9) },
  { asset_id: 'EY-DOC-000014', title: '企业知识图谱抽取规则', status: 'waiting_review', asset_type: 'document', business_line: 'eryuan', owner: '李树', tags: ['图谱', '规则'], progress: 90, chunk_count: 16, call_count: 18, summary: '实体识别、关系抽取、置信度和人审门槛。', updated_at: time(24, 8, 40), created_at: time(20) },
  { asset_id: 'EY-DOC-000015', title: '业务系统元数据调研', status: 'cleaned', asset_type: 'spreadsheet', business_line: 'eryuan', owner: '刘一', tags: ['元数据', '调研'], progress: 78, chunk_count: 0, call_count: 4, summary: 'CRM、ERP、客服和投放系统的字段映射。', updated_at: time(24, 7, 20), created_at: time(21) },
  { asset_id: 'EY-DOC-000016', title: '数据质量检查项清单', status: 'parsed', asset_type: 'spreadsheet', business_line: 'eryuan', owner: '周宁', tags: ['质量', '检查'], progress: 58, chunk_count: 0, call_count: 0, summary: '完整性、准确性、一致性、及时性检查。', updated_at: time(24, 6, 30), created_at: time(22) },
  { asset_id: 'EY-DOC-000017', title: '数据合规与留痕说明', status: 'raw', asset_type: 'document', business_line: 'eryuan', owner: '苏白', tags: ['合规', '审计'], progress: 0, chunk_count: 0, call_count: 0, summary: '访问控制、删除、备份和审计日志要求。', updated_at: time(24, 5, 10), created_at: time(23) },
  { asset_id: 'GEN-DOC-000018', title: '公司通用报销制度', status: 'serving', asset_type: 'document', business_line: 'general', owner: '人事部', tags: ['人事', '制度'], progress: 100, chunk_count: 20, call_count: 358, summary: '差旅、招待、办公和审批流程。', updated_at: time(23, 16), created_at: time(8) },
  { asset_id: 'GEN-DOC-000019', title: '新员工入职指引', status: 'indexed', asset_type: 'document', business_line: 'general', owner: '人事部', tags: ['入职', '指引'], progress: 100, chunk_count: 24, call_count: 126, summary: '账号、设备、安全、考勤和组织介绍。', updated_at: time(23, 10), created_at: time(9) },
  { asset_id: 'GEN-DOC-000020', title: '采购审批流程说明', status: 'waiting_review', asset_type: 'document', business_line: 'general', owner: '财务部', tags: ['采购', '审批'], progress: 86, chunk_count: 14, call_count: 9, summary: '供应商、比价、合同和付款节点。', updated_at: time(24, 8, 20), created_at: time(20) },
  { asset_id: 'GEN-DOC-000021', title: '办公设备资产台账', status: 'parsed', asset_type: 'spreadsheet', business_line: 'general', owner: '行政部', tags: ['资产', '台账'], progress: 52, chunk_count: 0, call_count: 0, summary: '电脑、屏幕、设备归属与折旧周期。', updated_at: time(24, 6, 15), created_at: time(22) },
  { asset_id: 'GEN-DOC-000022', title: '会议室使用规范', status: 'raw', asset_type: 'document', business_line: 'general', owner: '行政部', tags: ['行政', '规范'], progress: 0, chunk_count: 0, call_count: 0, summary: '预订、释放、远程会议和设备使用。', updated_at: time(24, 4, 40), created_at: time(23) },
]

export const mockAssets: Asset[] = assetSeeds.map((item, index) => ({
  id: index + 1,
  review_status: ['serving', 'indexed', 'approved'].includes(item.status) ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending',
  index_status: ['indexed', 'serving'].includes(item.status) ? 'indexed' : item.status === 'approved' ? 'queued' : 'not_indexed',
  graph_status: ['serving', 'indexed'].includes(item.status) ? 'generated' : 'not_generated',
  visibility: 'business',
  source_type: item.asset_type === 'image' ? 'oss' : 'upload',
  source_system: item.asset_type === 'image' ? 'MinIO' : 'DataHub Console',
  description: '用于第 1-6 期验收的企业知识资产样例。',
  processed_markdown: `# ${item.title}\n\n${item.summary}\n\n## 关键结论\n\n- 数据已进入受控资产账本。\n- 所有展示内容保留业务语义和引用。\n- 后续可用于检索、Agent 与分析。`,
  source_text: `${item.title}\n${item.summary}`,
  version: 'v1',
  checksum: `sha256-${item.asset_id.toLowerCase()}`,
  parsed_at: ['parsed', 'cleaned', 'waiting_review', 'approved', 'indexed', 'serving'].includes(item.status) ? item.updated_at ?? now : null,
  approved_at: ['approved', 'indexed', 'serving'].includes(item.status) ? item.updated_at ?? now : null,
  indexed_at: ['indexed', 'serving'].includes(item.status) ? item.updated_at ?? now : null,
  created_by: item.owner ?? 'system',
  ...item,
})) as Asset[]

export const mockJobs: ProcessingJob[] = mockAssets.slice(0, 18).map((asset, index) => {
  const statuses: ProcessingJob['status'][] = ['success', 'success', 'running', 'queued', 'failed', 'success', 'running', 'success']
  const types: ProcessingJob['job_type'][] = ['parse', 'clean', 'chunk', 'embed', 'index', 'parse', 'clean', 'index']
  const status = statuses[index % statuses.length]!
  return {
    id: index + 1,
    job_id: `JOB-2026-09-${String(index + 1).padStart(3, '0')}`,
    asset_id: asset.asset_id,
    asset_title: asset.title,
    job_type: types[index % types.length]!,
    status,
    progress: status === 'success' ? 100 : status === 'running' ? 45 + (index % 5) * 8 : status === 'failed' ? 32 : 0,
    error_message: status === 'failed' ? '源文件第 12 页存在不可解析表格，已等待人工确认。' : '',
    input_uri: `01_raw/${asset.asset_id}.pdf`,
    output_uri: status === 'success' ? `04_index_input/${asset.asset_id}.md` : '',
    started_at: status === 'queued' ? null : time(24, 6 + (index % 3), index % 60),
    finished_at: status === 'success' ? time(24, 7 + (index % 2), index % 60) : null,
    created_at: time(24, 5 + (index % 3), index % 60),
  }
})

export const mockReviews: ReviewLog[] = [
  { id: 1, asset_id: 'ZZ-DOC-000005', asset_title: '功效表述风险清单', reviewer: '苏白', action: 'approve', comment: '风险等级和替代表述完整，通过。', before_status: 'waiting_review', after_status: 'approved', created_at: time(23, 11) },
  { id: 2, asset_id: 'ZZ-DOC-000003', asset_title: '草沐知摇摇水产品说明', reviewer: '周宁', action: 'approve', comment: '合规校验通过，允许索引。', before_status: 'waiting_review', after_status: 'approved', created_at: time(23, 10) },
  { id: 3, asset_id: 'EY-DOC-000013', asset_title: '数据资产登记规范', reviewer: '苏白', action: 'approve', comment: '字段口径与状态机一致。', before_status: 'waiting_review', after_status: 'approved', created_at: time(23, 12) },
  { id: 4, asset_id: 'ZZ-DOC-000009', asset_title: '旧版门店陈列照片', reviewer: '陈青', action: 'reject', comment: '照片无版权说明，需补充来源。', before_status: 'waiting_review', after_status: 'rejected', created_at: time(22, 18) },
]

export const mockFiles: AssetFile[] = mockAssets.slice(0, 10).map((asset, index) => ({
  id: index + 1,
  asset_id: asset.asset_id,
  file_name: `${asset.title}.${asset.asset_type === 'image' ? 'zip' : asset.asset_type === 'spreadsheet' ? 'xlsx' : 'pdf'}`,
  file_type: asset.asset_type === 'image' ? 'image/zip' : asset.asset_type === 'spreadsheet' ? 'application/vnd.ms-excel' : 'application/pdf',
  file_size: 1_240_000 + index * 382_000,
  zone: '01_raw',
  storage_path: `01_raw/${asset.asset_id}-source.${asset.asset_type === 'image' ? 'zip' : 'pdf'}`,
  checksum: `sha256-file-${index + 1}`,
  uploaded_by: asset.owner,
  created_at: asset.created_at,
}))

export const mockGraph: GraphData = {
  nodes: [
    { id: 'ENT-BL-001', name: '妆舟', type: '业务线', business_line: 'zhuangzhou' },
    { id: 'ENT-MOD-001', name: '全渠道分销', type: '模块', business_line: 'zhuangzhou' },
    { id: 'ENT-PRO-001', name: '草沐知摇摇水', type: '产品', business_line: 'zhuangzhou' },
    { id: 'ENT-PROC-001', name: '内容生产流程', type: '流程', business_line: 'zhuangzhou' },
    { id: 'ENT-RISK-001', name: '功效表述风险', type: '风险', business_line: 'zhuangzhou' },
    { id: 'ENT-BL-002', name: '二元空间', type: '业务线', business_line: 'eryuan' },
    { id: 'ENT-MOD-002', name: 'Context Plane', type: '模块', business_line: 'eryuan' },
    { id: 'ENT-SYS-001', name: 'Agent Gateway', type: '系统', business_line: 'eryuan' },
    { id: 'ENT-ORG-001', name: '数据治理组', type: '组织', business_line: 'general' },
  ],
  edges: [
    { id: 'REL-001', source: 'ENT-BL-001', relation: '包含', relation_type: '包含', target: 'ENT-MOD-001', asset_id: 'ZZ-DOC-000001', confidence: 0.98, status: 'confirmed' },
    { id: 'REL-002', source: 'ENT-MOD-001', relation: '依赖', relation_type: '依赖', target: 'ENT-PROC-001', asset_id: 'ZZ-DOC-000004', confidence: 0.94, status: 'confirmed' },
    { id: 'REL-003', source: 'ENT-MOD-001', relation: '禁止', relation_type: '禁止', target: 'ENT-RISK-001', asset_id: 'ZZ-DOC-000005', confidence: 0.96, status: 'confirmed' },
    { id: 'REL-004', source: 'ENT-BL-001', relation: '拥有', relation_type: '拥有', target: 'ENT-PRO-001', asset_id: 'ZZ-DOC-000003', confidence: 0.99, status: 'confirmed' },
    { id: 'REL-005', source: 'ENT-BL-002', relation: '建设', relation_type: '建设', target: 'ENT-MOD-002', asset_id: 'EY-DOC-000011', confidence: 0.97, status: 'confirmed' },
    { id: 'REL-006', source: 'ENT-MOD-002', relation: '通过', relation_type: '通过', target: 'ENT-SYS-001', asset_id: 'EY-DOC-000012', confidence: 0.92, status: 'confirmed' },
    { id: 'REL-007', source: 'ENT-ORG-001', relation: '治理', relation_type: '治理', target: 'ENT-MOD-002', asset_id: 'EY-DOC-000013', confidence: 0.9, status: 'confirmed' },
    { id: 'REL-008', source: 'ENT-BL-002', relation: '约束', relation_type: '约束', target: 'ENT-RISK-001', asset_id: 'EY-DOC-000014', confidence: 0.88, status: 'candidate' },
  ],
}

export const mockBi: BiMetrics = {
  total_assets: mockAssets.length,
  status_distribution: mockAssets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.status] = (acc[asset.status] ?? 0) + 1
    return acc
  }, {}),
  processing: { total_jobs: mockJobs.length, success: mockJobs.filter((job) => job.status === 'success').length, failed: mockJobs.filter((job) => job.status === 'failed').length, success_rate: 90.5 },
  review: { approved: mockReviews.filter((item) => item.action === 'approve').length + 6, rejected: mockReviews.filter((item) => item.action === 'reject').length },
  value: { total_chunks: mockAssets.reduce((sum, asset) => sum + asset.chunk_count, 0), total_calls: mockAssets.reduce((sum, asset) => sum + asset.call_count, 0) },
  agent: { calls: 1842 },
}

export const mockTrend: MetricsTrend[] = [
  { label: '09-18', assets: 6, jobs: 8, calls: 180 },
  { label: '09-19', assets: 9, jobs: 14, calls: 340 },
  { label: '09-20', assets: 12, jobs: 21, calls: 590 },
  { label: '09-21', assets: 15, jobs: 26, calls: 820 },
  { label: '09-22', assets: 18, jobs: 31, calls: 1160 },
  { label: '09-23', assets: 21, jobs: 38, calls: 1510 },
  { label: '09-24', assets: mockAssets.length, jobs: mockJobs.length, calls: 1842 },
]

export const mockUsers: AdminUser[] = [
  { username: 'admin', display_name: '管理员', role: 'admin', business_line: 'general', active: true },
  { username: 'subai', display_name: '苏白', role: 'admin', business_line: 'eryuan', active: true },
  { username: 'zhouning', display_name: '周宁', role: 'reviewer', business_line: 'general', active: true },
  { username: 'linke', display_name: '林可', role: 'member', business_line: 'zhuangzhou', active: true },
  { username: 'liuyi', display_name: '刘一', role: 'member', business_line: 'eryuan', active: false },
]

export const mockSearchResults: SearchHit[] = mockAssets
  .filter((asset) => ['approved', 'indexed', 'serving'].includes(asset.status))
  .slice(0, 5)
  .map((asset) => ({
    asset_id: asset.asset_id,
    title: asset.title,
    snippet: asset.summary || asset.description || '',
    score: Number((2.2 + Math.random() * 2.4).toFixed(2)),
    version: asset.version,
    updated_at: asset.updated_at,
    owner: asset.owner,
    tags: asset.tags,
    status: asset.status,
  }))

export const mockAsk: AskResponse = {
  answer: '妆舟的全渠道分销体系以品牌知识总纲和运营手册为基础：先统一人群与产品价值，再按经销商、门店、直播和私域分层运营。功效内容必须遵守风险清单，禁止夸大表述。\n\n依据：\n[1] 妆舟品牌知识总纲\n[2] 全渠道分销运营手册\n[3] 功效表述风险清单',
  citations: [
    { asset_id: 'ZZ-DOC-000001', title: '妆舟品牌知识总纲', snippet: '妆舟的品牌定位、人群、产品线和内容边界。', score: 4.32 },
    { asset_id: 'ZZ-DOC-000002', title: '全渠道分销运营手册', snippet: '覆盖经销商、门店、直播、私域的分销规则。', score: 4.08 },
    { asset_id: 'ZZ-DOC-000005', title: '功效表述风险清单', snippet: '禁止词、限用词、替代表述与审核依据。', score: 3.72 },
  ],
  latency_ms: 680,
}

export const mockAgentResponse: AgentResponse = {
  tool: 'generate_report',
  answer: '根据当前知识库，整理结果如下：\n\n## 妆舟品牌知识总纲\n统一品牌人群、产品线和内容边界。\n\n## 全渠道分销运营手册\n按经销商、门店、直播、私域设计运营动作。\n\n## 功效表述风险清单\n所有对外内容必须先做合规词校验。',
  asset_ids: ['ZZ-DOC-000001', 'ZZ-DOC-000002', 'ZZ-DOC-000005'],
  citations: [
    { asset_id: 'ZZ-DOC-000001', title: '妆舟品牌知识总纲' },
    { asset_id: 'ZZ-DOC-000002', title: '全渠道分销运营手册' },
    { asset_id: 'ZZ-DOC-000005', title: '功效表述风险清单' },
  ],
}

export const mockDemoUser: User = { username: 'demo', display_name: '演示用户', role: 'admin', business_line: 'general' }
