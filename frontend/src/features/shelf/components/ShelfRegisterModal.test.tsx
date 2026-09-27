import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PerfumeOption } from '../types'

import { ShelfRegisterModal } from './ShelfRegisterModal'

const SANTAL: PerfumeOption = {
  perfumeId: 16,
  name: '상탈 33',
  brand: '르 라보',
}
const OUD: PerfumeOption = {
  perfumeId: 7,
  name: '오드 우드',
  brand: '톰 포드',
  alreadyInShelf: true,
}

const renderModal = (
  props: Partial<Parameters<typeof ShelfRegisterModal>[0]> = {},
) =>
  render(
    <ShelfRegisterModal
      open
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      options={[SANTAL, OUD]}
      {...props}
    />,
  )

describe('ShelfRegisterModal 향수 고르기', () => {
  it('이미 담은 향수는 고를 수 없고, 낭독기에는 그 까닭이 읽힌다', () => {
    renderModal()

    expect(
      screen.getByRole('button', {
        name: '오드 우드 · 이미 진열대에 담은 향수입니다',
      }),
    ).toBeDisabled()
  })

  it('향수를 고르면 등록 정보 단계로 넘어가고, [변경] 으로 다시 고른다', async () => {
    renderModal()

    await userEvent.click(screen.getByRole('button', { name: /상탈 33/ }))

    expect(screen.getByText('상탈 33')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '진열대에 담기' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '변경' }))

    expect(
      screen.getByRole('searchbox', { name: '향수명 또는 브랜드명으로 검색' }),
    ).toBeInTheDocument()
  })

  it('검색어를 화면으로 올려 보낸다', async () => {
    const onSearch = vi.fn()
    renderModal({ onSearch })

    await userEvent.type(
      screen.getByRole('searchbox', { name: '향수명 또는 브랜드명으로 검색' }),
      '상탈{Enter}',
    )

    expect(onSearch).toHaveBeenCalledWith('상탈')
  })
})

describe('ShelfRegisterModal 3D 향 지도 위(scene)', () => {
  it('분류 없이 담으면 [필수] 를 띄우고, 고른 뒤에는 담는다', async () => {
    const onSubmit = vi.fn()
    renderModal({ scene: true, preselected: SANTAL, onSubmit })

    await userEvent.click(screen.getByRole('button', { name: '진열대에 담기' }))

    expect(screen.getByRole('alert')).toHaveTextContent('필수')
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '보유 희망' }))
    await userEvent.click(screen.getByRole('button', { name: '진열대에 담기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      perfumeId: 16,
      category: 'WISH',
      rating: null,
      memo: null,
    })
  })
})
