// /api/favorites
import { request } from './client'
import type { FavoriteDetailDto, FavoriteOutDto } from './dto'
import { mapFavorite, mapFavoriteDetail } from '../flows/shared/mappers'
import type { Favorite, FavoriteDetail } from '../flows/shared/types'

export async function listFavorites(): Promise<Favorite[]> {
  const dto = await request<FavoriteOutDto[]>('/api/favorites')
  return dto.map(mapFavorite)
}

export async function getFavorite(id: number): Promise<FavoriteDetail> {
  const dto = await request<FavoriteDetailDto>(`/api/favorites/${id}`)
  return mapFavoriteDetail(dto)
}

export async function createFavorite(outfitId: number, screenshot: Blob): Promise<Favorite> {
  const form = new FormData()
  form.append('outfit_id', String(outfitId))
  // 后端接受 File；Blob 追加时给一个文件名
  const filename = screenshot instanceof File ? screenshot.name : `outfit-${outfitId}.png`
  form.append('screenshot', screenshot, filename)
  const dto = await request<FavoriteOutDto>('/api/favorites', {
    method: 'POST',
    form,
  })
  return mapFavorite(dto)
}
