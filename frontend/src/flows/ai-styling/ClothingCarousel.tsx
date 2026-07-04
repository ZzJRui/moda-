import { forwardRef } from 'react'
import { Swiper } from 'antd-mobile'
import type { SwiperRef } from 'antd-mobile/es/components/swiper'
import type { ClothingItem } from '../shared/types'

/* -------------------------------------------------- */
/*  Props                                              */
/* -------------------------------------------------- */

interface ClothingCarouselProps {
  items: ClothingItem[]
  height?: number
  categoryLabel?: string
  isSpinning?: boolean
}

/* -------------------------------------------------- */
/*  Global CSS (scrollbar hiding, injected once)       */
/* -------------------------------------------------- */

const GLOBAL_CSS = `
.adm-swiper { scrollbar-width: none; -ms-overflow-style: none; }
.adm-swiper::-webkit-scrollbar { display: none; }
`

/* ================================================================
   ClothingCarousel
   ================================================================ */

export const ClothingCarousel = forwardRef<SwiperRef, ClothingCarouselProps>(
  function ClothingCarousel({ items, height = 250, categoryLabel = '', isSpinning }, ref) {
    /* --- Empty state --- */
    if (items.length === 0) {
      return (
        <div style={C.slot}>
          <div style={{ ...C.emptySlot, height: Math.max(height, 120) }}>
            <span style={C.emptySlotPlus}>+</span>
            <span style={C.emptySlotText}>{'\u6dfb\u52a0'}{categoryLabel}</span>
          </div>
        </div>
      )
    }

    /* --- Swiper carousel --- */
    return (
      <div style={{ ...C.slot, ...(isSpinning ? C.slotSpinning : {}) }}>
        <style>{GLOBAL_CSS}</style>
        <Swiper
          ref={ref}
          slideSize={100}
          trackOffset={0}
          stuckAtBoundary={false}
          total={items.length}
          indicator={false}
          style={{ '--height': `${height}px` } as React.CSSProperties}
        >
          {items.map((item) => (
            <Swiper.Item key={item.id}>
              <div style={C.slide}>
                <img
                  src={item.processedImage}
                  alt={item.name}
                  style={C.image}
                  draggable={false}
                  crossOrigin="anonymous"
                />
              </div>
            </Swiper.Item>
          ))}
        </Swiper>
      </div>
    )
  }
)

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const C: Record<string, React.CSSProperties> = {
  slot: {
    marginBottom: 8,
    touchAction: 'pan-y',
  },
  slotSpinning: {
    animation: 'slotGlow 0.8s ease-in-out infinite',
  },
  /* Slide: full width, inner padding centers the card */
  slide: {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box' as const,
    padding: '0 40px',
  },
  /* Image: fills the padded area, maintains aspect ratio */
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    display: 'block',
    borderRadius: 12,
    background: '#fff',
  },
  /* Empty slot */
  emptySlot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    background: '#fafafa',
    margin: '0 12px',
    borderRadius: 12,
    border: '1.5px dashed #ddd',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  emptySlotPlus: {
    fontSize: 28,
    color: '#ccc',
    fontWeight: 300,
    lineHeight: 1,
    marginBottom: 4,
  },
  emptySlotText: {
    fontSize: 15,
    fontWeight: 500,
    color: '#333',
    letterSpacing: '0.3px',
  },
}
