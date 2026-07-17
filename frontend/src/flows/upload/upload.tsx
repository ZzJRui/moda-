import { useEffect, useMemo, useRef, useState } from 'react'
import {
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
import { PageHeader } from '@moda/ui'
import { validateUploadFile } from './upload-file'
import './upload.css'

/* -------------------------------------------------- */
/*  Helpers                                           */
/* -------------------------------------------------- */

const categoryLabel: Record<ClothingCategory, string> = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
}

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

  const handleFileChosen = (file: File | undefined) => {
    if (!file) return
    const err = validateUploadFile(file)
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
    <div className="upload-page">
      <PageHeader title="上传衣物" onBack={handleBack} />

      {/* 隐藏的 file input：拍照 vs 图库。桌面端不渲染 camera 输入 */}
      {isMobile && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="upload-page__file-input"
          onChange={(e) => handleFileChosen(e.target.files?.[0])}
        />
      )}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="upload-page__file-input"
        onChange={(e) => handleFileChosen(e.target.files?.[0])}
      />

      <div className="upload-page__content">
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
          <div className="upload-page__selected-panel">
            <div className="upload-page__preview-container">
              <Image
                src={preview.url}
                width={200}
                height={200}
                fit="cover"
                className="upload-page__preview-image"
              />
            </div>
            <div className="upload-page__detected-info">
              <span className="upload-page__detected-label">{'点击开始上传后 AI 会自动识别'}</span>
            </div>
            <div className="upload-page__action-buttons">
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                className="upload-page__secondary-button"
              >
                {'重新选择'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleStartUpload}
                className="upload-page__primary-button"
              >
                {'开始上传'}
              </Button>
            </div>
          </div>
        )}

        {/* 上传中 */}
        {uploading && (
          <div className="upload-page__uploading-panel">
            <SpinLoading color="primary" className="upload-page__spinner" />
            <p className="upload-page__uploading-text">{'正在上传并识别衣物…'}</p>
            <p className="upload-page__uploading-hint">{'AI 识别可能需要几秒钟'}</p>
          </div>
        )}

        {/* 上传成功 */}
        {uploaded && (
          <div className="upload-page__success-panel">
            <Result
              status={uploaded.taggingStatus === 'ai_failed' ? 'warning' : 'success'}
              title={uploaded.taggingStatus === 'ai_failed' ? '已保存，AI 识别失败' : '上传成功'}
              description={
                uploaded.taggingStatus === 'ai_failed'
                  ? '衣物已入库，但标签需要重新识别'
                  : '衣物已添加到您的衣柜中'
              }
            />

            <div className="upload-page__tags-block">
              <div className="upload-page__tag-row">
                <span className="upload-page__tag-label">{'品类：'}</span>
                <Tag color="primary" className="upload-page__detected-tag">
                  {categoryLabel[uploaded.category]}
                </Tag>
                {uploaded.subtype && (
                  <Tag color="default" className="upload-page__detected-tag">{uploaded.subtype}</Tag>
                )}
              </div>
              {uploaded.colorBase && (
                <div className="upload-page__tag-row">
                  <span className="upload-page__tag-label">{'颜色：'}</span>
                  <Tag color="default" className="upload-page__detected-tag">{uploaded.colorBase}</Tag>
                </div>
              )}
              {uploaded.style && uploaded.style !== 'unknown' && (
                <div className="upload-page__tag-row">
                  <span className="upload-page__tag-label">{'风格：'}</span>
                  <Tag color="default" className="upload-page__detected-tag">{uploaded.style}</Tag>
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
                className="upload-page__primary-button"
              >
                {'重新识别'}
              </Button>
            )}

            <div className="upload-page__success-actions">
              <Button
                block
                fill="none"
                size="large"
                onClick={handleContinue}
                className="upload-page__secondary-button"
              >
                {'继续上传'}
              </Button>
              <Button
                block
                color="primary"
                size="large"
                onClick={handleViewCloset}
                className="upload-page__primary-button"
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
