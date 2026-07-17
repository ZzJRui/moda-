import { useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@moda/ui'
import { isMobileBrowser } from '../../utils/device'
import './upload-feedback.css'

export interface UploadBubbleMenuProps { isOpen: boolean; onClose: () => void; onFileSelected: (file: File) => void }

const transition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }

export function UploadBubbleMenu({ isOpen, onClose, onFileSelected }: UploadBubbleMenuProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMemo(() => isMobileBrowser(), [])
  const reduceMotion = useReducedMotion() ?? false
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFileSelected(file)
  }
  const animation = reduceMotion ? { opacity: 1, transform: 'none' } : { opacity: 1, transform: 'translateY(0) scale(1)' }
  const hidden = reduceMotion ? { opacity: 0, transform: 'none' } : { opacity: 0, transform: 'translateY(8px) scale(.95)' }

  return (
    <AnimatePresence>
      {isOpen && <>
        <motion.div className="upload-menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }} onClick={onClose} />
        <input ref={galleryInputRef} className="upload-menu-input" type="file" accept="image/*" onChange={handleFile} />
        {isMobile && <input ref={cameraInputRef} className="upload-menu-input" type="file" accept="image/*" capture="environment" onChange={handleFile} />}
        {isMobile ? <>
          <Bubble label="拍照上传" icon="camera" position="left" onClick={() => cameraInputRef.current?.click()} initial={hidden} animate={animation} />
          <Bubble label="从图库选择" icon="folder" position="right" onClick={() => galleryInputRef.current?.click()} initial={hidden} animate={animation} delay={.03} />
        </> : <Bubble label="从图库选择" icon="image" position="center" onClick={() => galleryInputRef.current?.click()} initial={hidden} animate={animation} />}
      </>}
    </AnimatePresence>
  )
}

interface BubbleProps { label: string; icon: 'camera' | 'folder' | 'image'; position: 'left' | 'right' | 'center'; onClick: () => void; initial: Record<string, string | number>; animate: Record<string, string | number>; delay?: number }
function Bubble({ label, icon, position, onClick, initial, animate, delay = 0 }: BubbleProps) {
  return <motion.button type="button" aria-label={label} className={`upload-menu-bubble upload-menu-bubble--${position}`} initial={initial} animate={animate} exit={initial} transition={{ ...transition, delay }} onClick={onClick}><Icon name={icon} size={21} /></motion.button>
}
