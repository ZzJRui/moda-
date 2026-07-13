import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheet,
  Button,
  Image,
  NavBar,
  Result,
  SafeArea,
  SpinLoading,
  Tag,
  showToast,
} from '../../ui'
import type { Action } from '../../ui'
import { useNavigate } from 'react-router-dom'
import type { ClothingCategory, ClothingItem } from '../shared/types'
import { autoTagClothes, uploadClothes } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import { isMobileBrowser } from '../../utils/device'
import styles from './upload.module.css'

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
      showToast(err)
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
        showToast('AI 识别失败，已按默认标签保存，可在下方重新识别')
      } else {
        showToast('上传成功')
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '上传失败，请重试')
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
      showToast('重新识别成功')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : '重新识别失败')
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
    <div className={styles.page}>
      <NavBar onBack={handleBack} className={styles.navBar}>
        {'上传衣物'}
      </NavBar>

      {/* 隐藏的 file input：拍照 vs 图库。桌面端不渲染 camera 输入 */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={(e) => handleFileChosen(e.target.files?.[0])}
        />
      )}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => handleFileChosen(e.target.files?.[0])}
      />

      <div className={styles.content}>
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
          <div className={styles.imageSelectedPanel}>
            <div className={styles.previewContainer}>
              <Image
                src={preview.url}
                width={200}
                height={200}
                fit="cover"
                className={styles.previewImage}
              />
            </div>
            <div className={styles.detectedInfo}>
              <span className={styles.detectedLabel}>{'点击开始上传后 AI 会自动识别'}</span>
            </div>
            <div className={styles.actionButtons}>
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                className={styles.outlinePillBtn}
              >
                {'重新选择'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleStartUpload}
                className={styles.pillBtn}
              >
                {'开始上传'}
              </Button>
            </div>
          </div>
        )}

        {/* 上传中 */}
        {uploading && (
          <div className={styles.uploadingPanel}>
            <SpinLoading color="primary" className={styles.spinner} />
            <p className={styles.uploadingText}>{'正在上传并识别衣物...'}</p>
            <p className={styles.uploadingHint}>{'AI 识别可能需要几秒钟'}</p>
          </div>
        )}

        {/* 上传成功 */}
        {uploaded && (
          <div className={styles.successPanel}>
            <Result
              status={uploaded.taggingStatus === 'ai_failed' ? 'warning' : 'success'}
              title={uploaded.taggingStatus === 'ai_failed' ? '已保存，AI 识别失败' : '上传成功'}
              description={
                uploaded.taggingStatus === 'ai_failed'
                  ? '衣物已入库，但标签需要重新识别'
                  : '衣物已添加到您的衣柜中'
              }
            />

            <div className={styles.tagsBlock}>
              <div className={styles.tagRow}>
                <span className={styles.tagLabel}>{'品类：'}</span>
                <Tag color="primary" className={styles.detectedTag}>
                  {categoryLabel[uploaded.category]}
                </Tag>
                {uploaded.subtype && (
                  <Tag color="default" className={styles.detectedTag}>{uploaded.subtype}</Tag>
                )}
              </div>
              {uploaded.colorBase && (
                <div className={styles.tagRow}>
                  <span className={styles.tagLabel}>{'颜色：'}</span>
                  <Tag color="default" className={styles.detectedTag}>{uploaded.colorBase}</Tag>
                </div>
              )}
              {uploaded.style && uploaded.style !== 'unknown' && (
                <div className={styles.tagRow}>
                  <span className={styles.tagLabel}>{'风格：'}</span>
                  <Tag color="default" className={styles.detectedTag}>{uploaded.style}</Tag>
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
                className={styles.pillBtn}
              >
                {'重新识别'}
              </Button>
            )}

            <div className={styles.successActions}>
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                className={styles.outlinePillBtn}
              >
                {'继续上传'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleViewCloset}
                className={styles.pillBtn}
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
