import { useState, useRef, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useTransform, animate } from 'framer-motion'
import type { AIRecommendation, ClothingCategory } from '../shared/types'
import { requestOutfit } from '../../api/recommendations'
import { ApiError } from '../../api/errors'
import { Icon, IconButton } from '@moda/ui'
import './StylingChat.css'

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
  const shouldReduceMotion = useReducedMotion() ?? false
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const nextId = useRef(1)
  const listRef = useRef<HTMLDivElement>(null)

  // Drag-to-dismiss state
  const dragY = useMotionValue(0)
  const dragTransform = useTransform(dragY, (value) => `translateY(${value}px)`)
  const dragging = useRef(false)
  const startY = useRef(0)
  const lastY = useRef(0)
  const lastTime = useRef(0)
  const velocityY = useRef(0)

  const handleDragStart = (e: React.PointerEvent) => {
    dragging.current = true
    startY.current = e.clientY
    lastY.current = e.clientY
    lastTime.current = performance.now()
    velocityY.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const now = performance.now()
    const elapsed = Math.max(1, now - lastTime.current)
    velocityY.current = (e.clientY - lastY.current) / elapsed * 1000
    const delta = e.clientY - startY.current
    // Rubber-band: resist upward drag
    const y = delta >= 0 ? delta : delta * 0.15
    dragY.set(y)
    lastY.current = e.clientY
    lastTime.current = now
  }

  const handleDragEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    const currentY = dragY.get()
    const velocity = velocityY.current

    if (currentY > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY) {
      const controls = animate(dragY, window.innerHeight, {
        duration: 0.2,
        ease: [0.32, 0.72, 0, 1],
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
  }, [isOpen, dragY])

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
        Toast.show({ content: `缺少${missing.join('、')}，先上传后再让 AI 搭配吧`, position: 'bottom' })
      } else if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '推荐失败，请稍后再试', position: 'bottom' })
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
            className="styling-chat__backdrop"
          />
        )}
      </AnimatePresence>

      {/* Shared-layout: pill ↔ card morph */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-card"
            layoutId={shouldReduceMotion ? undefined : CHAT_LAYOUT_ID}
            initial={{ borderRadius: 22 }}
            animate={{ borderRadius: 24 }}
            exit={{ borderRadius: 22 }}
            transition={SPRING_LAYOUT}
            className="styling-chat__card"
            style={{ transform: shouldReduceMotion ? undefined : dragTransform }}
          >
            {/* Drag handle */}
            <div
              className="styling-chat__drag-handle"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="styling-chat__drag-pill" />
            </div>

            {/* Content — fades in with delayed spring */}
            <motion.div
              key="chat-content"
              initial={{ opacity: 0, transform: shouldReduceMotion ? 'none' : 'translateY(12px)' }}
              animate={{ opacity: 1, transform: 'none' }}
              exit={{ opacity: 0, transform: shouldReduceMotion ? 'none' : 'translateY(60px)' }}
              transition={SPRING_CONTENT}
              className="styling-chat__content"
            >
              {/* Title bar */}
              <div className="styling-chat__title-bar">
                <span className="styling-chat__title">{'AI 搭配助手'}</span>
                <IconButton label="关闭 AI 搭配助手" icon="x" size="sm" onClick={onClose} />
              </div>

              {/* Messages */}
              <div ref={listRef} className="styling-chat__message-list styling-scroll">
                {/* Greeting bubble */}
                <div className="styling-chat__bubble-row">
                  <div className="styling-chat__bubble styling-chat__bubble--ai">{GREETING}</div>
                </div>

                {/* Chat messages */}
                {messages.map((msg) => (
                  <div key={msg.id} className={`styling-chat__bubble-row${msg.role === 'user' ? ' styling-chat__bubble-row--user' : ''}`}>
                    <div className={`styling-chat__bubble ${msg.role === 'user' ? 'styling-chat__bubble--user' : 'styling-chat__bubble--ai'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="styling-chat__bubble-row">
                    <div className="styling-chat__bubble styling-chat__bubble--ai styling-chat__typing-bubble">
                      <span className="styling-chat__dot" />
                      <span className="styling-chat__dot styling-chat__dot--delayed-1" />
                      <span className="styling-chat__dot styling-chat__dot--delayed-2" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="styling-chat__input-bar chat-input-bar">
                <input
                  className="styling-chat__input"
                  placeholder="描述你想要的搭配风格..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                  disabled={isTyping}
                />
                <button
                  type="button"
                  aria-label="发送搭配需求"
                  className="styling-chat__send-button"
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
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
