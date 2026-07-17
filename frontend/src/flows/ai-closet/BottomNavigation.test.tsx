import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BottomNavigation } from './BottomNavigation'

const items = [
  { href: '/community', icon: 'community' as const, label: '社区' },
  { href: '/favorites', icon: 'heart' as const, label: '喜欢' },
  { href: '/style', icon: 'star' as const, label: '搭配' },
  { href: '/closet', icon: 'wardrobe' as const, label: '衣柜' },
]

describe('BottomNavigation', () => {
  it('keeps upload as the visible primary action', async () => {
    const onUpload = vi.fn()
    const user = userEvent.setup()
    render(<MemoryRouter><BottomNavigation items={items} currentPath="/style" uploadOpen={false} onUpload={onUpload} uploadMenu={null} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: '搭配' })).toHaveAttribute('aria-current', 'page')
    const upload = screen.getByRole('button', { name: '上传衣物' })
    expect(upload).toHaveTextContent('上传衣物')
    await user.click(upload)
    expect(onUpload).toHaveBeenCalledOnce()
  })
})
