import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('zh-CN').format(value ?? 0)
}

export function percent(value?: number | null, digits = 0) {
  return `${(value ?? 0).toFixed(digits)}%`
}

export function fileLabel(type: string) {
  const map: Record<string, string> = {
    document: '文档',
    spreadsheet: '表格',
    image: '图片',
    audio: '音频',
    video: '视频',
    other: '其他',
  }
  return map[type] || type
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    raw: '原始数据',
    parsed: '已解析',
    cleaned: '已清洗',
    waiting_review: '待审核',
    approved: '已通过',
    indexed: '已索引',
    serving: '服务中',
    rejected: '已驳回',
    archived: '已归档',
    queued: '排队中',
    running: '处理中',
    success: '成功',
    failed: '失败',
    confirmed: '已确认',
    candidate: '待确认',
  }
  return map[status] || status
}
