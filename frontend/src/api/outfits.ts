// /api/outfits
import { request } from './client'
import type { OutfitCreateDto, OutfitOutDto } from './dto'
import { mapOutfit } from '../flows/shared/mappers'
import type { Outfit } from '../flows/shared/types'

export interface CreateOutfitInput {
  topId: number
  bottomId: number
  shoesId: number
  source: 'ai' | 'manual'
  prompt?: string | null
  reason?: string | null
}

export async function createOutfit(input: CreateOutfitInput): Promise<Outfit> {
  const body: OutfitCreateDto = {
    top_id: input.topId,
    bottom_id: input.bottomId,
    shoes_id: input.shoesId,
    source: input.source,
    prompt: input.prompt ?? null,
    reason: input.reason ?? null,
  }
  const dto = await request<OutfitOutDto>('/api/outfits', {
    method: 'POST',
    json: body,
  })
  return mapOutfit(dto)
}
