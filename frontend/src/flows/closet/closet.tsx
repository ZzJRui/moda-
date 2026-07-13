import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  AsyncState,
  Button,
  Dialog,
  Icon,
  IconButton,
  PageHeader,
  SafeArea,
  showToast,
} from '../../ui'
import type { ClothingItem, ClothingCategory } from '../shared/types'
import { listClothes, deleteClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import styles from './closet.module.css'

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

/* -------------------------------------------------- */
/*  Empty State Illustration (SVG collage)             */
/*  页面级插画，非图标，保留在 flow 内（DESIGN.md §2.1） */
/* -------------------------------------------------- */

function EmptyCollage() {
  return (
    <div className={styles.collageWrap}>
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
  const [searchText, setSearchText] = useState('')
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null)

  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

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
      showToast('已删除')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '删除失败'
      showToast(msg)
    } finally {
      setDeleting(false)
    }
  }

  /* ================================================
     SCREEN 2: ItemDetail
     ================================================ */
  if (selectedItem) {
    const styleKey = primaryStyle(selectedItem.style)
    return (
      <div className={styles.page}>
        <PageHeader title="衣物详情" onBack={() => setSelectedItem(null)} bordered />

        <div className={styles.detailScroll}>
          <div className={styles.detailImageWrap}>
            <img
              src={selectedItem.processedImage}
              alt={selectedItem.name}
              className={styles.detailImage}
            />
          </div>

          <div className={styles.detailBody}>
            <h2 className={styles.detailName}>{selectedItem.name}</h2>

            <div className={styles.detailTags}>
              <span className={styles.tagPrimary}>{categoryLabel[selectedItem.category]}</span>
              <span className={styles.tagOutline}>{labelOr(colorLabel, selectedItem.color)}</span>
              <span className={styles.tagOutline}>{labelOr(styleLabel, styleKey)}</span>
            </div>

            <div className={styles.detailInfo}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{'类别'}</span>
                <span className={styles.infoValue}>{categoryLabel[selectedItem.category]}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{'颜色'}</span>
                <span className={styles.infoValue}>{labelOr(colorLabel, selectedItem.color)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{'风格'}</span>
                <span className={styles.infoValue}>{labelOr(styleLabel, styleKey)}</span>
              </div>
              {selectedItem.subtype && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{'品类'}</span>
                  <span className={styles.infoValue}>{selectedItem.subtype}</span>
                </div>
              )}
              {selectedItem.season && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{'季节'}</span>
                  <span className={styles.infoValue}>{selectedItem.season}</span>
                </div>
              )}
              {selectedItem.createdAt && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{'添加时间'}</span>
                  <span className={styles.infoValue}>
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
              className={styles.deleteBtn}
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
      </div>
    )
  }

  /* ================================================
     SCREEN 1: ClosetList (main)
     ================================================ */
  return (
    <div className={styles.page}>
      {/* Profile Section — fixed header */}
      <div className={styles.profileSection}>
        <div className={styles.profileLeft}>
          <div className={styles.avatar}>
            <Icon name="user" size={28} strokeWidth={2} />
          </div>
          <div className={styles.profileInfo}>
            <span className={styles.userName}>Moda</span>
            <span className={styles.userHandle}>@Moda</span>
          </div>
        </div>
      </div>

      {/* Search + Action Buttons — fixed header */}
      <div className={styles.actionRow}>
        <div className={styles.searchBar}>
          <Icon name="search" size={16} strokeWidth={2} />
          <input
            type="text"
            placeholder={'搜索'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <IconButton icon="heart" aria-label="收藏筛选" />
        <IconButton icon="eye-off" aria-label="隐藏单品" />
        <IconButton icon="sliders" aria-label="筛选" />
      </div>

      {/* Content Area — scrollable */}
      <div className={styles.scrollArea}>
        <AsyncState
          loading={loading}
          error={error}
          onRetry={() => void fetchItems()}
          empty={filteredItems.length === 0}
          emptyContent={
            <div className={styles.emptyState}>
              <EmptyCollage />
              <span className={styles.emptyTitle}>{'点击加号按钮开始搭配'}</span>
              <span className={styles.emptySub}>{'衣柜里还没有单品，快去上传吧！'}</span>
            </div>
          }
        >
          <div className={styles.gridContainer}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={styles.gridCard}
                onClick={() => setSelectedItem(item)}
              >
                {item.processedImage ? (
                  <img src={item.processedImage} alt={item.name} className={styles.gridImage} />
                ) : (
                  <div className={styles.gridPlaceholder}>
                    <Icon name="hanger" size={32} strokeWidth={1.5} />
                  </div>
                )}
                <div className={styles.gridFooter}>
                  <span className={styles.gridName}>{item.name}</span>
                  <span className={styles.gridTag}>{categoryLabel[item.category]}</span>
                </div>
              </div>
            ))}
          </div>
        </AsyncState>
      </div>

      <SafeArea position="bottom" />
    </div>
  )
}
