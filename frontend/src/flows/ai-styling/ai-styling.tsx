import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Button,
  Toast,
  SafeArea,
  ErrorBlock,
  SpinLoading,
} from 'antd-mobile'
import type { SwiperRef } from 'antd-mobile/es/components/swiper'
import { useNavigate } from 'react-router-dom'
import type { ClothingCategory, AIRecommendation, ClothingItem } from '../shared/types'
import { listClothes } from '../../api/clothes'
import { createOutfit } from '../../api/outfits'
import { createFavorite } from '../../api/favorites'
import { ApiError } from '../../api/errors'
import { ClothingCarousel } from './ClothingCarousel'
import { StylingChat, CHAT_LAYOUT_ID } from './StylingChat'
import { motion, useReducedMotion } from 'framer-motion'
import { Button as ModaButton, PageHeader } from '@moda/ui'
import { useDelayedBusy } from '../shared/useDelayedBusy'
import './ai-styling.css'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

/* -------------------------------------------------- */
/*  Sub-tab type                                       */
/* -------------------------------------------------- */

/* ================================================================
   FLOW: AI Styling - Redesigned (Reference Style)
   ================================================================ */

export function StylingHome() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion() ?? false

  const [activeChat, setActiveChat] = useState(false)
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 真实数据
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const showLoading = useDelayedBusy(loading)

  const topRef = useRef<SwiperRef>(null)
  const bottomRef = useRef<SwiperRef>(null)
  const shoesRef = useRef<SwiperRef>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(220)

  // 截图目标：三条老虎机
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

  // 动态计算卡片高度，使三行卡片填满可视区域
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const calc = () => {
      const h = el.clientHeight
      // captureWrap padding (32 top + 8 bottom) + 2 slot gaps (8px each) = 56
      const available = h - 32 - 8 - 8 * 2
      setCardHeight(Math.max(Math.floor(available / 3 * 0.95), 120))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* AI Chat — 收到推荐后触发老虎机动画 */
  const handleChatRecommend = (rec: AIRecommendation, prompt: string) => {
    setRecommendation(rec)
    setLastPrompt(prompt)
    setActiveChat(false)
    setIsAnimating(true)

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
    }, 1400)
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
          'background:#f5f5f5',
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

        const { default: html2canvas } = await import('html2canvas')
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
    <div className="styling-page">
      <PageHeader
        title="搭配"
        action={
          <ModaButton
            size="sm"
            variant={canSave ? 'primary' : 'secondary'}
            onClick={() => void handleSave()}
            disabled={!canSave || isSaving}
          >
            {isSaving ? '保存中…' : '保存'}
          </ModaButton>
        }
      />

      {/* === Main Content === */}
      <div ref={scrollAreaRef} className="styling-page__scroll styling-scroll">
        {loading ? (showLoading ? (
          <div className="styling-page__state">
            <SpinLoading color="primary" />
            <p className="styling-page__state-text">{'加载中…'}</p>
          </div>
        ) : null) : loadError ? (
          <div className="styling-page__state">
            <ErrorBlock status="default" title="加载失败" description={loadError} />
            <Button color="primary" size="small" onClick={() => void fetchItems()}>
              {'重试'}
            </Button>
          </div>
        ) : (
          <div ref={captureRef} className="styling-page__capture">
            <ClothingCarousel
              ref={topRef}
              items={topItems}
              height={cardHeight}
              categoryLabel={categoryLabel.top}
              isSpinning={isAnimating}
            />
            <ClothingCarousel
              ref={bottomRef}
              items={bottomItems}
              height={cardHeight}
              categoryLabel={categoryLabel.bottom}
              isSpinning={isAnimating}
            />
            <ClothingCarousel
              ref={shoesRef}
              items={shoesItems}
              height={cardHeight}
              categoryLabel={categoryLabel.shoes}
              isSpinning={isAnimating}
            />
          </div>
        )}
      </div>

      {/* === AI Chat FAB (layoutId shared with StylingChat) === */}
      <motion.button
        type="button"
        layoutId={shouldReduceMotion ? undefined : CHAT_LAYOUT_ID}
        className="styling-page__ai-fab"
        onClick={() => !activeChat && setActiveChat(true)}
        aria-label="打开 AI 搭配助手"
      >
        <motion.span
          className="styling-page__ai-fab-label"
          animate={{ opacity: activeChat ? 0 : 1 }}
          transition={{ duration: 0.15 }}
        >
          {'帮你搭'}
        </motion.span>
      </motion.button>

      {/* === AI Chat Overlay === */}
      <StylingChat
        isOpen={activeChat}
        onClose={() => setActiveChat(false)}
        onRecommend={handleChatRecommend}
      />

      {/* === Animating overlay === */}
      {isAnimating && (
        <div className="styling-page__anim-overlay">
          <div className="styling-page__anim-spinner">
            <div className="moda-styling-dot" />
            <div className="moda-styling-dot moda-styling-dot--delayed-1" />
            <div className="moda-styling-dot moda-styling-dot--delayed-2" />
          </div>
          <p className="styling-page__anim-text">{'AI 正在为您挑选搭配…'}</p>
        </div>
      )}

      <SafeArea position="bottom" />
    </div>
  )
}
