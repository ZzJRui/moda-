import { useCallback, useEffect, useState } from 'react'
import {
  Empty,
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
      <div style={styles.page}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setSelectedDetail(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={styles.headerTitle}>{'搭配详情'}</span>
          <div style={styles.headerSpacer} />
        </div>
        <div style={styles.detailScroll}>
          <Image
            src={selectedDetail.screenshotPath}
            width="100%"
            height={520}
            fit="contain"
            style={{ ...styles.detailImage, background: '#fafafa' }}
          />

          <div style={styles.detailBody}>
            <div style={styles.detailMeta}>
              <Tag
                color={outfit.source === 'ai' ? 'primary' : 'success'}
                style={styles.sourceTag}
              >
                {outfit.source === 'ai' ? 'AI 推荐' : '手动搭配'}
              </Tag>
              <span style={styles.detailDate}>
                {'保存于'} {formatDate(selectedDetail.createdAt)}
              </span>
            </div>

            {outfit.reason && (
              <div style={styles.reasonBlock}>
                <p style={styles.reasonText}>{outfit.reason}</p>
              </div>
            )}

            <div style={styles.itemThumbnails}>
              <div style={styles.thumbLabel}>{'搭配单品'}</div>
              <div style={styles.thumbRow}>
                {outfitItems.length > 0 ? outfitItems.map((item) => (
                  <div key={item.id} style={styles.thumbCard}>
                    <Image
                      src={item.processedImage}
                      width={64}
                      height={64}
                      fit="cover"
                      style={styles.thumbImage}
                    />
                    <span style={styles.thumbName}>{item.name}</span>
                    <Tag fill="outline" style={styles.thumbCategoryTag}>
                      {categoryLabel[item.category]}
                    </Tag>
                  </div>
                )) : (
                  <span style={styles.detailDate}>{'单品已从衣柜移除'}</span>
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
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.headerSpacer} />
          <span style={styles.headerTitle}>{'穿搭'}</span>
          <div style={styles.headerSpacer} />
        </div>
        <div style={styles.stateWrap}>
          <SpinLoading color="primary" />
          <span style={styles.stateHint}>{'加载中...'}</span>
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  if (listError) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.headerSpacer} />
          <span style={styles.headerTitle}>{'穿搭'}</span>
          <div style={styles.headerSpacer} />
        </div>
        <div style={styles.stateWrap}>
          <ErrorBlock status="default" title="加载失败" description={listError} />
          <Button color="primary" size="small" onClick={() => void fetchFavorites()} style={{ marginTop: 12 }}>
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
      <div style={styles.page}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={styles.headerTitle}>{'穿搭'}</span>
          <div style={styles.headerSpacer} />
        </div>
        <div style={styles.emptyContainer}>
          <Empty description={'还没有收藏的搭配'} imageStyle={styles.emptyImage} />
          <Button
            color="primary"
            size="large"
            onClick={() => navigate('/style')}
            style={styles.emptyCta}
          >
            {'去搭配页保存第一套吧'}
          </Button>
        </div>
        <SafeArea position="bottom" />
      </div>
    )
  }

  /* ============ 主视图 ============ */
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerSpacer} />
        <span style={styles.headerTitle}>{'穿搭'}</span>
        <div style={styles.headerSpacer} />
      </div>

      {detailLoading && (
        <div style={styles.overlayLoading}>
          <SpinLoading color="primary" />
        </div>
      )}

      <div style={styles.scrollWrap}>
        <PullToRefresh onRefresh={handleRefresh}>
          <div style={styles.gridContainer}>
          {favorites.map((fav) => (
            <div
              key={fav.id}
              style={styles.gridCard}
              onClick={() => void handleSelectFavorite(fav)}
            >
              {fav.screenshotPath ? (
                <Image
                  src={fav.screenshotPath}
                  width="100%"
                  height={260}
                  fit="contain"
                  style={{ ...styles.gridImage, background: '#fafafa' }}
                />
              ) : (
                <div style={styles.gridPlaceholder}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3c0 1.1.6 2.1 1.5 2.6L12 9l1.5-1.4A3 3 0 0 0 12 2z" />
                    <path d="M3.5 15.5L12 9l8.5 6.5a1.5 1.5 0 0 1-1 2.5H4.5a1.5 1.5 0 0 1-1-2.5z" />
                  </svg>
                </div>
              )}
              <div style={styles.gridFooter}>
                <span style={styles.gridDate}>{formatDate(fav.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </PullToRefresh>
      </div>

      <SafeArea position="bottom" />
    </div>
  )
}

/* -------------------------------------------------- */
/*  Styles                                            */
/* -------------------------------------------------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--adm-color-background, #f5f5f5)',
    position: 'relative',
  },
  /* Header — identical structure to styling page */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px 0',
    flexShrink: 0,
    background: '#fff',
  },
  headerSpacer: {
    width: 80,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#000',
    letterSpacing: '-0.3px',
  },
  backBtn: {
    width: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    border: 'none',
    background: 'none',
    padding: 0,
    cursor: 'pointer',
    color: '#000',
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyImage: {
    height: 120,
  },
  emptyCta: {
    minHeight: 44,
    borderRadius: 8,
    minWidth: 200,
  },
  stateWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  stateHint: {
    fontSize: 13,
    color: '#999',
  },
  overlayLoading: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scrollWrap: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    padding: '12px 12px 80px',
  },
  gridCard: {
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--adm-color-background, #fff)',
    border: '1px solid var(--adm-color-border, #eee)',
    cursor: 'pointer',
  },
  gridImage: {
    display: 'block',
  },
  gridPlaceholder: {
    width: '100%',
    height: 180,
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridFooter: {
    padding: '8px 10px',
  },
  gridDate: {
    fontSize: 12,
    color: 'var(--adm-color-weak, #999)',
  },
  detailScroll: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  detailImage: {
    display: 'block',
  },
  detailBody: {
    padding: 16,
  },
  detailMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sourceTag: {
    fontSize: 12,
  },
  detailDate: {
    fontSize: 13,
    color: 'var(--adm-color-weak, #999)',
  },
  reasonBlock: {
    background: 'var(--adm-color-fill-content, #f9f9f9)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: '22px',
    color: 'var(--adm-color-text, #333)',
    margin: 0,
  },
  itemThumbnails: {
    marginTop: 8,
  },
  thumbLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--adm-color-text, #333)',
    marginBottom: 12,
  },
  thumbRow: {
    display: 'flex',
    gap: 12,
  },
  thumbCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  thumbImage: {
    borderRadius: 8,
  },
  thumbName: {
    fontSize: 11,
    color: 'var(--adm-color-text, #333)',
    textAlign: 'center',
    maxWidth: 64,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  thumbCategoryTag: {
    fontSize: 10,
  },
}
