import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Image,
  Tag,
  SafeArea,
  PullToRefresh,
  SpinLoading,
  ErrorBlock,
  Toast,
} from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import type { Favorite, FavoriteDetail, ClothingItem } from '../shared/types'
import { getFavorite, listFavorites } from '../../api/favorites'
import { listClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import { Button as UiButton, EmptyState, Icon, PageHeader } from '@moda/ui'
import { useDelayedBusy } from '../shared/useDelayedBusy'
import './favorites.css'

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
  const showLoading = useDelayedBusy(loading)

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
      if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '加载详情失败', position: 'bottom' })
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefresh = async () => {
    await fetchFavorites()
  }

  /* ============ 详情视图 ============ */
  if (selectedDetail) {
    const outfit = selectedDetail.outfit
    const topItem = itemsById.get(outfit.topId)
    const bottomItem = itemsById.get(outfit.bottomId)
    const shoesItem = itemsById.get(outfit.shoesId)
    const outfitItems = [topItem, bottomItem, shoesItem].filter(Boolean) as ClothingItem[]

    return (
      <div className="favorites-page">
        <PageHeader title="搭配详情" onBack={() => setSelectedDetail(null)} />
        <div className="favorites-detail-scroll">
          <Image
            src={selectedDetail.screenshotPath}
            width="100%"
            height={520}
            fit="contain"
            className="favorites-detail-image"
          />

          <div className="favorites-detail-body">
            <div className="favorites-detail-meta">
              <Tag
                color={outfit.source === 'ai' ? 'primary' : 'success'}
                className="favorites-source-tag"
              >
                {outfit.source === 'ai' ? 'AI 推荐' : '手动搭配'}
              </Tag>
              <span className="favorites-detail-date">
                {'保存于'} {formatDate(selectedDetail.createdAt)}
              </span>
            </div>

            {outfit.reason && (
              <div className="favorites-reason-block">
                <p className="favorites-reason-text">{outfit.reason}</p>
              </div>
            )}

            <div className="favorites-item-thumbnails">
              <div className="favorites-thumb-label">{'搭配单品'}</div>
              <div className="favorites-thumb-row">
                {outfitItems.length > 0 ? outfitItems.map((item) => (
                  <div key={item.id} className="favorites-thumb-card">
                    <Image
                      src={item.processedImage}
                      width={64}
                      height={64}
                      fit="cover"
                      className="favorites-thumb-image"
                    />
                    <span className="favorites-thumb-name">{item.name}</span>
                    <Tag fill="outline" className="favorites-thumb-category-tag">
                      {categoryLabel[item.category]}
                    </Tag>
                  </div>
                )) : (
                  <span className="favorites-detail-date">{'单品已从衣柜移除'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  /* ============ 加载态 / 错误态 ============ */
  if (loading) {
    return (
      <div className="favorites-page">
        <PageHeader title="喜欢" />
        {showLoading && <div className="favorites-state">
          <SpinLoading color="primary" />
          <span className="favorites-state-hint">{'加载中…'}</span>
        </div>}
        <SafeArea position="bottom" />
      </div>
    )
  }

  if (listError) {
    return (
      <div className="favorites-page">
        <PageHeader title="喜欢" />
        <div className="favorites-state">
          <ErrorBlock status="default" title="加载失败" description={listError} />
          <Button color="primary" size="small" onClick={() => void fetchFavorites()} className="favorites-state-retry">
            {'重试'}
          </Button>
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  /* ============ 空状态 ============ */
  if (favorites.length === 0) {
    return (
      <div className="favorites-page">
        <PageHeader title="喜欢" />
        <div className="favorites-empty-container">
          <EmptyState title="还没有收藏的搭配" description="在搭配页保存后，会出现在这里。" icon="heart" action={<UiButton block variant="secondary" onClick={() => navigate('/style')}>去搭配</UiButton>} />
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  /* ============ 主视图 ============ */
  return (
    <div className="favorites-page">
      <PageHeader title="喜欢" />

      {detailLoading && (
        <div className="favorites-overlay-loading">
          <SpinLoading color="primary" />
        </div>
      )}

      <div className="favorites-scroll-wrap">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="favorites-grid-container">
          {favorites.map((fav) => (
            <button
              type="button"
              key={fav.id}
              className="favorites-grid-card"
              onClick={() => void handleSelectFavorite(fav)}
            >
              {fav.screenshotPath ? (
                <Image
                  src={fav.screenshotPath}
                  width="100%"
                  height={260}
                  fit="contain"
                  className="favorites-grid-image"
                />
              ) : (
                <div className="favorites-grid-placeholder">
                  <Icon name="hanger" size={30} />
                </div>
              )}
              <div className="favorites-grid-footer">
                <span className="favorites-grid-date">{formatDate(fav.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </PullToRefresh>
      </div>

      <SafeArea position="bottom" />
    </div>
  )
}
