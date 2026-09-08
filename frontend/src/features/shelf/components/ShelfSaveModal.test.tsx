import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ShelfSaveModal } from './ShelfSaveModal'

describe('ShelfSaveModal', () => {
  it('저장 모드에서는 분류를 고르기 전까지 저장할 수 없다', async () => {
    const onSave = vi.fn()
    render(<ShelfSaveModal open onClose={() => {}} onSave={onSave} />)

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '보유 중' }))

    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(onSave).toHaveBeenCalledWith('OWNED')
  })

  it('initialCategory 를 주면 분류 변경 모드가 되고 그 분류가 선택돼 있다', () => {
    render(
      <ShelfSaveModal
        open
        onClose={() => {}}
        onSave={() => {}}
        initialCategory="TRIED"
      />,
    )

    expect(screen.getByText('분류 변경')).toBeInTheDocument()
    // 이미 골라져 있으니 바로 누를 수 있어야 합니다
    expect(screen.getByRole('button', { name: '변경' })).toBeEnabled()
  })

  it('닫았다 다시 열면 지난번 선택이 남지 않는다', async () => {
    // Modal 은 <dialog> 라서 닫아도 언마운트되지 않습니다.
    // 초기화가 빠지면 다른 향수를 골라도 앞 향수의 분류가 보입니다.
    const { rerender } = render(
      <ShelfSaveModal open onClose={() => {}} onSave={() => {}} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '보유 중' }))
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()

    rerender(
      <ShelfSaveModal open={false} onClose={() => {}} onSave={() => {}} />,
    )
    rerender(<ShelfSaveModal open onClose={() => {}} onSave={() => {}} />)

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })
})
