import { useState, useRef, useEffect } from 'react'
import { Toast } from 'antd-mobile'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import type { AIRecommendation, ClothingCategory } from '../shared/types'
import { requestOutfit } from '../../api/recommendations'
import { ApiError } from '../../api/errors'

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
            style={S.backdrop}
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
            style={{ ...S.card, y: dragY }}
          >
            {/* Drag handle */}
            <div
              style={S.dragHandle}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
            >
              <div style={S.dragPill} />
            </div>

            {/* Content — fades in with delayed spring */}
            <motion.div
              key="chat-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={SPRING_CONTENT}
              style={S.contentWrap}
            >
              {/* Title bar */}
              <div style={S.titleBar}>
                <span style={S.title}>{'AI 搭配助手'}</span>
                <button style={S.closeBtn} onClick={onClose}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Messages */}
              <div ref={listRef} style={S.messageList} className="styling-scroll">
                {/* Greeting bubble */}
                <div style={S.bubbleRow}>
                  <div style={{ ...S.bubble, ...S.aiBubble }}>{GREETING}</div>
                </div>

                {/* Chat messages */}
                {messages.map((msg) => (
                  <div key={msg.id} style={{ ...S.bubbleRow, ...(msg.role === 'user' ? S.bubbleRowUser : {}) }}>
                    <div style={{ ...S.bubble, ...(msg.role === 'user' ? S.userBubble : S.aiBubble) }}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div style={S.bubbleRow}>
                    <div style={{ ...S.bubble, ...S.aiBubble, ...S.typingBubble }}>
                      <span style={S.dot} />
                      <span style={{ ...S.dot, animationDelay: '0.2s' }} />
                      <span style={{ ...S.dot, animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div style={S.inputBar} className="chat-input-bar">
                <input
                  style={S.input}
                  placeholder="描述你想要的搭配风格..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                  disabled={isTyping}
                />
                <button
                  style={{ ...S.sendBtn, ...(!input.trim() || isTyping ? S.sendBtnDisabled : {}) }}
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* -------------------------------------------------- */
/*  Typing dot keyframes (injected once)               */
/* -------------------------------------------------- */

const TYPING_KEYFRAMES = `
@keyframes chatDotBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}
`

// Inject keyframes on module load
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style')
  styleEl.textContent = TYPING_KEYFRAMES
  document.head.appendChild(styleEl)
}

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 99,
  },
  /* Card — fixed position, all corners rounded, lifted from bottom edge.
     layoutId morphs it from the FAB pill (position: absolute in page). */
  card: {
    position: 'fixed',
    bottom: 16,
    left: 12,
    right: 12,
    maxWidth: 430,
    margin: '0 auto',
    height: 'calc(85dvh - 16px)',
    background: '#fff',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    touchAction: 'none',
  },
  /* Content wrapper — fills remaining space after drag handle */
  contentWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  /* Drag handle */
  dragHandle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
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
  /* Title bar */
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 20px 12px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 600,
    color: '#000',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    padding: 4,
    cursor: 'pointer',
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Message list */
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 0',
    WebkitOverflowScrolling: 'touch',
  },
  bubbleRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    borderRadius: 18,
    fontSize: 14,
    lineHeight: '22px',
    wordBreak: 'break-word' as const,
  },
  aiBubble: {
    background: '#f5f5f5',
    color: '#333',
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    background: '#000',
    color: '#fff',
    borderBottomRightRadius: 6,
  },
  /* Typing indicator */
  typingBubble: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
    padding: '12px 18px',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#999',
    animation: 'chatDotBounce 1.2s ease-in-out infinite',
  },
  /* Input bar */
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    height: 40,
    border: '1px solid #e8e8e8',
    borderRadius: 20,
    padding: '0 16px',
    fontSize: 14,
    outline: 'none',
    background: '#fafafa',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: '#000',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: '#e0e0e0',
    color: '#bbb',
    cursor: 'not-allowed',
  },
}
