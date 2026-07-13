import { forwardRef } from 'react'
import { Swiper, type SwiperRef } from '../../ui'
import type { ClothingItem } from '../shared/types'
import styles from './ClothingCarousel.module.css'

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
   ClothingCarousel — 单品类横向轮播（"老虎机"一条）
   ================================================================ */

export const ClothingCarousel = forwardRef<SwiperRef, ClothingCarouselProps>(
  function ClothingCarousel({ items, height = 250, categoryLabel = '', isSpinning }, ref) {
    /* --- Empty state --- */
    if (items.length === 0) {
      return (
        <div className={styles.slot}>
          <div className={styles.emptySlot} style={{ height: Math.max(height, 120) }}>
            <span className={styles.emptySlotPlus}>+</span>
            <span className={styles.emptySlotText}>{'添加'}{categoryLabel}</span>
          </div>
        </div>
      )
    }

    /* --- Swiper carousel --- */
    return (
      <div className={`${styles.slot} ${isSpinning ? styles.slotSpinning : ''}`}>
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
              <div className={styles.slide}>
                <img
                  src={item.processedImage}
                  alt={item.name}
                  className={styles.image}
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
