import { useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import type { ReactNode } from 'react'

/* =================================================================
 *  HeroDialog — iOS-style shared-layout hero animation
 *
 *  Spring-physics driven transition from a compact trigger (FAB)
 *  to an expanded bottom-sheet card.
 *
 *  Features:
 *  - layoutId shared animation (size + position + borderRadius)
 *  - True Spring physics (stiffness / damping, no linear easing)
 *  - Corner radius morphing (pill → card)
 *  - Drag-to-dismiss with velocity-aware snap-back
 *  - Content fade-in with staggered delay
 *  - Backdrop with opacity animation
 *
 *  Usage:
 *    <HeroDialog
 *      isOpen={isOpen}
 *      onClose={() => setIsOpen(false)}
 *      trigger={<FAB />}
 *    >
 *      <DialogContent />
 *    </HeroDialog>
 * ================================================================= */

/* -------------------------------------------------- */
/*  Constants                                          */
/* -------------------------------------------------- */

const LAYOUT_ID = 'hero-dialog'

/** Apple-style snappy spring: high stiffness, moderate damping, subtle bounce */
const SPRING_LAYOUT = { type: 'spring' as const, stiffness: 300, damping: 30 }

/** Softer spring for content fade-in, delayed to let layout animation lead */
const SPRING_CONTENT = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 25,
  delay: 0.08,
}

/** Drag threshold: close if dragged >120px OR velocity >500px/s */
const DRAG_CLOSE_DISTANCE = 120
const DRAG_CLOSE_VELOCITY = 500

/* -------------------------------------------------- */
/*  Props                                              */
/* -------------------------------------------------- */

interface HeroDialogProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
}

/* ================================================================
 *  Component
 * ================================================================ */

export function HeroDialog({ isOpen, onOpen, onClose, trigger, children }: HeroDialogProps) {
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            style={S.backdrop}
          />
        )}
      </AnimatePresence>

      {/* Shared-layout container: morphs between trigger and expanded card */}
      <AnimatePresence>
        {isOpen ? (
          <ExpandedCard key="expanded" onClose={onClose}>
            {children}
          </ExpandedCard>
        ) : (
          <motion.div
            key="trigger"
            layoutId={LAYOUT_ID}
            onClick={onOpen}
            style={S.trigger}
          >
            {trigger}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* -------------------------------------------------- */
/*  ExpandedCard — the bottom-sheet card with drag    */
/* -------------------------------------------------- */

function ExpandedCard({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  const dragY = useMotionValue(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    startY.current = e.clientY
    lastY.current = e.clientY
    lastTime.current = Date.now()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = e.clientY - startY.current
    // Rubber-band: resist upward drag
    const y = delta >= 0 ? delta : delta * 0.15
    dragY.set(y)
    lastY.current = e.clientY
    lastTime.current = Date.now()
  }

  const handlePointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const currentY = dragY.get()
    const velocity = (lastY.current - startY.current) / Math.max(1, Date.now() - lastTime.current) * 1000

    if (currentY > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY) {
      // Spring back to origin first, THEN close → layoutId morphs card → pill
      const controls = animate(dragY, 0, {
        type: 'spring',
        stiffness: 500,
        damping: 32,
        onComplete: () => onClose(),
      })
      return () => controls.stop()
    } else {
      // Snap back with bounce
      const controls = animate(dragY, 0, {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      })
      return () => controls.stop()
    }
  }

  return (
    <motion.div
      ref={cardRef}
      layoutId={LAYOUT_ID}
      initial={{ borderRadius: 22 }}
      animate={{ borderRadius: 24 }}
      exit={{ borderRadius: 22 }}
      transition={SPRING_LAYOUT}
      style={{ ...S.card, y: dragY }}
    >
      {/* Drag handle indicator */}
      <div
        style={S.dragHandle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={S.dragPill} />
      </div>

      {/* Content — fades in with delayed spring */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={SPRING_CONTENT}
        style={S.contentWrap}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 99,
  },
  /* Trigger (collapsed) — absolute position, inherits FAB layout */
  trigger: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    cursor: 'pointer',
    zIndex: 10,
  },
  /* Expanded card — fixed position, centered, above nav bar */
  card: {
    position: 'fixed',
    bottom: 81,
    left: 0,
    right: 0,
    maxWidth: 430,
    margin: '0 auto',
    height: '75vh',
    background: '#fff',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: 24,
    touchAction: 'none',
  },
  /* Drag handle */
  dragHandle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    flexShrink: 0,
    cursor: 'grab',
    touchAction: 'none',
  },
  dragPill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    background: '#ddd',
  },
  /* Content wrapper */
  contentWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '0 20px 20px',
  },
}
