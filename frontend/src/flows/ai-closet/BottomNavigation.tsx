import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@moda/ui'

interface NavigationItem { href: string; icon: IconName; label: string }
interface BottomNavigationProps { items: NavigationItem[]; currentPath: string; uploadOpen: boolean; onUpload: () => void; uploadMenu: ReactNode }

export function BottomNavigation({ items, currentPath, uploadOpen, onUpload, uploadMenu }: BottomNavigationProps) {
  return (
    <nav className="app-bottom-nav" aria-label="主导航">
      <div className="app-bottom-nav__items">
        {items.slice(0, 2).map((item) => <NavigationLink key={item.href} item={item} currentPath={currentPath} />)}
        <span className="app-bottom-nav__center-gap" aria-hidden="true" />
        {items.slice(2).map((item) => <NavigationLink key={item.href} item={item} currentPath={currentPath} />)}
      </div>
      {uploadMenu}
      <button type="button" className="app-upload-cta" onClick={onUpload} aria-expanded={uploadOpen} aria-label={uploadOpen ? '关闭上传菜单' : '上传衣物'}>
        <span className="app-upload-cta__icon" aria-hidden="true"><Icon name="plus" size={19} strokeWidth={2.4} /></span>
        <span>上传衣物</span>
      </button>
    </nav>
  )
}

function NavigationLink({ item, currentPath }: { item: NavigationItem; currentPath: string }) {
  const active = item.href === currentPath
  return <Link to={item.href} className={`app-bottom-nav__link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon name={item.icon} size={21} filled={active && (item.icon === 'heart' || item.icon === 'star')} /><span>{item.label}</span></Link>
}
