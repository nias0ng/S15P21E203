import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from './Modal'

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

  const esc = (dialog: HTMLElement) =>
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

  it('Esc 를 누르면 닫습니다', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    esc(dialogOf('추천 결과'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('배경을 막아도 Esc 로는 닫힙니다', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} closeOnBackdrop={false} title="추천 결과">
        <p>본문</p>
      </Modal>,
    )

    esc(dialogOf('추천 결과'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('initialFocus 가 panel 이면 열릴 때 [×] 가 아니라 판에 초점을 둡니다', () => {
    render(
      <Modal open onClose={vi.fn()} initialFocus="panel" title="향수 등록">
        <p>본문</p>
      </Modal>,
    )

    expect(dialogOf('향수 등록')).toHaveFocus()
  })
})
