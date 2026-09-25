import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PerfumePicker, type PerfumePickerOption } from './PerfumePicker'

const SANTAL: PerfumePickerOption = {
  id: 16,
  name: '상탈 33',
  brand: '르 라보',
}
const OUD: PerfumePickerOption = { id: 7, name: '오드 우드', brand: '톰 포드' }

const renderPicker = (
  props: Partial<Parameters<typeof PerfumePicker>[0]> = {},
) =>
  render(
    <PerfumePicker
      options={[]}
      isPending={false}
      onPick={vi.fn()}
      onSearch={vi.fn()}
      {...props}
    />,
  )

describe('PerfumePicker', () => {
  /* 아직 안 찾은 것을 "찾지 못했습니다" 라고 하면 열자마자 실패한 것처럼 읽힙니다 */
  it('검색하기 전에는 검색을 권하고, 찾았는데 없으면 없다고 한다', async () => {
    const onSearch = vi.fn()
    renderPicker({ onSearch })

    expect(screen.getByText('향수를 검색해 주세요')).toBeInTheDocument()

    await userEvent.type(
      screen.getByRole('searchbox', { name: '향수명 또는 브랜드명으로 검색' }),
      '없는 향수{Enter}',
    )

    expect(onSearch).toHaveBeenCalledWith('없는 향수')
    expect(screen.getByText('향수를 찾지 못했습니다')).toBeInTheDocument()
  })

  it('기다리는 동안에는 빈 안내를 띄우지 않는다', () => {
    renderPicker({ isPending: true })

    expect(screen.queryByText('향수를 검색해 주세요')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /상탈/ }),
    ).not.toBeInTheDocument()
  })

  it('카드를 누르면 그 후보를 넘긴다', async () => {
    const onPick = vi.fn()
    renderPicker({ options: [SANTAL, OUD], onPick })

    await userEvent.click(screen.getByRole('button', { name: /상탈 33/ }))

    expect(onPick).toHaveBeenCalledExactlyOnceWith(SANTAL)
  })

  it('isSelected 를 넘기면 고른 카드를 누름 상태로 알린다', () => {
    renderPicker({
      options: [SANTAL, OUD],
      isSelected: (id) => id === SANTAL.id,
    })

    expect(screen.getByRole('button', { name: /상탈 33/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /오드 우드/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('isSelected 가 없으면 누름 상태를 알리지 않는다', () => {
    renderPicker({ options: [SANTAL] })

    expect(screen.getByRole('button', { name: /상탈 33/ })).not.toHaveAttribute(
      'aria-pressed',
    )
  })

  it('꺼진 후보는 누를 수 없고 까닭을 이름과 함께 읽는다', async () => {
    const onPick = vi.fn()
    renderPicker({
      options: [
        {
          ...SANTAL,
          disabled: true,
          disabledLabel: '이미 진열대에 담은 향수입니다',
        },
      ],
      onPick,
    })

    const card = screen.getByRole('button', {
      name: '상탈 33 · 이미 진열대에 담은 향수입니다',
    })
    expect(card).toBeDisabled()

    await userEvent.click(card)
    expect(onPick).not.toHaveBeenCalled()
  })
})
