/**
 * 40x40 图标按钮（衣柜页操作行等）。纯图标按钮必须有 aria-label（DESIGN.md §4）。
 */
import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './icons/Icon'
import styles from './IconButton.module.css'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  'aria-label': string
  iconSize?: number
}

export function IconButton({ icon, iconSize = 18, className, type, ...rest }: IconButtonProps) {
  return (
    <button type={type ?? 'button'} className={`${styles.btn} ${className ?? ''}`} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  )
}
