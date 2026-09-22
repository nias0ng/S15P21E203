import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { usePendingFeedbackStore } from '../pendingFeedbackStore'

import { NlrFeedbackModal } from './NlrFeedbackModal'

const QUERY = '비 오는 날 서점에서 나는 냄새'
const TOKEN = 'b7f3a1e8-4c2d-4f1a-9e3b-2a5c8d7e6f40'

const renderModal = (ready = true) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NlrFeedbackModal ready={ready} />
    </QueryClientProvider>,
  )

beforeEach(() => {
  usePendingFeedbackStore.setState({
    pending: { token: TOKEN, query: QUERY },
    settled: [],
  })
})

describe('NlrFeedbackModal', () => {
  /*
    상세에 다녀와 받는 설문은 결과 목록도 닫혔고 검색창도 비어 있습니다. 이 줄이 없으면
    무엇에 답하는 설문인지가 화면 어디에도 없습니다.
  */
  it('무엇을 검색한 설문인지 같이 보여준다', () => {
    renderModal()

    expect(screen.getByText(`‘${QUERY}’`)).toBeInTheDocument()
  })

  /*
    [×] 는 건너뛰기와 같습니다. 접어 두기만 하면 답하지 않기로 한 사람에게 같은 설문이
    새로고침마다 다시 뜹니다 — 화면에는 두 단추가 나란히 있을 뿐이라 어느 쪽이 영영
    끝인지 알 길이 없습니다.
  */
  it('[×] 로 닫으면 그 추천은 다시 묻지 않는다', async () => {
    const { unmount } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(usePendingFeedbackStore.getState().pending).toBeNull()
    expect(usePendingFeedbackStore.getState().settled).toContain(TOKEN)

    // 새로고침한 것과 같습니다 — 화면은 새로 서지만 스토어는 그대로입니다
    unmount()
    renderModal()

    expect(screen.queryByText(`‘${QUERY}’`)).not.toBeInTheDocument()
  })

  // 메인은 돌아올 때마다 3D 가 처음부터 다시 뜹니다. 그 커튼 위에 설문을 올리면
  // 바다를 보기도 전에 답부터 묻게 됩니다
  it('화면이 준비되기 전에는 묻지 않는다', () => {
    renderModal(false)

    expect(screen.queryByText(`‘${QUERY}’`)).not.toBeInTheDocument()
  })
})
