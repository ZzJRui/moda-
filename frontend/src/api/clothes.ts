// /api/clothes 相关接口
import { request, getApiBaseUrl } from './client'
import { ApiError, parseApiError } from './errors'
import type { ClothingItemListDto, ClothingItemOutDto } from './dto'
import {
  mapClothingItem,
  mapClothingItemList,
} from '../flows/shared/mappers'
import type { ClothingItem } from '../flows/shared/types'

export interface ListClothesQuery {
  q?: string
  category?: string
  subtype?: string
  color_base?: string
  color_tone?: string
  pattern?: string
  style?: string
  fit?: string
  season?: string
  formality?: string
  [key: string]: string | undefined
}

export async function listClothes(query?: ListClothesQuery): Promise<ClothingItem[]> {
  const dto = await request<ClothingItemListDto[]>('/api/clothes', { query })
  return dto.map(mapClothingItemList)
}

export async function getClothes(id: number): Promise<ClothingItem> {
  const dto = await request<ClothingItemOutDto>(`/api/clothes/${id}`)
  return mapClothingItem(dto)
}

export async function uploadClothes(file: File): Promise<ClothingItem> {
  const form = new FormData()
  form.append('file', file)
  const dto = await request<ClothingItemOutDto>('/api/clothes/upload', {
    method: 'POST',
    form,
  })
  return mapClothingItem(dto)
}

export function uploadClothesWithProgress(
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ClothingItem> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    const url = `${getApiBaseUrl()}/api/clothes/upload`

    xhr.open('POST', url)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const dto = JSON.parse(xhr.responseText) as ClothingItemOutDto
          onProgress(100)
          resolve(mapClothingItem(dto))
        } catch {
          reject(new ApiError({ status: xhr.status, message: '响应解析失败' }))
        }
      } else {
        let body: unknown
        try { body = JSON.parse(xhr.responseText) } catch { body = xhr.responseText }
        reject(parseApiError(xhr.status, body))
      }
    }

    xhr.onerror = () => {
      reject(new ApiError({ status: 0, message: '网络异常' }))
    }

    xhr.onabort = () => {
      reject(new ApiError({ status: 0, message: '已取消上传' }))
    }

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort())
    }

    xhr.send(form)
  })
}

export async function deleteClothes(id: number): Promise<void> {
  await request<void>(`/api/clothes/${id}`, { method: 'DELETE' })
}

export async function autoTagClothes(id: number): Promise<ClothingItem> {
  const dto = await request<ClothingItemOutDto>(`/api/clothes/${id}/auto-tag`, { method: 'POST' })
  return mapClothingItem(dto)
}
