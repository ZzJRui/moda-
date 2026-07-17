import { lazy, Suspense, useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { uploadClothesWithProgress } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import { EmptyState } from '@moda/ui'
import { BottomNavigation } from './BottomNavigation'
import { UploadBubbleMenu } from './UploadBubbleMenu'
import { UploadCapsule, type UploadStatus } from './UploadCapsule'
import './ai-closet.css'
import { validateUploadFile } from '../upload/upload-file'

const StylingHome = lazy(() => import('../ai-styling/ai-styling').then((module) => ({ default: module.StylingHome })))
const UploadSheet = lazy(() => import('../upload/upload').then((module) => ({ default: module.UploadSheet })))
const FavoritesList = lazy(() => import('../favorites/favorites').then((module) => ({ default: module.FavoritesList })))
const ClosetList = lazy(() => import('../closet/closet').then((module) => ({ default: module.ClosetList })))
const UiPreview = lazy(() => import('../dev/UiPreview').then((module) => ({ default: module.UiPreview })))

export function CommunityPlaceholder() {
  return <div className="moda-community-page"><EmptyState className="moda-community-page__placeholder" icon="community" title="社区功能即将上线" description="这里未来会承载穿搭分享，现在先把上传与搭配做好。" /></div>
}

function AppShellInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const tabs = [
    { href: '/community', icon: 'community' as const, label: '社区' },
    { href: '/favorites', icon: 'heart' as const, label: '喜欢' },
    { href: '/style', icon: 'star' as const, label: '搭配' },
    { href: '/closet', icon: 'wardrobe' as const, label: '衣柜' },
  ]
  const activeKey = tabs.some((tab) => tab.href === location.pathname) ? location.pathname : '/style'
  const [menuOpen, setMenuOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('uploading')
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>()

  const handleFileSelected = useCallback(async (file: File) => {
    setMenuOpen(false)
    const validationError = validateUploadFile(file)
    if (validationError) {
      setUploadProgress(0)
      setUploadStatus('error')
      setUploadErrorMsg(validationError)
      setUploadVisible(true)
      return
    }
    setUploadProgress(0)
    setUploadStatus('uploading')
    setUploadVisible(true)
    setUploadErrorMsg(undefined)
    try {
      await uploadClothesWithProgress(file, setUploadProgress)
      setUploadStatus('success')
      setUploadProgress(100)
      window.setTimeout(() => { setUploadVisible(false); navigate('/closet') }, 900)
    } catch (error) {
      setUploadStatus('error')
      setUploadErrorMsg(error instanceof ApiError ? error.message : '上传失败')
    }
  }, [navigate])

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <header className="moda-brand-bar"><img src="/logo.png" alt="" /><span className="moda-brand-bar__name">摩搭 moda</span></header>
        <UploadCapsule visible={uploadVisible} progress={uploadProgress} status={uploadStatus} errorMsg={uploadErrorMsg} onDismiss={() => setUploadVisible(false)} />
        <main className="moda-route-area">
          <Suspense fallback={<div className="moda-route-loading">正在打开…</div>}>
            <Routes>
              <Route path="/community" element={<CommunityPlaceholder />} />
              <Route path="/favorites" element={<FavoritesList />} />
              <Route path="/style" element={<StylingHome />} />
              <Route path="/closet" element={<ClosetList />} />
              <Route path="/upload" element={<UploadSheet />} />
              {import.meta.env.DEV && <Route path="/__ui" element={<UiPreview />} />}
              <Route path="*" element={<Navigate to="/style" replace />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNavigation
          items={tabs}
          currentPath={activeKey}
          uploadOpen={menuOpen}
          onUpload={() => setMenuOpen((open) => !open)}
          uploadMenu={<UploadBubbleMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} onFileSelected={handleFileSelected} />}
        />
      </div>
    </div>
  )
}

export default function AppShell() {
  return <BrowserRouter><AppShellInner /></BrowserRouter>
}
