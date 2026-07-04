// 前端消费的实体类型（camelCase）
// 后端返回 snake_case，映射由 flows/shared/mappers.ts 完成
// v4 扩展字段全部为可选：列表接口 (ClothingItemList) 返回子集时未提供的字段留 undefined。

export type ClothingCategory = 'top' | 'bottom' | 'shoes'

export interface ClothingItem {
  id: number
  name: string
  category: ClothingCategory

  // 兼容旧视觉的简写字段
  // color: color_base ?? 'unknown'
  // style: 多选逗号字符串（可能是 'unknown'）
  color: string
  style: string

  originalImage: string
  processedImage: string
  createdAt: string

  // v4 通用扩展（可选，list 接口不返回时为 undefined）
  subtype?: string | null
  colorBase?: string | null
  colorTone?: string | null
  pattern?: string | null
  fit?: string | null
  season?: string | null
  formality?: string | null
  material?: string | null

  // v4 上衣专属
  sleeveLength?: string | null
  topLength?: string | null
  neckline?: string | null

  // v4 下装专属
  pantsLength?: string | null
  waist?: string | null
  pantsShape?: string | null

  // v4 鞋子专属
  shoeCut?: string | null
  shoeType?: string | null
  sole?: string | null
  closure?: string | null

  // 上传/auto-tag 时后端会带；GET 时为 null
  taggingStatus?: 'ai' | 'ai_failed' | null
}

export interface Outfit {
  id: number
  topId: number
  bottomId: number
  shoesId: number
  source: 'ai' | 'manual'
  prompt: string | null
  reason: string | null
  screenshotPath: string | null
  createdAt: string
}

// FavoriteDetail 的 outfit 摘要（无 screenshotPath / createdAt）
export interface OutfitBrief {
  id: number
  source: 'ai' | 'manual'
  prompt: string | null
  reason: string | null
  topId: number
  bottomId: number
  shoesId: number
}

export interface Favorite {
  id: number
  outfitId: number
  screenshotPath: string
  createdAt: string
}

export interface FavoriteDetail {
  id: number
  screenshotPath: string
  createdAt: string
  outfit: OutfitBrief
}

export interface AIRecommendation {
  topId: number
  bottomId: number
  shoesId: number
  reason: string
}
