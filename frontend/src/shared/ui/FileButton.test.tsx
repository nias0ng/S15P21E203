import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FileButton } from './FileButton'

const photo = () => new File(['병'], 'bottle.png', { type: 'image/png' })

describe('FileButton', () => {
  it('고른 파일 한 장을 넘긴다', async () => {
    const onPick = vi.fn()
    render(
      <FileButton inputLabel="이미지 추가" onPick={onPick}>
        + 이미지 첨부
      </FileButton>,
    )
    const file = photo()

    await userEvent.upload(screen.getByLabelText('이미지 추가'), file)

    expect(onPick).toHaveBeenCalledExactlyOnceWith(file)
    expect(screen.getByText('+ 이미지 첨부')).toBeInTheDocument()
  })

  /* 값이 남아 있으면 같은 파일을 다시 골랐을 때 change 가 오지 않습니다 */
  it('고른 뒤 칸을 비워 같은 파일을 다시 고를 수 있다', async () => {
    const onPick = vi.fn()
    render(
      <FileButton inputLabel="이미지 추가" onPick={onPick}>
        + 이미지 첨부
      </FileButton>,
    )
    const input = screen.getByLabelText<HTMLInputElement>('이미지 추가')

    await userEvent.upload(input, photo())

    expect(input.value).toBe('')
  })

  it('기본으로 사진 네 형식만 고르게 좁힌다', () => {
    render(
      <FileButton inputLabel="이미지 추가" onPick={vi.fn()}>
        + 이미지 첨부
      </FileButton>,
    )

    expect(screen.getByLabelText('이미지 추가')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/gif,image/webp',
    )
  })

  it('busy 면 파일 칸이 꺼져 고를 수 없다', async () => {
    const onPick = vi.fn()
    render(
      <FileButton inputLabel="이미지 추가" onPick={onPick} busy>
        올리는 중
      </FileButton>,
    )
    const input = screen.getByLabelText('이미지 추가')

    expect(input).toBeDisabled()
    await userEvent.upload(input, photo())
    expect(onPick).not.toHaveBeenCalled()
  })
})
