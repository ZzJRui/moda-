import { motion, AnimatePresence } from 'framer-motion'
import styles from './UploadCapsule.module.css'

/* -------------------------------------------------- */
/*  Types                                              */
/* -------------------------------------------------- */

export type UploadStatus = 'uploading' | 'success' | 'error'

export interface UploadCapsuleProps {
  visible: boolean
  progress: number      // 0 – 100
  status: UploadStatus
  errorMsg?: string
  onDismiss?: () => void
}

/* -------------------------------------------------- */
/*  Component                                          */
/* -------------------------------------------------- */

export function UploadCapsule({ visible, progress, status, errorMsg, onDismiss }: UploadCapsuleProps) {
  const label =
    status === 'uploading'
      ? '图片正在上传中'
      : status === 'success'
        ? '上传成功'
        : errorMsg ?? '上传失败'

  const barColor =
    status === 'error' ? 'var(--danger)' : status === 'success' ? 'var(--success)' : 'var(--brand)'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.capsule}
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -70, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={status !== 'uploading' ? onDismiss : undefined}
        >
          <span className={styles.text}>{label}</span>
          <div className={styles.track}>
            <motion.div
              className={styles.bar}
              style={{ background: barColor, width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
