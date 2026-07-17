import { forwardRef } from 'react'
import { Swiper } from 'antd-mobile'
import type { SwiperRef } from 'antd-mobile/es/components/swiper'
import type { ClothingItem } from '../shared/types'
import './ClothingCarousel.css'

/* -------------------------------------------------- */
/*  Props                                              */
/* -------------------------------------------------- */

interface ClothingCarouselProps {
  items: ClothingItem[]
  height?: number
  categoryLabel?: string
  isSpinning?: boolean
}

/* ================================================================
   ClothingCarousel
   ================================================================ */

export const ClothingCarousel = forwardRef<SwiperRef, ClothingCarouselProps>(
  function ClothingCarousel({ items, height = 250, categoryLabel = '', isSpinning }, ref) {
    /* --- Empty state --- */
    if (items.length === 0) {
      return (
        <div className="clothing-carousel">
          <div className="clothing-carousel__empty" style={{ '--carousel-height': `${Math.max(height, 120)}px` } as React.CSSProperties}>
            <span className="clothing-carousel__empty-plus">+</span>
            <span className="clothing-carousel__empty-text">{'\u6dfb\u52a0'}{categoryLabel}</span>
          </div>
        </div>
      )
    }

    /* --- Swiper carousel --- */
    return (
      <div className={`clothing-carousel${isSpinning ? ' clothing-carousel--spinning' : ''}`}>
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
              <div className="clothing-carousel__slide">
                <img
                  src={item.processedImage}
                  alt={item.name}
                  className="clothing-carousel__image"
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
