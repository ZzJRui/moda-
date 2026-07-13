/**
 * 统一的异步三态容器：loading / error+重试 / empty（见 DESIGN.md §2.1 规则 4）。
 * 之前每个 flow 各写一遍 stateWrap，这里收编为唯一实现。
 */
import type { ReactNode } from 'react'
import { Button, ErrorBlock, SpinLoading } from './antd'
import styles from './AsyncState.module.css'

export interface AsyncStateProps {
  loading: boolean
  error?: string | null
  onRetry?: () => void
  /** 数据为空时展示 emptyContent（不传则直接渲染 children） */
  empty?: boolean
  emptyContent?: ReactNode
  loadingText?: string
  errorTitle?: string
  children: ReactNode
}

export function AsyncState({
  loading,
  error,
  onRetry,
  empty = false,
  emptyContent,
  loadingText = '加载中...',
  errorTitle = '加载失败',
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className={styles.stateWrap}>
        <SpinLoading color="primary" />
        <span className={styles.hint}>{loadingText}</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className={styles.stateWrap}>
        <ErrorBlock status="default" title={errorTitle} description={error} />
        {onRetry && (
          <Button color="primary" size="small" className={styles.retryBtn} onClick={onRetry}>
            {'重试'}
          </Button>
        )}
      </div>
    )
  }
  if (empty && emptyContent !== undefined) {
    return <>{emptyContent}</>
  }
  return <>{children}</>
}
