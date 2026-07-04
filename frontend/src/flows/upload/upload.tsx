import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NavBar,
  ActionSheet,
  Image,
  SpinLoading,
  Result,
  Button,
  Toast,
  SafeArea,
  Tag,
} from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import type { Action } from 'antd-mobile/es/components/action-sheet'
import type { ClothingCategory, ClothingItem } from '../shared/types'
import { autoTagClothes, uploadClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import { isMobileBrowser } from '../../utils/device'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp']
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

interface PreviewFile {
  file: File
  url: string
}

/* ================================================================
   FLOW: Upload Clothing (v4 纯 AI 打标签)
   ------------------------------------------------
   1. ActionSheet: 拍照 / 图库选择 -> file input
   2. 本地预校验（扩展名 + 大小）
   3. POST /api/clothes/upload -> 后端 AI 自动打标签
   4. 成功页展示 category / subtype / color_base；若 tagging_status=ai_failed
      则暴露"重新识别"按钮走 POST /api/clothes/{id}/auto-tag
   ================================================================ */

export function UploadSheet() {
  const [sheetVisible, setSheetVisible] = useState(true)
  const [preview, setPreview] = useState<PreviewFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<ClothingItem | null>(null)
  const [retagging, setRetagging] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // 桌面浏览器隐藏"拍照"按钮：桌面上没有相机场景，避免误触后弹权限
  const isMobile = useMemo(() => isMobileBrowser(), [])

  // 清理 blob URL，防止内存泄漏
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const validateFile = (file: File): string | null => {
    const parts = file.name.split('.')
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
    if (!ALLOWED_EXTS.includes(ext)) {
      return `仅支持 ${ALLOWED_EXTS.join('/')} 格式`
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return `文件过大（>8MB）`
    }
    return null
  }

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return
    const err = validateFile(file)
    if (err) {
      Toast.show({ content: err, position: 'bottom' })
      return
    }
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview({ file, url: URL.createObjectURL(file) })
    setSheetVisible(false)
  }

  const actions: Action[] = [
    ...(isMobile
      ? [
          {
            text: '拍照',
            key: 'camera',
            onClick: () => cameraInputRef.current?.click(),
          },
        ]
      : []),
    {
      text: '从图库选择',
      key: 'gallery',
      onClick: () => galleryInputRef.current?.click(),
    },
  ]

  const handleStartUpload = async () => {
    if (!preview || uploading) return
    setUploading(true)
    try {
      const item = await uploadClothes(preview.file)
      setUploaded(item)
      if (item.taggingStatus === 'ai_failed') {
        Toast.show({
          content: 'AI 识别失败，已按默认标签保存，可在下方重新识别',
          position: 'bottom',
        })
      } else {
        Toast.show({ icon: 'success', content: '上传成功', position: 'bottom' })
      }
    } catch (err) {
      if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '上传失败，请重试', position: 'bottom' })
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRetag = async () => {
    if (!uploaded || retagging) return
    setRetagging(true)
    try {
      const updated = await autoTagClothes(uploaded.id)
      setUploaded(updated)
      Toast.show({ icon: 'success', content: '重新识别成功', position: 'bottom' })
    } catch (err) {
      if (err instanceof ApiError) {
        Toast.show({ content: err.message, position: 'bottom' })
      } else {
        Toast.show({ content: '重新识别失败', position: 'bottom' })
      }
    } finally {
      setRetagging(false)
    }
  }

  const handleContinue = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setUploaded(null)
    setSheetVisible(true)
    // 清空 file input 让同一个文件可以再选
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const handleViewCloset = () => navigate('/closet')

  const handleBack = () => {
    // ActionSheet 状态下取消 = 退出上传
    if (sheetVisible && !preview) {
      navigate(-1)
      return
    }
    navigate(-1)
  }

  return (
    <div style={styles.page}>
      <NavBar onBack={handleBack} style={styles.navBar}>
        {'上传衣物'}
      </NavBar>

      {/* 隐藏的 file input：拍照 vs 图库。桌面端不渲染 camera 输入 */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChosen(e.target.files?.[0])}
        />
      )}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChosen(e.target.files?.[0])}
      />

      <div style={styles.content}>
        <ActionSheet
          visible={sheetVisible && !preview}
          actions={actions}
          cancelText={'取消'}
          onClose={() => {
            setSheetVisible(false)
            if (!preview) navigate(-1)
          }}
        />

        {/* 预览 + 开始上传 */}
        {preview && !uploading && !uploaded && (
          <div style={styles.imageSelectedPanel}>
            <div style={styles.previewContainer}>
              <Image
                src={preview.url}
                width={200}
                height={200}
                fit="cover"
                style={styles.previewImage}
              />
            </div>
            <div style={styles.detectedInfo}>
              <span style={styles.detectedLabel}>{'点击开始上传后 AI 会自动识别'}</span>
            </div>
            <div style={styles.actionButtons}>
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                style={styles.reselectBtn}
              >
                {'重新选择'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleStartUpload}
                style={styles.uploadBtn}
              >
                {'开始上传'}
              </Button>
            </div>
          </div>
        )}

        {/* 上传中 */}
        {uploading && (
          <div style={styles.uploadingPanel}>
            <SpinLoading color="primary" style={styles.spinner} />
            <p style={styles.uploadingText}>{'正在上传并识别衣物...'}</p>
            <p style={styles.uploadingHint}>{'AI 识别可能需要几秒钟'}</p>
          </div>
        )}

        {/* 上传成功 */}
        {uploaded && (
          <div style={styles.successPanel}>
            <Result
              status={uploaded.taggingStatus === 'ai_failed' ? 'warning' : 'success'}
              title={uploaded.taggingStatus === 'ai_failed' ? '已保存，AI 识别失败' : '上传成功'}
              description={
                uploaded.taggingStatus === 'ai_failed'
                  ? '衣物已入库，但标签需要重新识别'
                  : '衣物已添加到您的衣柜中'
              }
            />

            <div style={styles.tagsBlock}>
              <div style={styles.tagRow}>
                <span style={styles.tagLabel}>{'品类：'}</span>
                <Tag color="primary" style={styles.detectedTag}>
                  {categoryLabel[uploaded.category]}
                </Tag>
                {uploaded.subtype && (
                  <Tag color="default" style={styles.detectedTag}>{uploaded.subtype}</Tag>
                )}
              </div>
              {uploaded.colorBase && (
                <div style={styles.tagRow}>
                  <span style={styles.tagLabel}>{'颜色：'}</span>
                  <Tag color="default" style={styles.detectedTag}>{uploaded.colorBase}</Tag>
                </div>
              )}
              {uploaded.style && uploaded.style !== 'unknown' && (
                <div style={styles.tagRow}>
                  <span style={styles.tagLabel}>{'风格：'}</span>
                  <Tag color="default" style={styles.detectedTag}>{uploaded.style}</Tag>
                </div>
              )}
            </div>

            {uploaded.taggingStatus === 'ai_failed' && (
              <Button
                block
                color="warning"
                size="middle"
                loading={retagging}
                onClick={handleRetag}
                style={styles.retagBtn}
              >
                {'重新识别'}
              </Button>
            )}

            <div style={styles.successActions}>
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                style={styles.continueBtn}
              >
                {'继续上传'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleViewCloset}
                style={styles.viewClosetBtn}
              >
                {'查看衣柜'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SafeArea position="bottom" />
    </div>
  )
}

/* -------------------------------------------------- */
/*  Styles                                            */
/* -------------------------------------------------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--adm-color-background, #f5f5f5)',
  },
  navBar: {
    flexShrink: 0,
    borderBottom: '1px solid var(--adm-color-border, #eee)',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  imageSelectedPanel: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid var(--adm-color-border, #eee)',
  },
  previewImage: {
    display: 'block',
    borderRadius: 16,
  },
  detectedInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  detectedLabel: {
    fontSize: 14,
    color: 'var(--adm-color-text, #333)',
  },
  detectedTag: {
    fontSize: 13,
    marginRight: 6,
  },
  actionButtons: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  reselectBtn: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid var(--adm-color-border, #ddd)',
  },
  uploadBtn: {
    minHeight: 44,
    borderRadius: 8,
  },
  uploadingPanel: {
    padding: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  spinner: {
    '--size': '48px',
  } as React.CSSProperties,
  uploadingText: {
    fontSize: 15,
    color: 'var(--adm-color-text, #333)',
    margin: 0,
  },
  uploadingHint: {
    fontSize: 12,
    color: 'var(--adm-color-weak, #999)',
    margin: 0,
  },
  successPanel: {
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  tagsBlock: {
    padding: '16px 20px',
    background: '#fff',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  tagLabel: {
    fontSize: 14,
    color: '#666',
    minWidth: 44,
  },
  retagBtn: {
    borderRadius: 8,
  },
  successActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  continueBtn: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid var(--adm-color-border, #ddd)',
  },
  viewClosetBtn: {
    minHeight: 44,
    borderRadius: 8,
  },
}
