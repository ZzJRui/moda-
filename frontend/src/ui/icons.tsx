import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'arrow-left' | 'camera' | 'check' | 'community' | 'eye-off' | 'folder'
  | 'hanger' | 'heart' | 'image' | 'plus' | 'search' | 'send' | 'sliders'
  | 'sparkles' | 'star' | 'trash' | 'user' | 'wardrobe' | 'x'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  filled?: boolean
}

const paths: Record<IconName, ReactNode> = {
  'arrow-left': <path d="m15 18-6-6 6-6" />,
  camera: <><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  community: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  'eye-off': <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.2 3.3M6.2 6.2A17 17 0 0 0 2 12s3 8 10 8a10 10 0 0 0 5.8-1.8" /></>,
  folder: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />,
  hanger: <><path d="M9.5 6.5a2.5 2.5 0 1 1 3.4 2.3c-.9.4-.9 1.2-.9 2.2" /><path d="m3 18 9-7 9 7H3Z" /></>,
  heart: <path d="M20.8 8.8c0 5.4-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" /><path d="m21 15-5-5L5 21" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></>,
  sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="white" /><circle cx="16" cy="12" r="2" fill="white" /><circle cx="10" cy="18" r="2" fill="white" /></>,
  sparkles: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></>,
  wardrobe: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18M9 12h.01M15 12h.01" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

export function Icon({ name, size = 20, filled = false, strokeWidth = 1.8, ...props }: IconProps) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>
}

type NamedIconProps = Omit<IconProps, 'name'>
export function ArrowLeftIcon(props: NamedIconProps) { return <Icon name="arrow-left" {...props} /> }
export function CameraIcon(props: NamedIconProps) { return <Icon name="camera" {...props} /> }
export function CheckIcon(props: NamedIconProps) { return <Icon name="check" {...props} /> }
export function HeartIcon(props: NamedIconProps) { return <Icon name="heart" {...props} /> }
export function ImageIcon(props: NamedIconProps) { return <Icon name="image" {...props} /> }
export function PlusIcon(props: NamedIconProps) { return <Icon name="plus" {...props} /> }
export function SearchIcon(props: NamedIconProps) { return <Icon name="search" {...props} /> }
export function SendIcon(props: NamedIconProps) { return <Icon name="send" {...props} /> }
export function SparklesIcon(props: NamedIconProps) { return <Icon name="sparkles" {...props} /> }
export function WardrobeIcon(props: NamedIconProps) { return <Icon name="wardrobe" {...props} /> }
export function XIcon(props: NamedIconProps) { return <Icon name="x" {...props} /> }
