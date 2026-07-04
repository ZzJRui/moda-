// 后端 snake_case DTO → 前端 camelCase 实体
// 兼容层：ClothingItem.color/style 保留旧视觉的简写字段
import type {
  ClothingItemListDto,
  ClothingItemOutDto,
  FavoriteDetailDto,
  FavoriteOutDto,
  OutfitBriefDto,
  OutfitOutDto,
  RecommendationOutDto,
} from '../../api/dto'
import type {
  AIRecommendation,
  ClothingCategory,
  ClothingItem,
  Favorite,
  FavoriteDetail,
  Outfit,
  OutfitBrief,
} from './types'
import { resolveImageUrl } from './image-url'

function normalizeCategory(raw: string): ClothingCategory {
  if (raw === 'top' || raw === 'bottom' || raw === 'shoes') return raw
  // 后端理应只写这三种，保底给 top 让 UI 不崩
  return 'top'
}

export function mapClothingItem(dto: ClothingItemOutDto): ClothingItem {
  return {
    id: dto.id,
    name: dto.name,
    category: normalizeCategory(dto.category),
    color: dto.color_base ?? 'unknown',
    style: dto.style ?? 'unknown',
    originalImage: resolveImageUrl(dto.original_image),
    processedImage: resolveImageUrl(dto.processed_image),
    createdAt: dto.created_at,
    subtype: dto.subtype,
    colorBase: dto.color_base,
    colorTone: dto.color_tone,
    pattern: dto.pattern,
    fit: dto.fit,
    season: dto.season,
    formality: dto.formality,
    material: dto.material,
    sleeveLength: dto.sleeve_length,
    topLength: dto.top_length,
    neckline: dto.neckline,
    pantsLength: dto.pants_length,
    waist: dto.waist,
    pantsShape: dto.pants_shape,
    shoeCut: dto.shoe_cut,
    shoeType: dto.shoe_type,
    sole: dto.sole,
    closure: dto.closure,
    taggingStatus: dto.tagging_status,
  }
}

export function mapClothingItemList(dto: ClothingItemListDto): ClothingItem {
  return {
    id: dto.id,
    name: dto.name,
    category: normalizeCategory(dto.category),
    color: dto.color_base ?? 'unknown',
    style: dto.style ?? 'unknown',
    // 列表接口没有 original_image，展示层只用 processed_image 就够了
    originalImage: '',
    processedImage: resolveImageUrl(dto.processed_image),
    createdAt: '',
    subtype: dto.subtype,
    colorBase: dto.color_base,
    colorTone: dto.color_tone,
    pattern: dto.pattern,
    fit: dto.fit,
    season: dto.season,
    formality: dto.formality,
  }
}

export function mapOutfit(dto: OutfitOutDto): Outfit {
  return {
    id: dto.id,
    topId: dto.top_id,
    bottomId: dto.bottom_id,
    shoesId: dto.shoes_id,
    source: dto.source,
    prompt: dto.prompt,
    reason: dto.reason,
    screenshotPath: dto.screenshot_path ? resolveImageUrl(dto.screenshot_path) : null,
    createdAt: dto.created_at,
  }
}

export function mapOutfitBrief(dto: OutfitBriefDto): OutfitBrief {
  return {
    id: dto.id,
    source: dto.source,
    prompt: dto.prompt,
    reason: dto.reason,
    topId: dto.top_id,
    bottomId: dto.bottom_id,
    shoesId: dto.shoes_id,
  }
}

export function mapFavorite(dto: FavoriteOutDto): Favorite {
  return {
    id: dto.id,
    outfitId: dto.outfit_id,
    screenshotPath: resolveImageUrl(dto.screenshot_path),
    createdAt: dto.created_at,
  }
}

export function mapFavoriteDetail(dto: FavoriteDetailDto): FavoriteDetail {
  return {
    id: dto.id,
    screenshotPath: resolveImageUrl(dto.screenshot_path),
    createdAt: dto.created_at,
    outfit: mapOutfitBrief(dto.outfit),
  }
}

export function mapRecommendation(dto: RecommendationOutDto): AIRecommendation {
  return {
    topId: dto.top_id,
    bottomId: dto.bottom_id,
    shoesId: dto.shoes_id,
    reason: dto.reason,
  }
}
