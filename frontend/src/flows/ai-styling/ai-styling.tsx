import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Button,
  Toast,
  SafeArea,
  Input,
  ErrorBlock,
  SpinLoading,
} from 'antd-mobile'
import type { SwiperRef } from 'antd-mobile/es/components/swiper'
import html2canvas from 'html2canvas'
import { useNavigate } from 'react-router-dom'
import type { ClothingCategory, AIRecommendation, ClothingItem } from '../shared/types'
import { listClothes } from '../../api/clothes'
import { requestOutfit } from '../../api/recommendations'
import { createOutfit } from '../../api/outfits'
import { createFavorite } from '../../api/favorites'
import { ApiError } from '../../api/errors'
import { ClothingCarousel } from './ClothingCarousel'
import { HeroDialog } from './HeroDialog'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

/* -------------------------------------------------- */
/*  Slot machine keyframes                             */
/* -------------------------------------------------- */

const SLOT_KEYFRAMES = `
@keyframes slotGlow {
  0%   { box-shadow: 0 0 0 0 rgba(22,119,255, 0.3); }
  50%  { box-shadow: 0 0 12px 4px rgba(22,119,255, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(22,119,255, 0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.styling-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.styling-scroll::-webkit-scrollbar { display: none; }
`

/* -------------------------------------------------- */
/*  Sub-tab type                                       */
/* -------------------------------------------------- */

/* ================================================================
   FLOW: AI Styling - Redesigned (Reference Style)
   ================================================================ */

