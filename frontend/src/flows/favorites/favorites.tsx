import { useCallback, useEffect, useState } from 'react'
import {
  AsyncState,
  Button,
  Empty,
  Icon,
  Image,
  PageHeader,
  PullToRefresh,
  SafeArea,
  SpinLoading,
  Tag,
  showToast,
} from '../../ui'
import { useNavigate } from 'react-router-dom'
import type { Favorite, FavoriteDetail, ClothingItem } from '../shared/types'
import { getFavorite, listFavorites } from '../../api/favorites'
import { listClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import styles from './favorites.module.css'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const categoryLabel: Record<string, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

/* ================================================================
   FLOW: My Favorites
   - 列表：GET /api/favorites
   - 详情：GET /api/favorites/{id}
   - 详情里的 outfit 只有 top_id/bottom_id/shoes_id，
     需要从 listClothes 缓存里查找单品缩略图
   - 注意：详情视图（"搭配详情"）为视觉冻结区，只许结构重构（DESIGN.md §5）
   ================================================================ */

export function FavoritesList() {
  const navigate = useNavigate()

  // 列表
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // 单品缓存（用于详情里显示 top/bottom/shoes 缩略图）
  const [itemsById, setItemsById] = useState<Map<number, ClothingItem>>(new Map())

  // 详情
  const [selectedDetail, setSelectedDetail] = useState<FavoriteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const [favs, items] = await Promise.all([listFavorites(), listClothes()])
      setFavorites(favs)
      const map = new Map<number, ClothingItem>()
      for (const it of items) map.set(it.id, it)
      setItemsById(map)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '加载收藏失败'
      setListError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFavorites()
  }, [fetchFavorites])

  const handleSelectFavorite = async (fav: Favorite) => {
    setDetailLoading(true)
    try {
      const detail = await getFavorite(fav.id)
      setSelectedDetail(detail)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefresh = async () => {
    await fetchFavorites()
  }

  /* ============ 详情视图（视觉冻结区，样式 1:1 保留） ============ */
  if (selectedDetail) {
    const outfit = selectedDetail.outfit
    const topItem = itemsById.get(outfit.topId)
    const bottomItem = itemsById.get(outfit.bottomId)
    const shoesItem = itemsById.get(outfit.shoesId)
    const outfitItems = [topItem, bottomItem, shoesItem].filter(Boolean) as ClothingItem[]

    return (
      <div className={styles.page}>
        <div className={styles.frozenHeader}>
          <button
            type="button"
            className={styles.frozenBackBtn}
            onClick={() => setSelectedDetail(null)}
            aria-label="返回"
          >
            <Icon name="chevron-left" size={20} strokeWidth={2} />
          </button>
          <span className={styles.frozenHeaderTitle}>{'搭配详情'}</span>
          <div className={styles.frozenHeaderSpacer} />
        </div>
        <div className={styles.detailScroll}>
          <Image
            src={selectedDetail.screenshotPath}
            width="100%"
            height={520}
            fit="contain"
            className={styles.detailImage}
          />

          <div className={styles.detailBody}>
            <div className={styles.detailMeta}>
              <Tag
                color={outfit.source === 'ai' ? 'primary' : 'success'}
                className={styles.sourceTag}
              >
                {outfit.source === 'ai' ? 'AI 推荐' : '手动搭配'}
              </Tag>
              <span className={styles.detailDate}>
                {'保存于'} {formatDate(selectedDetail.createdAt)}
              </span>
            </div>

            {outfit.reason && (
              <div className={styles.reasonBlock}>
                <p className={styles.reasonText}>{outfit.reason}</p>
              </div>
            )}

            <div className={styles.itemThumbnails}>
              <div className={styles.thumbLabel}>{'搭配单品'}</div>
              <div className={styles.thumbRow}>
                {outfitItems.length > 0 ? outfitItems.map((item) => (
                  <div key={item.id} className={styles.thumbCard}>
                    <Image
                      src={item.processedImage}
                      width={64}
                      height={64}
                      fit="cover"
                      className={styles.thumbImage}
                    />
                    <span className={styles.thumbName}>{item.name}</span>
                    <Tag fill="outline" className={styles.thumbCategoryTag}>
                      {categoryLabel[item.category]}
                    </Tag>
                  </div>
                )) : (
                  <span className={styles.detailDate}>{'单品已从衣柜移除'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  /* ============ 列表 / 加载 / 错误 / 空态 ============ */
  return (
    <div className={styles.page}>
      <PageHeader title="穿搭" />

      {detailLoading && (
        <div className={styles.overlayLoading}>
          <SpinLoading color="primary" />
        </div>
      )}

      <AsyncState
        loading={loading}
        error={listError}
        onRetry={() => void fetchFavorites()}
        errorTitle="加载失败"
        empty={favorites.length === 0}
        emptyContent={
          <div className={styles.emptyContainer}>
            <Empty description={'还没有收藏的搭配'} imageStyle={{ height: 120 }} />
            <Button
              color="primary"
              size="large"
              onClick={() => navigate('/style')}
              className={styles.emptyCta}
            >
              {'去搭配页保存第一套吧'}
            </Button>
          </div>
        }
      >
        <div className={styles.scrollWrap}>
          <PullToRefresh onRefresh={handleRefresh}>
            <div className={styles.gridContainer}>
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className={styles.gridCard}
                  onClick={() => void handleSelectFavorite(fav)}
                >
                  {fav.screenshotPath ? (
                    <Image
                      src={fav.screenshotPath}
                      width="100%"
                      height={260}
                      fit="contain"
                      className={styles.gridImage}
                    />
                  ) : (
                    <div className={styles.gridPlaceholder}>
                      <Icon name="hanger" size={32} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className={styles.gridFooter}>
                    <span className={styles.gridDate}>{formatDate(fav.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </PullToRefresh>
        </div>
      </AsyncState>

      <SafeArea position="bottom" />
    </div>
  )
}
