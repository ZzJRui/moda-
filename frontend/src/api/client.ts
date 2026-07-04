// 通用 fetch 封装：base URL、JSON/FormData、错误归一化
import { ApiError, networkError, parseApiError } from './errors'

// 生产构建（未设 VITE_API_BASE_URL）时回落到当前站点同源，
// 便于通过 cpolar 之类的单条隧道把后端 + 前端一起对外暴露。
const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8000')

export function getApiBaseUrl(): string {
  return BASE_URL
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'
  json?: unknown
  form?: FormData
  query?: Record<string, string | number | undefined | null>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.append(key, String(value))
    }
  }
  return url.toString()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', json, form, query, signal } = options

  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    // FormData：交给浏览器带 boundary，不手动设置 Content-Type
    body = form
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body, signal })
  } catch (err) {
    throw networkError(err)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    throw parseApiError(res.status, parsed)
  }

  return parsed as T
}

// 便于 mapper 单独调用（保持 API 层内聚）
export { ApiError }
