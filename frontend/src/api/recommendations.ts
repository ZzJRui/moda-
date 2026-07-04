// /api/recommendations/outfit
import { request } from './client'
import type { RecommendationOutDto } from './dto'
import { mapRecommendation } from '../flows/shared/mappers'
import type { AIRecommendation } from '../flows/shared/types'

export async function requestOutfit(text: string): Promise<AIRecommendation> {
  const dto = await request<RecommendationOutDto>('/api/recommendations/outfit', {
    method: 'POST',
    json: { text },
  })
  return mapRecommendation(dto)
}
