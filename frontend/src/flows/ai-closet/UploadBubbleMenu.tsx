import { useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isMobileBrowser } from '../../utils/device'

/* -------------------------------------------------- */
/*  Types                                              */
/* -------------------------------------------------- */

export interface UploadBubbleMenuProps {
  isOpen: boolean
  onClose: () => void
  onFileSelected: (file: File) => void
}

/* -------------------------------------------------- */
/*  SVG Icons                                          */
/* -------------------------------------------------- */

function GalleryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="#555" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/* -------------------------------------------------- */
/*  Animation                                          */
/* -------------------------------------------------- */

const bubbleVariants = {
  hidden: { opacity: 0, scale: 0.3, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.3, y: 8 },
}

const bubbleTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 22,
}

/* -------------------------------------------------- */
/*  Component                                          */
/* -------------------------------------------------- */

export function UploadBubbleMenu({ isOpen, onClose, onFileSelected }: UploadBubbleMenuProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMemo(() => isMobileBrowser(), [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFileSelected(file)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — catches outside clicks */}
          <motion.div
            style={BS.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Hidden file inputs */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          {isMobile && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          )}

          {/* Desktop: single "图库" bubble */}
          {!isMobile && (
            <motion.div
              style={BS.bubbleCenter}
              variants={bubbleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={bubbleTransition}
              onClick={() => galleryInputRef.current?.click()}
            >
              <div style={BS.iconCircle}>
                <GalleryIcon />
              </div>
            </motion.div>
          )}

          {/* Mobile: "拍照" left + "资源管理器" right */}
          {isMobile && (
            <>
              <motion.div
                style={BS.bubbleLeft}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ ...bubbleTransition, delay: 0 }}
                onClick={() => cameraInputRef.current?.click()}
              >
                <div style={BS.iconCircle}>
                  <CameraIcon />
                </div>
              </motion.div>

              <motion.div
                style={BS.bubbleRight}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ ...bubbleTransition, delay: 0.05 }}
                onClick={() => galleryInputRef.current?.click()}
              >
                <div style={BS.iconCircle}>
                  <FolderIcon />
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  )
}

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const BS: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
  },
  /* Desktop: centered above the "+" button */
  bubbleCenter: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 76,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 21,
  },
  /* Mobile: left bubble */
  bubbleLeft: {
    position: 'absolute',
    right: 56,
    bottom: 76,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 21,
  },
  /* Mobile: right bubble */
  bubbleRight: {
    position: 'absolute',
    left: 56,
    bottom: 76,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 21,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
  },
}
