import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useLocaleStore } from '@/shared/store/localeStore'

import { MapSearchModal } from './MapSearchModal'

/*
 * 지도 향수 200개는 엔진 데이터(`@landing/perfumes-data`)를 통째로 불러옵니다. 여기서 보려는
 * 것은 닫는 길이라 한 줄만 있으면 됩니다.
 *
 * NOTE: **`loadMapPerfumes` 만 덮습니다.** 같은 파일에 `filterMapPerfumes` 가 있어서, 모듈을
 *   통째로 갈아 끼우면 걸러내는 쪽이 `undefined` 가 되어 화면이 그리다 죽습니다.
 */
const fixture = vi.hoisted(() => ({
  perfumes: [
    {
      fragranticaId: 1,
      name: '아리',
      brand: '아리아나 그란데',
      nameEn: 'Ari',
      brandEn: 'Ariana Grande',
      family: null,
      rank: 27,
    },
  ],
}))

vi.mock('../mapPerfumes', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, loadMapPerfumes: () => Promise.resolve(fixture.perfumes) }
})

const KEYWORD = '아리'

const renderModal = (onClose = vi.fn()) => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MapSearchModal keyword={KEYWORD} onClose={onClose} onSelect={vi.fn()} />
    </QueryClientProvider>,
  )
  return onClose
}

const dialog = () =>
  screen.getByRole('heading', { name: '지도에서 찾기' }).closest('dialog')!

describe('MapSearchModal', () => {
  /*
   * 판이 3D 바다 위에 떠 있어 배경이 화면의 대부분입니다. 훑다 옆을 잘못 누르면 찾은 목록이
   * 통째로 사라지고, 다시 보려면 찾는 말을 처음부터 다시 적어야 합니다.
   */
  it('배경을 눌러도 닫지 않는다', () => {
    const onClose = renderModal()

    fireEvent.click(dialog())

    expect(onClose).not.toHaveBeenCalled()
  })

  it('[×] 로는 닫힌다 — 나가는 길이 사라지면 안 된다', async () => {
    const onClose = renderModal()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  // 배경을 막는 것은 잘못 누르는 것을 막으려는 것이지 가두려는 것이 아닙니다
  it('Esc 로도 닫힌다', () => {
    const onClose = renderModal()

    fireEvent(dialog(), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('찾는 말과 걸린 향수를 같이 보여준다', async () => {
    renderModal()

    expect(await screen.findByText(`‘${KEYWORD}’`)).toBeInTheDocument()
    expect(await screen.findByText('아리아나 그란데 · Ari')).toBeInTheDocument()
  })

  // 영어 화면은 원명이 곧 이름이라 원명을 한 번 더 붙이지 않습니다
  it('영어 화면은 원명 · 원래 브랜드로 적는다', async () => {
    useLocaleStore.getState().setLocale('en')
    renderModal()

    expect(
      screen.getByRole('heading', { name: 'Search the map' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ari')).toBeInTheDocument()
    expect(screen.getByText('Ariana Grande')).toBeInTheDocument()
    expect(screen.getByText(/1 result/)).toBeInTheDocument()
  })
})
