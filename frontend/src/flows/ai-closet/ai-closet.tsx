import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import { Icon, SafeArea, showToast, type IconName } from '../../ui'
import { StylingHome } from '../ai-styling/ai-styling'
import { UploadSheet } from '../upload/upload'
import { FavoritesList } from '../favorites/favorites'
import { ClosetList } from '../closet/closet'
import { DesignShowcase } from '../design/design'
import { UploadBubbleMenu } from './UploadBubbleMenu'
import { UploadCapsule } from './UploadCapsule'
import type { UploadStatus } from './UploadCapsule'
import { uploadClothesWithProgress } from '../../api/clothes'
import { ApiError } from '../../api/errors'
import styles from './ai-closet.module.css'

/* -------------------------------------------------- */
/*  Community placeholder                              */
/* -------------------------------------------------- */

export function CommunityPlaceholder() {
  return (
    <div className={styles.communityPage}>
      <div className={styles.communityBody}>
        <div className={styles.communityPlaceholder}>
          <span className={styles.communityEmoji}>{'📸'}</span>
          <p className={styles.communityText}>{'社区功能即将上线'}</p>
          <p className={styles.communitySubtext}>{'敬请期待'}</p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------- */
/*  NavTab — 底部导航单项（激活填品牌色 + 弹跳动效）    */
/*  图标 currentColor 填色，激活态由父级 color 统一切换  */
/* -------------------------------------------------- */

interface NavTabDef {
  key: string
  icon: IconName
  label: string
}

function NavTab({ tab, isActive, onClick }: { tab: NavTabDef; isActive: boolean; onClick: () => void }) {
  return (
    <div
      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
      onClick={onClick}
    >
      <motion.div
        animate={isActive ? { scale: [1, 1.28, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, times: [0, 0.45, 1], ease: [0.34, 1.56, 0.64, 1] }}
        className={styles.navIconWrap}
      >
        <Icon name={tab.icon} size={24} filled={isActive} />
      </motion.div>
      {isActive && tab.label && <span className={styles.navLabel}>{tab.label}</span>}
    </div>
  )
}

/* ================================================================
   FLOW: App Shell
   ================================================================ */

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp']
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

function validateUploadFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTS.includes(ext)) return `仅支持 ${ALLOWED_EXTS.join('/')} 格式`
  if (file.size > MAX_UPLOAD_BYTES) return '文件过大（>8MB）'
  return null
}

function AppShellInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const tabs: NavTabDef[] = [
    { key: '/community', icon: 'globe', label: '社区' },
    { key: '/favorites', icon: 'heart', label: '我的喜欢' },
    { key: '/style', icon: 'star', label: '搭配' },
    { key: '/closet', icon: 'wardrobe', label: '衣柜' },
  ]

  const handleTabClick = useCallback(
    (key: string) => {
      navigate(key)
    },
    [navigate]
  )

  const activeKey = tabs.some((t) => t.key === currentPath) ? currentPath : '/style'

  /* ---- Bubble menu & inline upload ---- */
  const [menuOpen, setMenuOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('uploading')
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | undefined>()

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev)
  }, [])

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const handleFileSelected = useCallback(async (file: File) => {
    setMenuOpen(false)
    const err = validateUploadFile(file)
    if (err) {
      showToast(err)
      return
    }
    setUploadProgress(0)
    setUploadStatus('uploading')
    setUploadVisible(true)
    setUploadErrorMsg(undefined)
    try {
      await uploadClothesWithProgress(file, (p) => setUploadProgress(p))
      setUploadStatus('success')
      setUploadProgress(100)
      window.setTimeout(() => {
        setUploadVisible(false)
        navigate('/closet')
      }, 1500)
    } catch (e) {
      setUploadStatus('error')
      setUploadErrorMsg(e instanceof ApiError ? e.message : '上传失败')
    }
  }, [navigate])

  return (
    <div className={`${styles.appShell} app-shell`}>
      <div className={`${styles.phoneFrame} phone-frame`}>
        {/* Brand Header */}
        <div className={`${styles.brandBar} brand-bar`}>
          <img src="/logo.png" alt="摩搭moda" className={styles.brandLogo} />
          <span className={styles.brandName}>{'摩搭moda'}</span>
        </div>

        {/* Upload progress capsule */}
        <UploadCapsule
          visible={uploadVisible}
          progress={uploadProgress}
          status={uploadStatus}
          errorMsg={uploadErrorMsg}
          onDismiss={() => setUploadVisible(false)}
        />

        {/* Route content */}
        <div className={styles.routeArea}>
          <Routes>
            <Route path="/community" element={<CommunityPlaceholder />} />
            <Route path="/favorites" element={<FavoritesList />} />
            <Route path="/style" element={<StylingHome />} />
            <Route path="/closet" element={<ClosetList />} />
            <Route path="/upload" element={<UploadSheet />} />
            <Route path="/design" element={<DesignShowcase />} />
            <Route path="*" element={<Navigate to="/style" replace />} />
          </Routes>
        </div>

        {/* Bottom Navigation - custom icon-based */}
        <div className={`${styles.bottomNav} bottom-nav`}>
          {tabs.slice(0, 2).map((tab) => (
            <NavTab
              key={tab.key}
              tab={tab}
              isActive={tab.key === activeKey}
              onClick={() => handleTabClick(tab.key)}
            />
          ))}

          {/* Center gap for floating + button */}
          <div className={styles.centerGap} />

          {tabs.slice(2).map((tab) => (
            <NavTab
              key={tab.key}
              tab={tab}
              isActive={tab.key === activeKey}
              onClick={() => handleTabClick(tab.key)}
            />
          ))}

          {/* Bubble menu (renders when open) */}
          <UploadBubbleMenu
            isOpen={menuOpen}
            onClose={handleCloseMenu}
            onFileSelected={handleFileSelected}
          />

          {/* Center + / X button */}
          <div className={styles.centerPlus} onClick={handleToggleMenu}>
            <motion.div
              animate={{ rotate: menuOpen ? 45 : 0 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={styles.centerPlusInner}
            >
              <Icon name="plus" size={28} strokeWidth={2.5} />
            </motion.div>
          </div>
        </div>
        <SafeArea position="bottom" />
      </div>
    </div>
  )
}

/* -------------------------------------------------- */
/*  AppShell (default export with BrowserRouter)       */
/* -------------------------------------------------- */

export default function AppShell() {
  return (
    <BrowserRouter>
      <AppShellInner />
    </BrowserRouter>
  )
}
