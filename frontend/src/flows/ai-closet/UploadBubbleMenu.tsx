import { useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../ui'
import { isMobileBrowser } from '../../utils/device'
import styles from './UploadBubbleMenu.module.css'

/* -------------------------------------------------- */
/*  Types                                              */
/* -------------------------------------------------- */

export interface UploadBubbleMenuProps {
  isOpen: boolean
  onClose: () => void
  onFileSelected: (file: File) => void
}

/* -------------------------------------------------- */
/*  Animation                                          */
/* -------------------------------------------------- */

const bubbleVariants = {
  hidden: { opacity: 0, scale: 0.3, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.3, y: 8 },
  tap: { scale: 0.88 },
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
            className={styles.backdrop}
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
            className={styles.hiddenInput}
            onChange={handleFile}
          />
          {isMobile && (
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.hiddenInput}
              onChange={handleFile}
            />
          )}

          {/* Desktop: single "图库" bubble */}
          {!isMobile && (
            <motion.div
              className={styles.bubbleCenter}
              variants={bubbleVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              whileTap="tap"
              transition={bubbleTransition}
              onClick={() => galleryInputRef.current?.click()}
            >
              <div className={styles.iconCircle}>
                <Icon name="gallery" size={22} strokeWidth={1.5} />
              </div>
            </motion.div>
          )}

          {/* Mobile: "拍照" left + "资源管理器" right */}
          {isMobile && (
            <>
              <motion.div
                className={styles.bubbleLeft}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileTap="tap"
                transition={{ ...bubbleTransition, delay: 0 }}
                onClick={() => cameraInputRef.current?.click()}
              >
                <div className={styles.iconCircle}>
                  <Icon name="camera" size={22} strokeWidth={1.5} />
                </div>
              </motion.div>

              <motion.div
                className={styles.bubbleRight}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileTap="tap"
                transition={{ ...bubbleTransition, delay: 0.05 }}
                onClick={() => galleryInputRef.current?.click()}
              >
                <div className={styles.iconCircle}>
                  <Icon name="folder" size={22} strokeWidth={1.5} />
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
