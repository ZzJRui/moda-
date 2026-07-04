// 统一错误处理：吸收后端两种错误形状
// A. FastAPI HTTPException: { detail: string | Array<{msg,...}> }
// B. 业务错误 JSONResponse: { error: string, message: string, missing_categories?: string[] }

const ERROR_CODE_MESSAGES: Record<string, string> = {
  ai_not_configured: 'AI 服务未配置，请联系管理员',
  ai_auth_failed: 'AI 鉴权失败',
  ai_unavailable: 'AI 服务暂不可用，请稍后再试',
  ai_invalid_response: 'AI 返回结果无法解析',
  ai_tagging_disabled: 'AI 打标签已关闭',
}

export class ApiError extends Error {
  status: number
  code?: string
  missingCategories?: string[]
  raw: unknown

  constructor(params: {
    status: number
    message: string
    code?: string
    missingCategories?: string[]
    raw?: unknown
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.missingCategories = params.missingCategories
    this.raw = params.raw
  }
}

// 依据后端契约，把 body 归一化成 ApiError
export function parseApiError(status: number, body: unknown): ApiError {
  const raw = body

  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>

    // 形状 B：业务错误
    if (typeof obj.error === 'string') {
      const code = obj.error
      const backendMessage = typeof obj.message === 'string' ? obj.message : ''
      // 优先用后端 message（missing_category 里带缺失品类文案），fallback 到本地字典
      const message = backendMessage || ERROR_CODE_MESSAGES[code] || `请求失败 (${status})`
      const missingCategories = Array.isArray(obj.missing_categories)
        ? (obj.missing_categories.filter((v) => typeof v === 'string') as string[])
        : undefined
      return new ApiError({ status, message, code, missingCategories, raw })
    }

    // 形状 A：HTTPException
    if (typeof obj.detail === 'string') {
      return new ApiError({ status, message: obj.detail, raw })
    }
    if (Array.isArray(obj.detail)) {
      // Pydantic 校验数组
      const first = obj.detail[0] as Record<string, unknown> | undefined
      const msg = first && typeof first.msg === 'string' ? first.msg : '请求参数校验失败'
      const loc = first && Array.isArray(first.loc) ? first.loc.filter((v) => typeof v === 'string').join('.') : ''
      const message = loc ? `${loc}: ${msg}` : msg
      return new ApiError({ status, message, raw })
    }
  }

  return new ApiError({ status, message: `请求失败 (${status})`, raw })
}

// 网络级错误（fetch reject）
export function networkError(err: unknown): ApiError {
  const message = err instanceof Error ? err.message : '网络异常，请稍后再试'
  return new ApiError({ status: 0, message: `网络异常: ${message}`, raw: err })
}
