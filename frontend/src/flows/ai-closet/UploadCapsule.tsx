import { motion, AnimatePresence } from 'framer-motion'

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
    status === 'error' ? '#ff4d4f' : status === 'success' ? '#52c41a' : '#000'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          style={CS.capsule}
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -70, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={status !== 'uploading' ? onDismiss : undefined}
        >
          <span style={CS.text}>{label}</span>
          <div style={CS.track}>
            <motion.div
              style={{ ...CS.bar, background: barColor, width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const CS: Record<string, React.CSSProperties> = {
  capsule: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    background: '#fff',
    borderRadius: 16,
    padding: '10px 16px 8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    cursor: 'pointer',
  },
  text: {
    fontSize: 13,
    fontWeight: 500,
    color: '#333',
  },
  track: {
    height: 3,
    borderRadius: 2,
    background: '#f0f0f0',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
}
