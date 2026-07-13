import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { Icon, showToast } from '../../ui'
import type { AIRecommendation, ClothingCategory } from '../shared/types'
import { requestOutfit } from '../../api/recommendations'
import { ApiError } from '../../api/errors'
import styles from './StylingChat.module.css'

/* -------------------------------------------------- */
/*  Types                                              */
/* -------------------------------------------------- */

interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  text: string
}

interface StylingChatProps {
  isOpen: boolean
  onClose: () => void
  onRecommend: (rec: AIRecommendation, prompt: string) => void
}

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

const GREETING = '嗨，告诉我你今天想穿什么风格？'

/* -------------------------------------------------- */
/*  Shared-layout constants (exported for FAB)          */
/* -------------------------------------------------- */

export const CHAT_LAYOUT_ID = 'styling-chat'

/** Apple-style snappy spring for the pill ↔ card morph */
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
/*  Component                                          */
/* -------------------------------------------------- */

export function StylingChat({ isOpen, onClose, onRecommend }: StylingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const nextId = useRef(1)
  const listRef = useRef<HTMLDivElement>(null)

  // Drag-to-dismiss state
  const dragY = useMotionValue(0)
  const dragging = useRef(false)
  const startY = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)

  const handleDragStart = (e: React.PointerEvent) => {
    dragging.current = true
    startY.current = e.clientY
    lastY.current = e.clientY
    lastTime.current = Date.now()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = e.clientY - startY.current
    // Rubber-band: resist upward drag
    const y = delta >= 0 ? delta : delta * 0.15
    dragY.set(y)
    lastY.current = e.clientY
    lastTime.current = Date.now()
  }

  const handleDragEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    const currentY = dragY.get()
    const velocity = (lastY.current - startY.current) / Math.max(1, Date.now() - lastTime.current) * 1000

    if (currentY > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY) {
      // Spring back then close
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

  // Reset chat when opened
  useEffect(() => {
    if (isOpen) {
      setMessages([])
      setInput('')
      setIsTyping(false)
      nextId.current = 1
      dragY.set(0)
    }
  }, [isOpen])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isTyping) return

    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const rec = await requestOutfit(text)

      const aiMsg: ChatMessage = { id: nextId.current++, role: 'ai', text: rec.reason }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)

      // Stay open ~1.5s for user to read, then close + trigger slot machine
      setTimeout(() => {
        onRecommend(rec, text)
        onClose()
      }, 1500)
    } catch (err) {
      setIsTyping(false)
      if (err instanceof ApiError && err.code === 'missing_category') {
        const missing = (err.missingCategories ?? [])
          .filter((c): c is ClothingCategory => c === 'top' || c === 'bottom' || c === 'shoes')
          .map((c) => categoryLabel[c])
        showToast(`缺少${missing.join('、')}，先上传后再让 AI 搭配吧`)
      } else if (err instanceof ApiError) {
        showToast(err.message)
      } else {
        showToast('推荐失败，请稍后再试')
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
            className={styles.backdrop}
          />
        )}
      </AnimatePresence>

      {/* Shared-layout: pill ↔ card morph */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-card"
            layoutId={CHAT_LAYOUT_ID}
            initial={{ borderRadius: 22 }}
            animate={{ borderRadius: 24 }}
            exit={{ borderRadius: 22 }}
            transition={SPRING_LAYOUT}
            className={styles.card}
            style={{ y: dragY }}
          >
            {/* Drag handle */}
            <div
              className={styles.dragHandle}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
            >
              <div className={styles.dragPill} />
            </div>

            {/* Content — fades in with delayed spring */}
            <motion.div
              key="chat-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={SPRING_CONTENT}
              className={styles.contentWrap}
            >
              {/* Title bar */}
              <div className={styles.titleBar}>
                <span className={styles.title}>{'AI 搭配助手'}</span>
                <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭">
                  <Icon name="close" size={20} strokeWidth={2} />
                </button>
              </div>

              {/* Messages */}
              <div ref={listRef} className={styles.messageList}>
                {/* Greeting bubble */}
                <div className={styles.bubbleRow}>
                  <div className={`${styles.bubble} ${styles.aiBubble}`}>{GREETING}</div>
                </div>

                {/* Chat messages */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.bubbleRow} ${msg.role === 'user' ? styles.bubbleRowUser : ''}`}
                  >
                    <div
                      className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className={styles.bubbleRow}>
                    <div className={`${styles.bubble} ${styles.aiBubble} ${styles.typingBubble}`}>
                      <span className={styles.dot} />
                      <span className={`${styles.dot} ${styles.dotDelay1}`} />
                      <span className={`${styles.dot} ${styles.dotDelay2}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className={`${styles.inputBar} chat-input-bar`}>
                <input
                  className={styles.input}
                  placeholder="描述你想要的搭配风格..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                  disabled={isTyping}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  aria-label="发送"
                >
                  <Icon name="send" size={18} strokeWidth={2} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
