import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { Button, EmptyState, IconButton, PageHeader } from '@moda/ui'

describe('Moda UI', () => {
  it('exposes accessible controls and intent-based components', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onAction = vi.fn()
    const { container } = render(<><PageHeader title="衣物详情" onBack={onBack} /><Button onClick={onAction}>上传衣物</Button><IconButton label="关闭" icon="x" /></>)
    await user.click(screen.getByRole('button', { name: '返回' }))
    await user.click(screen.getByRole('button', { name: '上传衣物' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '关闭' })).toBeVisible()
    expect((await axe(container)).violations).toHaveLength(0)
  })

  it('gives an empty state a clear next action', () => {
    render(<EmptyState title="衣柜还是空的" description="上传第一件衣物。" action={<Button>上传衣物</Button>} />)
    expect(screen.getByRole('heading', { name: '衣柜还是空的' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: '上传衣物' })).toHaveLength(1)
  })
})
