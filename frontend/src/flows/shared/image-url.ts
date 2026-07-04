// 后端返回的 /uploads/... 是相对 URL，需要拼上 API base URL 才能给 <img src> 用。
// 已经是绝对 URL 或 data: URL 时直接返回。

import { getApiBaseUrl } from '../../api/client'

export function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
