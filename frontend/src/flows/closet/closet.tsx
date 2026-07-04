import { useState, useMemo, useEffect, useCallback } from 'react'
import { SafeArea, SpinLoading, ErrorBlock, Button, Dialog } from 'antd-mobile'
import type { ClothingItem, ClothingCategory } from '../shared/types'
import { listClothes, deleteClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

const colorLabel: Record<string, string> = {
  white: '白色',
  black: '黑色',
  blue: '蓝色',
  beige: '米色',
  gray: '灰色',
  red: '红色',
  green: '绿色',
  yellow: '黄色',
  pink: '粉色',
  purple: '紫色',
  brown: '棕色',
  orange: '橙色',
  unknown: '未知',
}

const styleLabel: Record<string, string> = {
  casual: '休闲',
  sporty: '运动',
  elegant: '优雅',
  street: '街头',
  business: '商务',
  romantic: '甜美',
  minimalist: '简约',
  vintage: '复古',
  unknown: '未知',
}

// 未知值兜底：翻译不到就原样返回，避免视觉塌陷
function labelOr(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '未知'
  return map[key] ?? key
}

// 多选 style 逗号字符串：取第一个显示，防止太长
function primaryStyle(raw: string | null | undefined): string {
  if (!raw) return 'unknown'
  const first = raw.split(',')[0]?.trim()
  return first || 'unknown'
}

type WardrobeTab = 'items' | 'outfits' | 'selfies' | 'lookbook'

/* -------------------------------------------------- */
/*  Empty State Illustration (SVG collage)             */
/* -------------------------------------------------- */

function EmptyCollage() {
  return (
    <div style={S.collageWrap}>
      <svg width="260" height="200" viewBox="0 0 260 200" fill="none">
        {/* Cowboy boot */}
        <g transform="translate(10, 60)">
          <path d="M10 0 L50 0 L55 50 L70 70 L70 90 L0 90 L0 70 Z" fill="#2a2a2a" />
          <path d="M15 5 L45 5 L45 15 L15 15 Z" fill="#444" />
          <path d="M0 70 L70 70 L70 75 L0 75 Z" fill="#555" />
        </g>
        {/* White shirt with red piping */}
        <g transform="translate(85, 5)">
          <path d="M30 0 L60 0 L75 20 L75 80 L0 80 L0 20 Z" fill="#fafafa" stroke="#eee" strokeWidth="1" />
          <path d="M30 0 L45 15 L60 0" fill="none" stroke="#e85d5d" strokeWidth="2" />
          <path d="M0 20 L15 10 L15 40 L0 40 Z" fill="#fafafa" stroke="#eee" strokeWidth="1" />
          <path d="M75 20 L60 10 L60 40 L75 40 Z" fill="#fafafa" stroke="#eee" strokeWidth="1" />
          <circle cx="45" cy="35" r="2" fill="#ddd" />
          <circle cx="45" cy="50" r="2" fill="#ddd" />
          <circle cx="45" cy="65" r="2" fill="#ddd" />
        </g>
        {/* Pink handbag */}
        <g transform="translate(175, 15)">
          <path d="M15 25 Q15 0 40 0 Q65 0 65 25" fill="none" stroke="#d4899e" strokeWidth="3" />
          <rect x="0" y="25" width="80" height="55" rx="8" fill="#e8a0b4" />
          <rect x="30" y="45" width="20" height="12" rx="3" fill="#d4899e" />
          <text x="40" y="54" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="600">JACQUEMUS</text>
        </g>
        {/* Orange V-neck top */}
        <g transform="translate(5, 155)">
          <path d="M25 0 L55 0 L70 15 L70 45 L0 45 L0 15 Z" fill="#e8834a" />
          <path d="M25 0 L40 18 L55 0" fill="#d4733a" />
          <path d="M0 15 L12 8 L12 30 L0 30 Z" fill="#e8834a" />
          <path d="M70 15 L58 8 L58 30 L70 30 Z" fill="#e8834a" />
        </g>
        {/* White Converse sneaker */}
        <g transform="translate(85, 120)">
          <path d="M5 40 L10 10 L65 5 L80 15 L80 50 L0 50 Z" fill="#fafafa" stroke="#eee" strokeWidth="1" />
          <path d="M0 50 L80 50 L80 60 L0 60 Z" fill="#e0e0e0" />
          <circle cx="55" cy="30" r="8" fill="none" stroke="#ccc" strokeWidth="1.5" />
          <path d="M10 10 L10 30" fill="none" stroke="#ccc" strokeWidth="1" />
          <path d="M20 8 L20 28" fill="none" stroke="#ccc" strokeWidth="1" />
          <path d="M30 6 L30 26" fill="none" stroke="#ccc" strokeWidth="1" />
        </g>
        {/* Flared jeans */}
        <g transform="translate(180, 100)">
          <path d="M20 0 L60 0 L60 40 L75 95 L45 95 L40 50 L35 95 L5 95 L20 40 Z" fill="#a8c4e0" />
          <path d="M20 0 L60 0 L60 5 L20 5 Z" fill="#8eb0d4" />
          <path d="M38 5 L38 35" fill="none" stroke="#8eb0d4" strokeWidth="1" />
        </g>
      </svg>
    </div>
  )
}

/* ================================================================
   FLOW: My Closet
   ================================================================ */

export function ClosetList() {
  const [, setActiveTab] = useState<WardrobeTab>('items')
  const [searchText, setSearchText] = useState('')
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null)

  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  // 避免 lint 未使用告警：本轮 tabs 展示保留但不切换其他数据
  void setActiveTab

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listClothes()
      setItems(data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '加载失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items
    const q = searchText.trim().toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q),
    )
  }, [items, searchText])

  /* ================================================
     SCREEN 2: ItemDetail (使用列表返回的字段)
     ================================================ */
  // 轻量自渲染 Toast，绕开 antd-mobile v5 命令式 API 在 React 19 下不生效的问题
  const showFlash = (msg: string) => {
    setFlashMsg(msg)
    window.setTimeout(() => setFlashMsg(null), 1800)
  }

  const openConfirm = () => {
    if (!selectedItem || deleting) return
    setConfirmVisible(true)
  }

  const doDelete = async () => {
    if (!selectedItem) return
    const target = selectedItem
    setConfirmVisible(false)
    setDeleting(true)
    try {
      await deleteClothes(target.id)
      setItems((prev) => prev.filter((i) => i.id !== target.id))
      setSelectedItem(null)
      showFlash('已删除')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '删除失败'
      showFlash(msg)
    } finally {
      setDeleting(false)
    }
  }

  if (selectedItem) {
    const styleKey = primaryStyle(selectedItem.style)
    return (
      <div style={S.page}>
        <div style={S.detailHeader}>
          <div style={S.backBtn} onClick={() => setSelectedItem(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <span style={S.detailHeaderTitle}>{'衣物详情'}</span>
          <div style={{ width: 32 }} />
        </div>

        <div style={S.detailScroll}>
          <div style={S.detailImageWrap}>
            <img
              src={selectedItem.processedImage}
              alt={selectedItem.name}
              style={S.detailImage}
            />
          </div>

          <div style={S.detailBody}>
            <h2 style={S.detailName}>{selectedItem.name}</h2>

            <div style={S.detailTags}>
              <span style={S.detailTagPrimary}>
                {categoryLabel[selectedItem.category]}
              </span>
              <span style={S.detailTag}>{labelOr(colorLabel, selectedItem.color)}</span>
              <span style={S.detailTag}>{labelOr(styleLabel, styleKey)}</span>
            </div>

            <div style={S.detailInfo}>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>{'类别'}</span>
                <span style={S.infoValue}>{categoryLabel[selectedItem.category]}</span>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>{'颜色'}</span>
                <span style={S.infoValue}>{labelOr(colorLabel, selectedItem.color)}</span>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>{'风格'}</span>
                <span style={S.infoValue}>{labelOr(styleLabel, styleKey)}</span>
              </div>
              {selectedItem.subtype && (
                <div style={S.infoRow}>
                  <span style={S.infoLabel}>{'品类'}</span>
                  <span style={S.infoValue}>{selectedItem.subtype}</span>
                </div>
              )}
              {selectedItem.season && (
                <div style={S.infoRow}>
                  <span style={S.infoLabel}>{'季节'}</span>
                  <span style={S.infoValue}>{selectedItem.season}</span>
                </div>
              )}
              {selectedItem.createdAt && (
                <div style={{ ...S.infoRow, borderBottom: 'none' }}>
                  <span style={S.infoLabel}>{'添加时间'}</span>
                  <span style={S.infoValue}>
                    {new Date(selectedItem.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              )}
            </div>

            <Button
              block
              color="danger"
              fill="outline"
              loading={deleting}
              disabled={deleting}
              onClick={openConfirm}
              style={S.detailDeleteBtn}
            >
              {'删除这件衣服'}
            </Button>
          </div>
        </div>
        <SafeArea position="bottom" />

        <Dialog
          visible={confirmVisible}
          content={`确定删除「${selectedItem.name}」吗？此操作无法撤销。`}
          closeOnAction
          onClose={() => setConfirmVisible(false)}
          actions={[
            [
              { key: 'cancel', text: '取消' },
              { key: 'confirm', text: '删除', bold: true, danger: true, onClick: doDelete },
            ],
          ]}
        />

        {flashMsg && <div style={S.flashToast}>{flashMsg}</div>}
      </div>
    )
  }

  /* ================================================
     SCREEN 1: ClosetList (main)
     ================================================ */
  return (
    <div style={S.page}>
      <div style={S.scrollArea}>
        {/* Profile Section */}
        <div style={S.profileSection}>
          <div style={S.profileLeft}>
            <div style={S.avatarWrap}>
              <div style={S.avatar}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-1a6 6 0 0 1 12 0v1" />
                </svg>
              </div>
            </div>
            <div style={S.profileInfo}>
              <span style={S.userName}>Moda</span>
              <span style={S.userHandle}>@Moda</span>
            </div>
          </div>
          <div style={S.profileBio} />
        </div>

        {/* Search + Action Buttons */}
        <div style={S.actionRow}>
          <div style={S.searchBar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={'搜索'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={S.searchInput}
            />
          </div>
          <div style={S.actionBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div style={S.actionBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
          <div style={S.actionBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div style={S.stateWrap}>
            <SpinLoading color="primary" />
            <span style={S.stateHint}>{'加载中...'}</span>
          </div>
        ) : error ? (
          <div style={S.stateWrap}>
            <ErrorBlock status="default" title="加载失败" description={error} />
            <Button color="primary" size="small" onClick={() => void fetchItems()} style={{ marginTop: 12 }}>
              {'重试'}
            </Button>
          </div>
        ) : filteredItems.length > 0 ? (
          <div style={S.gridContainer}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={S.gridCard}
                onClick={() => setSelectedItem(item)}
              >
                {item.processedImage ? (
                  <img src={item.processedImage} alt={item.name} style={S.gridImage} />
                ) : (
                  <div style={S.gridPlaceholder}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3c0 1.1.6 2.1 1.5 2.6L12 9l1.5-1.4A3 3 0 0 0 12 2z" />
                      <path d="M3.5 15.5L12 9l8.5 6.5a1.5 1.5 0 0 1-1 2.5H4.5a1.5 1.5 0 0 1-1-2.5z" />
                    </svg>
                  </div>
                )}
                <div style={S.gridFooter}>
                  <span style={S.gridName}>{item.name}</span>
                  <span style={S.gridTag}>
                    {categoryLabel[item.category]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div style={S.emptyState}>
            <EmptyCollage />
            <span style={S.emptyTitle}>
              {'点击加号按钮开始搭配'}
            </span>
            <span style={S.emptySub}>
              {'衣柜里还没有单品，快去上传吧！'}
            </span>
          </div>
        )}
      </div>

      <SafeArea position="bottom" />
    </div>
  )
}

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const S: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },

  /* Profile Section */
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 12px',
  },
  profileLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  profileBio: {
    flex: 1,
    minHeight: 40,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#8B7355',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#333',
    lineHeight: 1.2,
  },
  userHandle: {
    fontSize: 13,
    color: '#999',
    lineHeight: 1.2,
  },

  /* Search + Action Row */
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 16px 12px',
  },
  searchBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 20,
    background: '#f5f5f5',
    padding: '0 14px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    color: '#333',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  /* State (loading / error) */
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    color: '#666',
  },
  stateHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#999',
  },

  /* Empty State */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    flex: 1,
  },
  collageWrap: {
    marginBottom: 24,
    opacity: 0.85,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },

  /* Grid (when items exist) */
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    padding: '4px 16px 16px',
  },
  gridCard: {
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fafafa',
    cursor: 'pointer',
  },
  gridImage: {
    width: '100%',
    height: 140,
    objectFit: 'cover' as const,
    display: 'block',
  },
  gridPlaceholder: {
    width: '100%',
    height: 140,
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridFooter: {
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '65%',
  },
  gridTag: {
    fontSize: 11,
    color: '#999',
    background: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: 4,
  },

  /* Detail View */
  detailHeader: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    padding: '0 12px',
    borderBottom: '1px solid #f0f0f0',
  },
  backBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
  },
  detailScroll: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  detailImageWrap: {
    width: '100%',
    height: 360,
    overflow: 'hidden',
    background: '#f5f5f5',
  },
  detailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  detailBody: {
    padding: 16,
  },
  detailName: {
    fontSize: 18,
    fontWeight: 600,
    color: '#333',
    margin: '0 0 12px',
  },
  detailTags: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
  },
  detailTagPrimary: {
    fontSize: 12,
    padding: '4px 12px',
    borderRadius: 14,
    background: '#7c5cfc',
    color: '#fff',
    fontWeight: 500,
  },
  detailTag: {
    fontSize: 12,
    padding: '4px 12px',
    borderRadius: 14,
    border: '1px solid #e0e0e0',
    color: '#666',
  },
  detailInfo: {
    background: '#f9f9f9',
    borderRadius: 12,
    padding: '4px 16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 500,
  },
  detailDeleteBtn: {
    marginTop: 20,
    '--border-color': '#ff3141',
  } as React.CSSProperties,
  flashToast: {
    position: 'fixed',
    left: '50%',
    bottom: 96,
    transform: 'translateX(-50%)',
    padding: '10px 16px',
    borderRadius: 8,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: 13,
    zIndex: 1000,
    pointerEvents: 'none',
  },
}
