// 后端 snake_case DTO 契约（单一来源），仅在 api/ 与 mappers 内部使用
// 与 backend/app/schemas.py 对齐；datetime 序列化为 ISO 8601 字符串

export type ClothingCategoryDto = 'top' | 'bottom' | 'shoes'
export type TaggingStatusDto = 'ai' | 'ai_failed' | null

// GET /api/clothes/{id} 及 POST /api/clothes/upload、POST /api/clothes/{id}/auto-tag 响应
export interface ClothingItemOutDto {
  id: number
  name: string
  category: string
  subtype: string | null
  color_base: string | null
  color_tone: string | null
  pattern: string | null
  style: string | null
  fit: string | null
  season: string | null
  formality: string | null
  material: string | null

  // 上衣
  sleeve_length: string | null
  top_length: string | null
  neckline: string | null

  // 下装
  pants_length: string | null
  waist: string | null
  pants_shape: string | null

  // 鞋子
  shoe_cut: string | null
  shoe_type: string | null
  sole: string | null
  closure: string | null

  original_image: string
  processed_image: string
  created_at: string
  tagging_status: TaggingStatusDto
}

// GET /api/clothes 列表项（slim）
export interface ClothingItemListDto {
  id: number
  name: string
  category: string
  subtype: string | null
  color_base: string | null
  color_tone: string | null
  pattern: string | null
  style: string | null
  fit: string | null
  season: string | null
  formality: string | null
  processed_image: string
}

// POST /api/outfits 请求 / 响应
export interface OutfitCreateDto {
  top_id: number
  bottom_id: number
  shoes_id: number
  source: 'ai' | 'manual'
  prompt?: string | null
  reason?: string | null
}

export interface OutfitOutDto {
  id: number
  top_id: number
  bottom_id: number
  shoes_id: number
  source: 'ai' | 'manual'
  prompt: string | null
  reason: string | null
  screenshot_path: string | null
  created_at: string
}

export interface OutfitBriefDto {
  id: number
  source: 'ai' | 'manual'
  prompt: string | null
  reason: string | null
  top_id: number
  bottom_id: number
  shoes_id: number
}

// GET/POST /api/favorites
export interface FavoriteOutDto {
  id: number
  outfit_id: number
  screenshot_path: string
  created_at: string
}

export interface FavoriteDetailDto {
  id: number
  screenshot_path: string
  created_at: string
  outfit: OutfitBriefDto
}

// POST /api/recommendations/outfit
export interface RecommendationOutDto {
  top_id: number
  bottom_id: number
  shoes_id: number
  reason: string
}
