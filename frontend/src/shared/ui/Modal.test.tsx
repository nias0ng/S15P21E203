import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from './Modal'

/**
 * 배경 클릭은 **판 밖을 눌렀는가**로 가릅니다 — 브라우저에서 `::backdrop` 을 누르면
 * 이벤트의 target 이 `<dialog>` 자신이 되고, 판 안을 누르면 그 안의 요소가 됩니다.
 * 여기서 검사하는 것은 그 가르기(`event.target === dialog`)이지, jsdom 이 재현하지 않는
 * 배경의 생김새나 자리가 아닙니다 (`test/setup.ts` 의 경고는 그쪽을 말합니다).
 *
 * `<dialog>` 자체에는 role 이 없어(jsdom 폴리필이 `open` 만 흉내 냅니다) 제목으로 찾습니다.
 */
const dialogOf = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('dialog')!

describe('Modal', () => {
  it('배경을 누르면 닫습니다', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    fireEvent.click(dialogOf('추천 결과'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closeOnBackdrop 이 false 면 배경을 눌러도 닫지 않습니다', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeOnBackdrop={false} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    fireEvent.click(dialogOf('추천 결과'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('배경을 막아도 [×] 로는 닫힙니다 — 나가는 길이 사라지면 안 됩니다', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeOnBackdrop={false} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('판 안을 눌러도 닫지 않습니다', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    fireEvent.click(screen.getByText('본문'))

    expect(onClose).not.toHaveBeenCalled()
  })
})
