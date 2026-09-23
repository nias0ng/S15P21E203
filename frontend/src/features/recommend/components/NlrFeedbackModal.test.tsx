import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
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

  /*
    설문은 한 번 닫으면 그 추천으로 다시 열리지 않습니다. 적던 한마디를 잘못 눌러 잃으면
    되찾을 길이 없어, 닫기 전에 한 번 묻습니다.
  */
  describe('적던 한마디가 있을 때', () => {
    const 한마디를적는다 = async (text = '무화과가 좋았어요') => {
      await userEvent.type(screen.getByLabelText(/한마디/), text)
    }
    const 나가기묻는창 = () =>
      screen.queryByRole('heading', {
        name: '추천에 대한 후기를 남기지 않고 나가시겠습니까?',
      })

    it('[×] 가 바로 닫지 않고 먼저 묻는다', async () => {
      renderModal()
      await 한마디를적는다()

      await userEvent.click(screen.getByRole('button', { name: '닫기' }))

      expect(나가기묻는창()).toBeInTheDocument()
      // 아직 끝난 것이 아닙니다 — 취소하면 적던 자리로 돌아가야 합니다
      expect(usePendingFeedbackStore.getState().pending).not.toBeNull()
    })

    /*
      Esc 는 [×] 와 같은 길로 옵니다(`Modal` 의 onClose). 글을 적다 글쇠를 잘못 누르는 쪽이
      오히려 흔해서, 이쪽도 물어야 합니다. jsdom 폴리필은 글쇠를 안 받으므로 `<dialog>` 의
      `cancel` 을 바로 보냅니다.
    */
    it('Esc 도 바로 닫지 않고 먼저 묻는다', async () => {
      renderModal()
      await 한마디를적는다()

      const dialog = screen
        .getByRole('heading', { name: '추천은 어떠셨나요' })
        .closest('dialog')!
      fireEvent(dialog, new Event('cancel', { cancelable: true }))

      expect(나가기묻는창()).toBeInTheDocument()
      expect(usePendingFeedbackStore.getState().pending).not.toBeNull()
    })

    it('[취소] 면 설문이 그대로 남는다', async () => {
      renderModal()
      await 한마디를적는다()
      await userEvent.click(screen.getByRole('button', { name: '닫기' }))

      await userEvent.click(screen.getByRole('button', { name: '취소' }))

      expect(나가기묻는창()).not.toBeInTheDocument()
      expect(usePendingFeedbackStore.getState().pending).not.toBeNull()
      expect(screen.getByLabelText(/한마디/)).toHaveValue('무화과가 좋았어요')
    })

    it('[나가기] 면 그때 끝난다', async () => {
      renderModal()
      await 한마디를적는다()
      await userEvent.click(screen.getByRole('button', { name: '닫기' }))

      await userEvent.click(screen.getByRole('button', { name: '나가기' }))

      expect(usePendingFeedbackStore.getState().pending).toBeNull()
      expect(usePendingFeedbackStore.getState().settled).toContain(TOKEN)
    })

    /*
      이름이 이미 "건너뛰기" 라 고른 답입니다. 거기에 또 물으면 단추가 거짓말이 됩니다.
    */
    it('[건너뛰기] 는 되묻지 않고 바로 끝낸다', async () => {
      renderModal()
      await 한마디를적는다()

      await userEvent.click(screen.getByRole('button', { name: '건너뛰기' }))

      expect(나가기묻는창()).not.toBeInTheDocument()
      expect(usePendingFeedbackStore.getState().pending).toBeNull()
    })

    // 공백만 친 것은 적은 것이 아닙니다 — 그것까지 붙잡으면 물음이 성가신 것이 됩니다
    it('공백만 쳤으면 묻지 않고 닫는다', async () => {
      renderModal()
      await 한마디를적는다('   ')

      await userEvent.click(screen.getByRole('button', { name: '닫기' }))

      expect(나가기묻는창()).not.toBeInTheDocument()
      expect(usePendingFeedbackStore.getState().pending).toBeNull()
    })
  })
})
