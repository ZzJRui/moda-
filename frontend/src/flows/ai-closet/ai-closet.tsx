import { useCallback } from 'react'
import { SafeArea } from 'antd-mobile'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import { StylingHome } from '../ai-styling/ai-styling'
import { UploadSheet } from '../upload/upload'
import { FavoritesList } from '../favorites/favorites'
import { ClosetList } from '../closet/closet'

/* -------------------------------------------------- */
/*  SVG Icons (minimal, inline)                        */
/* -------------------------------------------------- */

function GlobeIcon({ active }: { active?: boolean }) {
  const c = active ? '#333' : '#999'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function HeartIcon({ active }: { active?: boolean }) {
  const c = active ? '#333' : '#999'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? c : 'none'} stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function StarIcon({ active }: { active?: boolean }) {
  const c = active ? '#333' : '#999'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? c : 'none'} stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function WardrobeIcon({ active }: { active?: boolean }) {
  const c = active ? '#333' : '#999'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <circle cx="9" cy="12" r="1" fill={c} /><circle cx="15" cy="12" r="1" fill={c} />
    </svg>
  )
}

/* -------------------------------------------------- */
/*  Community placeholder                              */
/* -------------------------------------------------- */

export function CommunityPlaceholder() {
  return (
    <div style={communityStyles.page}>
      <div style={communityStyles.body}>
        <div style={communityStyles.placeholder}>
          <span style={communityStyles.emoji}>{'\ud83d\udcf8'}</span>
          <p style={communityStyles.text}>{'\u793e\u533a\u529f\u80fd\u5373\u5c06\u4e0a\u7ebf'}</p>
          <p style={communityStyles.subtext}>{'\u656c\u8bf7\u671f\u5f85'}</p>
        </div>
      </div>
    </div>
  )
}

const communityStyles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' },
  body: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  placeholder: { textAlign: 'center' as const },
  emoji: { fontSize: 48 },
  text: { fontSize: 16, fontWeight: 500, color: '#333', margin: '16px 0 4px' },
  subtext: { fontSize: 13, color: '#999', margin: 0 },
}

/* ================================================================
   FLOW: App Shell - Redesigned
   ================================================================ */

function AppShellInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const tabs = [
    { key: '/community', icon: GlobeIcon, label: '\u793e\u533a' },
    { key: '/favorites', icon: HeartIcon, label: '\u6211\u7684\u559c\u6b22' },
    { key: '/style', icon: StarIcon, label: '\u642d\u914d' },
    { key: '/closet', icon: WardrobeIcon, label: '\u8863\u67dc' },
  ]

  const handleTabClick = useCallback(
    (key: string) => {
      navigate(key)
    },
    [navigate]
  )

  const activeKey = tabs.some((t) => t.key === currentPath) ? currentPath : '/style'

  return (
    <div style={S.appShell}>
      <div style={S.phoneFrame}>
        {/* Route content */}
        <div style={S.routeArea}>
          <Routes>
            <Route path="/community" element={<CommunityPlaceholder />} />
            <Route path="/favorites" element={<FavoritesList />} />
            <Route path="/style" element={<StylingHome />} />
            <Route path="/closet" element={<ClosetList />} />
            <Route path="/upload" element={<UploadSheet />} />
            <Route path="*" element={<Navigate to="/style" replace />} />
          </Routes>
        </div>

        {/* Bottom Navigation - custom icon-based */}
        <div style={S.bottomNav}>
          {tabs.slice(0, 2).map((tab) => {
            const isActive = tab.key === activeKey
            const IconComp = tab.icon
            return (
              <div
                key={tab.key}
                style={{ ...S.navItem, ...(isActive ? S.navItemActive : {}) }}
                onClick={() => handleTabClick(tab.key)}
              >
                <IconComp active={isActive} />
                {isActive && tab.label && (
                  <span style={S.navLabel}>
                    {tab.label}
                  </span>
                )}
              </div>
            )
          })}

          {/* Center gap for floating + button */}
          <div style={S.centerGap} />

          {tabs.slice(2).map((tab) => {
            const isActive = tab.key === activeKey
            const IconComp = tab.icon
            return (
              <div
                key={tab.key}
                style={{ ...S.navItem, ...(isActive ? S.navItemActive : {}) }}
                onClick={() => handleTabClick(tab.key)}
              >
                <IconComp active={isActive} />
                {isActive && tab.label && (
                  <span style={S.navLabel}>
                    {tab.label}
                  </span>
                )}
              </div>
            )
          })}

          {/* Center + button */}
          <div style={S.centerPlus} onClick={() => navigate('/upload')}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
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

/* -------------------------------------------------- */
/*  Styles                                             */
/* -------------------------------------------------- */

const S: Record<string, React.CSSProperties> = {
  appShell: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e8e8e8',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: 932,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 0 24px rgba(0,0,0,0.12)',
  },
  routeArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  /* Bottom Navigation */
  bottomNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    flexShrink: 0,
    borderTop: '1px solid #f0f0f0',
    background: '#fff',
    padding: '0 8px',
    position: 'relative',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    cursor: 'pointer',
    padding: '4px 8px',
    flex: 1,
  },
  navItemActive: {},
  navLabel: {
    fontSize: 10,
    fontWeight: 600,
    marginTop: 2,
    color: '#333',
  },
  /* Center gap - reserves space for floating + button */
  centerGap: {
    width: 56,
    flexShrink: 0,
  },
  /* Center + button */
  centerPlus: {
    position: 'absolute',
    left: '50%',
    top: -16,
    transform: 'translateX(-50%)',
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    zIndex: 10,
  },
}
