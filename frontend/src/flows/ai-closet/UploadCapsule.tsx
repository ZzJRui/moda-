import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './upload-feedback.css'

export type UploadStatus = 'uploading' | 'success' | 'error'
export interface UploadCapsuleProps { visible: boolean; progress: number; status: UploadStatus; errorMsg?: string; onDismiss?: () => void }

export function UploadCapsule({ visible, progress, status, errorMsg, onDismiss }: UploadCapsuleProps) {
  const reduceMotion = useReducedMotion() ?? false
  const label = status === 'uploading' ? '正在上传并识别' : status === 'success' ? '上传成功' : errorMsg ?? '上传失败'
  const statusText = status === 'uploading' ? `${Math.round(progress)}%` : status === 'success' ? '完成' : '点按关闭'
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className="upload-capsule"
          disabled={status === 'uploading' || !onDismiss}
          initial={{ transform: reduceMotion ? 'none' : 'translateY(-16px)', opacity: 0 }}
          animate={{ transform: 'translateY(0)', opacity: 1 }}
          exit={{ transform: reduceMotion ? 'none' : 'translateY(-12px)', opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          onClick={status !== 'uploading' ? onDismiss : undefined}
        >
          <span className="upload-capsule__top"><span className="upload-capsule__label">{label}</span><span className="upload-capsule__status">{statusText}</span></span>
          <span className="upload-capsule__track"><motion.span className="upload-capsule__bar" animate={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} /></span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
