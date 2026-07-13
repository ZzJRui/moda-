/**
 * 统一页头：返回键 + 居中标题 + 右侧插槽（见 DESIGN.md §2.1 规则 5）。
 * 左右插槽等宽保证标题绝对居中。
 */
import type { ReactNode } from 'react'
import { Icon } from './icons/Icon'
import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  title: string
  /** 传入则显示返回键 */
  onBack?: () => void
  /** 右侧插槽（保存按钮等） */
  right?: ReactNode
  /** 底部分隔线 */
  bordered?: boolean
}

export function PageHeader({ title, onBack, right, bordered = false }: PageHeaderProps) {
  return (
    <div className={`${styles.header} ${bordered ? styles.bordered : ''}`}>
      <div className={styles.side}>
        {onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="返回">
            <Icon name="chevron-left" size={20} strokeWidth={2} />
          </button>
        )}
      </div>
      <span className={styles.title}>{title}</span>
      <div className={`${styles.side} ${styles.right}`}>{right}</div>
    </div>
  )
}