export function StylingHome() {
  const navigate = useNavigate()

  const [activeChat, setActiveChat] = useState(false)
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [missingCategories, setMissingCategories] = useState<ClothingCategory[]>([])

  // 真实数据
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const topRef = useRef<SwiperRef>(null)
  const bottomRef = useRef<SwiperRef>(null)
  const shoesRef = useRef<SwiperRef>(null)

  // 截图目标：三条老虎机 + reason 卡
  const captureRef = useRef<HTMLDivElement>(null)

  // 当前每条 swiper 停留的 index，用于保存时取当前搭配
  const currentIdx = useRef<{ top: number; bottom: number; shoes: number }>({ top: 0, bottom: 0, shoes: 0 })

  const topItems = items.filter((i) => i.category === 'top')
  const bottomItems = items.filter((i) => i.category === 'bottom')
  const shoesItems = items.filter((i) => i.category === 'shoes')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listClothes()
      setItems(data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '加载衣柜失败'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  /* AI Chat send — 调用真实推荐接口 */
  const handleSendChat = async () => {
    const text = chatInput.trim()
    if (!text || isRequesting) return

    setIsRequesting(true)
    setMissingCategories([])

    try {
      const rec = await requestOutfit(text)

      setActiveChat(false)
      setIsAnimating(true)
      setLastPrompt(text)

      const topIdx = topItems.findIndex((i) => i.id === rec.topId)
      const bottomIdx = bottomItems.findIndex((i) => i.id === rec.bottomId)
      const shoesIdx = shoesItems.findIndex((i) => i.id === rec.shoesId)

      setTimeout(() => {
        topRef.current?.swipeTo(topIdx >= 0 ? topIdx : 0)
        currentIdx.current.top = topIdx >= 0 ? topIdx : 0
      }, 200)
      setTimeout(() => {
        bottomRef.current?.swipeTo(bottomIdx >= 0 ? bottomIdx : 0)
        currentIdx.current.bottom = bottomIdx >= 0 ? bottomIdx : 0
      }, 800)
      setTimeout(() => {
        shoesRef.current?.swipeTo(shoesIdx >= 0 ? shoesIdx : 0)
        currentIdx.current.shoes = shoesIdx >= 0 ? shoesIdx : 0
        setIsAnimating(false)
        setRecommendation(rec)
        setChatInput('')
      }, 1400)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'missing_category') {
        const missing = (err.missingCategories ?? []).filter((c): c is ClothingCategory =>
          c === 'top' || c === 'bottom' || c === 'shoes',
        )
        setMissingCategories(missing)
        Toast.show({ content: err.message, position: 'bottom' })
      } else if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '推荐失败，请稍后再试', position: 'bottom' })
      }
    } finally {
      setIsRequesting(false)
    }
  }

  /* Save outfit —  POST /api/outfits → html2canvas → POST /api/favorites */
  const handleSave = async () => {
    if (isSaving) return
    if (topItems.length === 0 || bottomItems.length === 0 || shoesItems.length === 0) {
      Toast.show({ content: '需要三个品类都有单品才能保存', position: 'bottom' })
      return
    }

    const topItem = topItems[currentIdx.current.top] ?? topItems[0]
    const bottomItem = bottomItems[currentIdx.current.bottom] ?? bottomItems[0]
    const shoesItem = shoesItems[currentIdx.current.shoes] ?? shoesItems[0]

    setIsSaving(true)
    try {
      const outfit = await createOutfit({
        topId: topItem.id,
        bottomId: bottomItem.id,
        shoesId: shoesItem.id,
        source: recommendation ? 'ai' : 'manual',
        prompt: recommendation ? lastPrompt : null,
        reason: recommendation?.reason ?? null,
      })

      // 截图：构造一份离屏纯 DOM 镜像（避免 Swiper transform + CORS 污染导致的白图）
      const mirror = document.createElement('div')
      mirror.style.cssText = [
        'position:fixed',
        'left:-9999px',
        'top:0',
        'width:360px',
        'padding:12px',
        'box-sizing:border-box',
        'background:#ffffff',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        'color:#333',
      ].join(';')

      const makeImgBox = (src: string, alt: string, isLast: boolean) => {
        const box = document.createElement('div')
        const marginBottom = isLast ? 0 : 4
        box.style.cssText = `width:100%;height:170px;display:flex;align-items:center;justify-content:center;margin-bottom:${marginBottom}px;background:#fff;`
        const img = document.createElement('img')
        img.crossOrigin = 'anonymous'
        img.src = src
        img.alt = alt
        img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;display:block;border-radius:12px;'
        box.appendChild(img)
        return { box, img }
      }

      const hasReason = Boolean(recommendation?.reason)
      const topEl = makeImgBox(topItem.processedImage, topItem.name, false)
      const bottomEl = makeImgBox(bottomItem.processedImage, bottomItem.name, false)
      const shoesEl = makeImgBox(shoesItem.processedImage, shoesItem.name, !hasReason)
      mirror.appendChild(topEl.box)
      mirror.appendChild(bottomEl.box)
      mirror.appendChild(shoesEl.box)

      if (recommendation?.reason) {
        const reasonEl = document.createElement('div')
        reasonEl.textContent = recommendation.reason
        reasonEl.style.cssText = [
          'margin-top:6px',
          'padding:10px 12px',
          'background:#f5f7ff',
          'border-radius:12px',
          'font-size:14px',
          'line-height:1.6',
          'color:#333',
          'white-space:pre-wrap',
          'word-break:break-word',
        ].join(';')
        mirror.appendChild(reasonEl)
      }

      document.body.appendChild(mirror)

      let canvas: HTMLCanvasElement
      try {
        // 等图片 decode 完，避免截到未就绪的空白
        const imgs = [topEl.img, bottomEl.img, shoesEl.img]
        await Promise.all(
          imgs.map((img) =>
            Promise.race([
              img.decode().catch(() => undefined),
              new Promise((resolve) => setTimeout(resolve, 2000)),
            ]),
          ),
        )

        canvas = await html2canvas(mirror, {
          backgroundColor: '#ffffff',
          useCORS: true,
          scale: window.devicePixelRatio || 2,
          logging: false,
        })
      } finally {
        mirror.remove()
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        throw new Error('screenshot blob empty')
      }

      await createFavorite(outfit.id, blob)

      Toast.show({ icon: 'success', content: '搭配已保存', position: 'bottom' })
      setRecommendation(null)
      setLastPrompt(null)
      // 跳到我的喜欢让用户看到刚保存的
      setTimeout(() => navigate('/favorites'), 600)
    } catch (err) {
      if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '保存失败，请重试', position: 'bottom' })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = recommendation !== null || (
    topItems.length > 0 && bottomItems.length > 0 && shoesItems.length > 0
  )

  return (
    <div style={S.page}>
      <style>{SLOT_KEYFRAMES}</style>

      {/* === Header === */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" />
            <circle cx="18" cy="6" r="2" fill="currentColor" /><circle cx="10" cy="12" r="2" fill="currentColor" /><circle cx="14" cy="18" r="2" fill="currentColor" />
          </svg>
        </div>
        <span style={S.headerTitle}>{'搭配'}</span>
        <div style={S.headerRight}>
          <button
            style={{ ...S.saveBtn, ...(canSave ? S.saveBtnActive : {}) }}
            onClick={canSave && !isSaving ? handleSave : undefined}
            disabled={!canSave || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* === Main Content === */}
      <div style={S.scrollArea} className="styling-scroll">
        {loading ? (
          <div style={S.loadingWrap}>
            <SpinLoading color="primary" />
            <p style={S.loadingText}>{'加载中...'}</p>
          </div>
        ) : loadError ? (
          <div style={S.loadingWrap}>
            <ErrorBlock status="default" title="加载失败" description={loadError} />
            <Button color="primary" size="small" onClick={() => void fetchItems()} style={{ marginTop: 12 }}>
              {'重试'}
            </Button>
          </div>
        ) : (
          <div ref={captureRef} style={S.captureWrap}>
            <ClothingCarousel
              ref={topRef}
              items={topItems}
              categoryLabel={categoryLabel.top}
              isSpinning={isAnimating}
            />
            <ClothingCarousel
              ref={bottomRef}
              items={bottomItems}
              categoryLabel={categoryLabel.bottom}
              isSpinning={isAnimating}
            />
            <ClothingCarousel
              ref={shoesRef}
              items={shoesItems}
              categoryLabel={categoryLabel.shoes}
              isSpinning={isAnimating}
            />

            {/* Recommendation panel */}
            {recommendation && !isAnimating && (
              <div style={S.recommendationPanel}>
                <div style={S.reasonCard}>
                  <span style={S.reasonIcon}>{'✨'}</span>
                  <p style={S.reasonText}>{recommendation.reason}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === AI Hero Dialog === */}
      <HeroDialog
        isOpen={activeChat}
        onOpen={() => setActiveChat(true)}
        onClose={() => setActiveChat(false)}
        trigger={
          <div style={S.fab}>
            <span style={S.fabIcon}>{'帮你搭'}</span>
          </div>
        }
      >
        <div style={S.chatPanel}>
          <div style={S.chatHeader}>
            <span style={S.chatTitle}>{'AI 搭配助手'}</span>
          </div>
          <div style={S.chatHint}>
            {'告诉我你的穿搭需求，例如：“适合约会的温柔风格”'}
          </div>
          {missingCategories.length > 0 && (
            <div style={S.missingHint}>
              {'缺少：'}
              {missingCategories.map((c) => (
                <span key={c} style={S.missingTag}>{categoryLabel[c]}</span>
              ))}
              {'，先上传后再让 AI 搭配吧'}
            </div>
          )}
          <div style={S.chatInputRow}>
            <Input
              placeholder={'描述你想要的搭配风格...'}
              value={chatInput}
              onChange={setChatInput}
              style={{ flex: 1, '--font-size': '14px' } as React.CSSProperties}
              onEnterPress={handleSendChat}
              disabled={isRequesting}
            />
            <Button color="primary" size="small" onClick={handleSendChat} disabled={!chatInput.trim() || isRequesting} loading={isRequesting}>
              {'发送'}
            </Button>
          </div>
        </div>
      </HeroDialog>

      {/* === Animating overlay === */}
      {isAnimating && (
        <div style={S.animOverlay}>
          <div style={S.animSpinner}>
            <div style={S.animDot} />
            <div style={{ ...S.animDot, animationDelay: '0.2s' }} />
            <div style={{ ...S.animDot, animationDelay: '0.4s' }} />
          </div>
          <p style={S.animText}>{'AI 正在为您挑选搭配...'}</p>
        </div>
      )}

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
    position: 'relative',
    overflow: 'hidden',
  },
  /* Header */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px 0',
    flexShrink: 0,
  },
  headerLeft: {
    width: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#000',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#000',
    letterSpacing: '-0.3px',
  },
  headerRight: {
    width: 80,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    border: 'none',
    background: '#e8e8e8',
    color: '#bbb',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: 16,
    cursor: 'not-allowed',
  },
  saveBtnActive: {
    background: '#000',
    color: '#fff',
    cursor: 'pointer',
  },
  /* Scroll area */
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0 0',
    WebkitOverflowScrolling: 'touch',
  },
  captureWrap: {
    background: '#fff',
    padding: '4px 0 20px',
  },
  /* Loading / error */
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    color: '#666',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#999',
  },
  /* Recommendation */
  recommendationPanel: {
    animation: 'fadeInUp 0.4s ease-out',
    margin: '4px 20px 0',
  },
  reasonCard: {
    background: '#fafafa',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #eee',
  },
  reasonIcon: {
    fontSize: 18,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: '22px',
    color: '#333',
    margin: '8px 0 0',
  },
  /* FAB (trigger visual only, positioned by HeroDialog) */
  fab: {
    height: 44,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 22,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  },
  fabIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap' as const,
  },
  /* Chat content */
  chatPanel: {
    padding: 20,
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chatTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#000',
  },
  chatHint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 14,
    lineHeight: '20px',
  },
  missingHint: {
    fontSize: 13,
    color: '#d4380d',
    background: '#fff2e8',
    padding: '8px 12px',
    borderRadius: 10,
    marginBottom: 14,
    lineHeight: '20px',
  },
  missingTag: {
    display: 'inline-block',
    background: '#ff7a45',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    margin: '0 4px',
  },
  chatInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  /* Animation overlay */
  animOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  animSpinner: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  animDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#000',
    animation: 'fadeInUp 0.6s ease-in-out infinite alternate',
  },
  animText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 500,
  },
}
