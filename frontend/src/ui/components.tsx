import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './icons'

type ClassNameProps = { className?: string }

function cx(...names: Array<string | undefined | false>) {
  return names.filter(Boolean).join(' ')
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ClassNameProps {
  label: string
  icon: IconName
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({ label, icon, size = 'md', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx('moda-icon-button', `moda-icon-button--${size}`, className)}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18} />
    </button>
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ClassNameProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', block, className, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx('moda-button', `moda-button--${variant}`, `moda-button--${size}`, block && 'moda-button--block', className)}
      {...props}
    >
      {children}
    </button>
  )
}

/** @deprecated Use Button. Kept temporarily while product flows migrate. */
export const ModaButton = Button
export type ModaButtonProps = ButtonProps

export interface PageHeaderProps extends ClassNameProps {
  title: string
  action?: ReactNode
  onBack?: () => void
  backLabel?: string
}

export function PageHeader({ title, action, onBack, backLabel = '返回', className }: PageHeaderProps) {
  return (
    <header className={cx('moda-page-header', className)}>
      {onBack ? (
        <button type="button" className="moda-page-header__back-button" onClick={onBack} aria-label={backLabel}>
          <Icon name="arrow-left" size={20} />
        </button>
      ) : <span className="moda-page-header__back-button" aria-hidden="true" />}
      <h1 className="moda-page-header__title">{title}</h1>
      <div className="moda-page-header__action">{action}</div>
    </header>
  )
}

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement>, ClassNameProps {
  tone?: 'plain' | 'subtle' | 'raised'
}

export function Surface({ tone = 'plain', className, ...props }: SurfaceProps) {
  return <div className={cx('moda-surface', `moda-surface--${tone}`, className)} {...props} />
}

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement>, ClassNameProps {
  title: string
  description?: string
  icon?: IconName
  action?: ReactNode
}

export function EmptyState({ title, description, icon = 'wardrobe', action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cx('moda-empty-state', className)} {...props}>
      <span className="moda-empty-state__icon" aria-hidden="true"><Icon name={icon} size={30} /></span>
      <h2 className="moda-empty-state__title">{title}</h2>
      {description && <p className="moda-empty-state__description">{description}</p>}
      {action && <div className="moda-empty-state__action">{action}</div>}
    </div>
  )
}
