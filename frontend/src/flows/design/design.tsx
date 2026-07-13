/**
 * /design — Moda 组件库活体展示页（DESIGN.md 的可视对照）。
 *
 * 作用：
 * 1. 新组件必须在这里登记，保持组件通用性有"消费端"约束；
 * 2. 重构时当肉眼回归测试用；
 * 3. 给 AI 协作提供令牌与组件的真实渲染参照。
 */
import { useState } from 'react'
import {
  AsyncState,
  Button,
  Icon,
  ICON_NAMES,
  IconButton,
  PageHeader,
  showToast,
  Tag,
} from '../../ui'
import styles from './design.module.css'

const COLOR_TOKENS = [
  ['--brand', '品牌主色'],
  ['--brand-press', '品牌按压'],
  ['--brand-bg', '品牌浅底'],
  ['--ink', '标题'],
  ['--ink-strong', '强调标题'],
  ['--text', '正文'],
  ['--text-2', '次要'],
  ['--text-3', '辅助'],
  ['--text-disabled', '禁用'],
  ['--bg', '页面底'],
  ['--bg-subtle', '卡片底'],
  ['--bg-muted', '控件底'],
  ['--divider', '分隔线'],
  ['--border', '描边'],
  ['--border-strong', '强描边'],
  ['--danger', '危险'],
  ['--success', '成功'],
  ['--warning', '警告'],
] as const

const SPACE_TOKENS = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7'] as const

const RADIUS_TOKENS = [
  ['--radius-s', '小控件 8'],
  ['--radius-m', '卡片 12'],
  ['--radius-l', '弹层 16'],
  ['--radius-pill', '胶囊'],
] as const

const SHADOW_TOKENS = [
  ['--shadow-1', '悬浮卡片'],
  ['--shadow-2', '气泡/胶囊'],
  ['--shadow-3', '模态/FAB'],
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

export function DesignShowcase() {
  const [demoState, setDemoState] = useState<'loading' | 'error' | 'done'>('done')

  return (
    <div className={styles.page}>
      <PageHeader title="Moda 设计系统" bordered />

      <div className={styles.scroll}>
        <p className={styles.intro}>
          {'规范文档见 frontend/DESIGN.md。业务代码一律从 src/ui 引入组件，禁止直接 import antd-mobile。'}
        </p>

        <Section title="颜色令牌">
          <div className={styles.swatchGrid}>
            {COLOR_TOKENS.map(([token, label]) => (
              <div key={token} className={styles.swatch}>
                <div className={styles.swatchColor} style={{ background: `var(${token})` }} />
                <span className={styles.swatchToken}>{token}</span>
                <span className={styles.swatchLabel}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="间距（组内 8 / 组间 16 / 区块间 32~40）">
          <div className={styles.spaceCol}>
            {SPACE_TOKENS.map((token) => (
              <div key={token} className={styles.spaceRow}>
                <span className={styles.swatchToken}>{token}</span>
                <div className={styles.spaceBar} style={{ width: `var(${token})` }} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="圆角">
          <div className={styles.radiusRow}>
            {RADIUS_TOKENS.map(([token, label]) => (
              <div key={token} className={styles.radiusItem}>
                <div className={styles.radiusBox} style={{ borderRadius: `var(${token})` }} />
                <span className={styles.swatchLabel}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="阴影">
          <div className={styles.radiusRow}>
            {SHADOW_TOKENS.map(([token, label]) => (
              <div key={token} className={styles.radiusItem}>
                <div className={styles.shadowBox} style={{ boxShadow: `var(${token})` }} />
                <span className={styles.swatchLabel}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={`图标（${ICON_NAMES.length} 个，currentColor）`}>
          <div className={styles.iconGrid}>
            {ICON_NAMES.map((name) => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} size={24} />
                <span className={styles.iconName}>{name}</span>
              </div>
            ))}
          </div>
          <div className={styles.iconGrid}>
            {(['heart', 'star', 'globe', 'wardrobe'] as const).map((name) => (
              <div key={name} className={`${styles.iconCell} ${styles.iconCellBrand}`}>
                <Icon name={name} size={24} filled />
                <span className={styles.iconName}>{`${name} (filled)`}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="按钮（antd-mobile 收编，主题已对齐品牌色）">
          <div className={styles.demoRow}>
            <Button color="primary">{'主操作'}</Button>
            <Button color="primary" fill="outline">{'次操作'}</Button>
            <Button color="danger" fill="outline">{'危险'}</Button>
            <Button disabled>{'禁用'}</Button>
          </div>
        </Section>

        <Section title="IconButton / Tag">
          <div className={styles.demoRow}>
            <IconButton icon="heart" aria-label="收藏" />
            <IconButton icon="eye-off" aria-label="隐藏" />
            <IconButton icon="sliders" aria-label="筛选" />
            <Tag color="primary">{'AI 推荐'}</Tag>
            <Tag color="success">{'手动搭配'}</Tag>
            <span className={styles.pillPrimary}>{'上衣'}</span>
            <span className={styles.pillOutline}>{'休闲'}</span>
          </div>
        </Section>

        <Section title="PageHeader">
          <div className={styles.headerDemo}>
            <PageHeader title="衣物详情" onBack={() => showToast('返回')} bordered />
          </div>
        </Section>

        <Section title="AsyncState 三态">
          <div className={styles.demoRow}>
            <Button size="small" onClick={() => setDemoState('loading')}>{'加载中'}</Button>
            <Button size="small" onClick={() => setDemoState('error')}>{'错误'}</Button>
            <Button size="small" onClick={() => setDemoState('done')}>{'成功'}</Button>
          </div>
          <div className={styles.asyncDemo}>
            <AsyncState
              loading={demoState === 'loading'}
              error={demoState === 'error' ? '示例错误信息' : null}
              onRetry={() => setDemoState('done')}
            >
              <div className={styles.asyncDone}>{'内容加载完成 ✓'}</div>
            </AsyncState>
          </div>
        </Section>

        <Section title="Toast（自研 showToast，替代 React 19 下失效的 Toast.show）">
          <div className={styles.demoRow}>
            <Button size="small" onClick={() => showToast('操作成功')}>{'弹一个 Toast'}</Button>
          </div>
        </Section>
      </div>
    </div>
  )
}
