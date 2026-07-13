/**
 * Moda 图标组件 — 全应用图标唯一来源（见 DESIGN.md §2.1）。
 *
 * - 一律 currentColor 填色，颜色由父级 color 控制（激活态变色的桥梁）。
 * - 尺寸档位 16 / 20 / 24，默认 strokeWidth 1.8。
 * - `filled` 仅对定义了实心变体的图标生效（底部导航激活态），
 *   其余图标传入 filled 不报错、按描边渲染。
 */
import type { CSSProperties, ReactElement } from 'react'

export type IconName =
  | 'chevron-left'
  | 'search'
  | 'heart'
  | 'star'
  | 'globe'
  | 'wardrobe'
  | 'hanger'
  | 'user'
  | 'eye-off'
  | 'sliders'
  | 'close'
  | 'send'
  | 'plus'
  | 'gallery'
  | 'camera'
  | 'folder'

interface IconDef {
  outline: ReactElement
  /** 实心变体（底部导航激活态用），内部细节线用 #fff 镂空 */
  filled?: ReactElement
}

const ICONS: Record<IconName, IconDef> = {
  'chevron-left': {
    outline: <polyline points="15 18 9 12 15 6" />,
  },
  search: {
    outline: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  heart: {
    outline: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
    filled: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
  },
  star: {
    outline: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
    filled: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
  },
  globe: {
    outline: (
      <>
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </>
    ),
    filled: (
      <>
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" fill="none" stroke="#fff" strokeWidth="1.5" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  wardrobe: {
    outline: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
      </>
    ),
    filled: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" stroke="#fff" strokeWidth="1.5" />
        <circle cx="9" cy="12" r="1" fill="#fff" />
        <circle cx="15" cy="12" r="1" fill="#fff" />
      </>
    ),
  },
  hanger: {
    outline: (
      <>
        <path d="M12 2a3 3 0 0 0-3 3c0 1.1.6 2.1 1.5 2.6L12 9l1.5-1.4A3 3 0 0 0 12 2z" />
        <path d="M3.5 15.5L12 9l8.5 6.5a1.5 1.5 0 0 1-1 2.5H4.5a1.5 1.5 0 0 1-1-2.5z" />
      </>
    ),
  },
  user: {
    outline: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 12 0v1" />
      </>
    ),
  },
  'eye-off': {
    outline: (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ),
  },
  sliders: {
    outline: (
      <>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </>
    ),
  },
  close: {
    outline: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  },
  send: {
    outline: (
      <>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </>
    ),
  },
  plus: {
    outline: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
  },
  gallery: {
    outline: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M21 15l-5-5L5 21" />
      </>
    ),
  },
  camera: {
    outline: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
  },
  folder: {
    outline: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  },
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

export interface IconProps {
  name: IconName
  /** 尺寸档位 16 / 20 / 24，默认 20 */
  size?: number
  strokeWidth?: number
  /** 实心变体（仅 heart/star/globe/wardrobe 支持） */
  filled?: boolean
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 20, strokeWidth = 1.8, filled = false, className, style }: IconProps) {
  const def = ICONS[name]
  const useFilled = filled && def.filled
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={useFilled ? 'currentColor' : 'none'}
      stroke={useFilled ? 'none' : 'currentColor'}
      strokeWidth={useFilled ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {useFilled ? def.filled : def.outline}
    </svg>
  )
}
