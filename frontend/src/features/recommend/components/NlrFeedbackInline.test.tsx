import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { useAnsweredFeedbackStore } from '../answeredFeedbackStore'
import { FEEDBACK_COMMENT_MAX } from '../types'

import { NlrFeedbackInline } from './NlrFeedbackInline'

const api = vi.hoisted(() => ({ sendRecommendFeedback: vi.fn() }))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const TOKEN = 'b7f3a1e8-4c2d-4f1a-9e3b-2a5c8d7e6f40'

const renderInline = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <NlrFeedbackInline token={TOKEN} />
    </QueryClientProvider>,
  )

beforeEach(() => {
  api.sendRecommendFeedback.mockReset()
  useAnsweredFeedbackStore.setState({ answered: [] })
})

describe('NlrFeedbackInline', () => {
  // 답하지 않을 사람에게 빈 칸을 펼쳐 두면 결과보다 설문이 커 보입니다
  it('고르기 전에는 한마디 칸과 [보내기]를 접어 둔다', () => {
    renderInline()

    expect(screen.getByText('이 추천은 어떠셨나요?')).toBeInTheDocument()
    expect(screen.queryByLabelText('한마디 (선택)')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '보내기' }),
    ).not.toBeInTheDocument()
  })

  it('고르고 보내면 만족도와 한마디를 함께 보내고 고맙다고 한다', async () => {
    api.sendRecommendFeedback.mockResolvedValue(undefined)
    renderInline()

    await userEvent.click(screen.getByRole('button', { name: '아쉬워요' }))
    await userEvent.type(screen.getByLabelText('한마디 (선택)'), '너무 달아요')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))

    expect(api.sendRecommendFeedback).toHaveBeenCalledWith(TOKEN, {
      satisfaction: 'DISSATISFIED',
      comment: '너무 달아요',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('고맙습니다')
    expect(useAnsweredFeedbackStore.getState().answered).toContain(TOKEN)
  })

  // 빈 문자열을 보내면 "한마디를 썼는데 비어 있는" 줄이 쌓입니다
  it('한마디가 비었으면 만족도만 보낸다', async () => {
    api.sendRecommendFeedback.mockResolvedValue(undefined)
    renderInline()

    await userEvent.click(screen.getByRole('button', { name: '마음에 들어요' }))
    await userEvent.type(screen.getByLabelText('한마디 (선택)'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))

    expect(api.sendRecommendFeedback).toHaveBeenCalledWith(TOKEN, {
      satisfaction: 'SATISFIED',
      comment: undefined,
    })
  })

  // 409 는 이미 남겼다는 뜻이라 실패가 아닙니다
  it('이미 남긴 추천(409)이면 답한 것으로 본다', async () => {
    api.sendRecommendFeedback.mockRejectedValue(
      new ApiError(409, 'FEEDBACK_ALREADY_SUBMITTED', '이미 남겼습니다'),
    )
    renderInline()

    await userEvent.click(screen.getByRole('button', { name: '보통이에요' }))
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))

    expect(await screen.findByRole('status')).toHaveTextContent('고맙습니다')
  })

  // 상세에 다녀와 같은 결과를 다시 펼쳐도 한 번 답한 것을 또 묻지 않습니다
  it('이미 답한 추천이면 묻지 않고 고맙다고만 한다', () => {
    useAnsweredFeedbackStore.setState({ answered: [TOKEN] })
    renderInline()

    expect(screen.getByRole('status')).toHaveTextContent('고맙습니다')
    expect(
      screen.queryByRole('group', { name: '추천 만족도' }),
    ).not.toBeInTheDocument()
  })

  it(`한마디가 ${FEEDBACK_COMMENT_MAX}자를 넘으면 보내지 않는다`, async () => {
    renderInline()

    await userEvent.click(screen.getByRole('button', { name: '마음에 들어요' }))
    const box = screen.getByLabelText('한마디 (선택)')
    await userEvent.click(box)
    await userEvent.paste('가'.repeat(FEEDBACK_COMMENT_MAX + 1))

    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    expect(
      screen.getByText(`${FEEDBACK_COMMENT_MAX}자까지 쓸 수 있습니다`),
    ).toBeInTheDocument()
  })
})
