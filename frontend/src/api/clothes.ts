// /api/clothes 相关接口
import { request } from './client'
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

export async function deleteClothes(id: number): Promise<void> {
  await request<void>(`/api/clothes/${id}`, { method: 'DELETE' })
}

export async function autoTagClothes(id: number): Promise<ClothingItem> {
  const dto = await request<ClothingItemOutDto>(`/api/clothes/${id}/auto-tag`, { method: 'POST' })
  return mapClothingItem(dto)
}
