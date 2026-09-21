import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { ImageAttachField } from './ImageAttachField'

const api = vi.hoisted(() => ({ uploadPostImage: vi.fn() }))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

/** 올린 주소를 글자로 드러냅니다 */
function Harness() {
  const [urls, setUrls] = useState<string[]>([])
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ImageAttachField value={urls} onChange={setUrls} />
      <p>{`알린 주소: ${urls.join(', ')}`}</p>
    </QueryClientProvider>
  )
}

const file = (name = '향수.jpg') =>
  new File(['사진'], name, { type: 'image/jpeg' })

const pick = (f: File) =>
  userEvent.upload(screen.getByLabelText('이미지 추가'), f)

beforeEach(() => {
  api.uploadPostImage.mockResolvedValue('/api/v1/posts/images/2026/09/a.jpg')
})

afterEach(() => vi.clearAllMocks())

describe('ImageAttachField', () => {
  it('고른 사진을 올리고 그 주소를 알린다', async () => {
    render(<Harness />)

    await pick(file())

    expect(
      await screen.findByText('알린 주소: /api/v1/posts/images/2026/09/a.jpg'),
    ).toBeInTheDocument()
    expect(api.uploadPostImage).toHaveBeenCalledOnce()
    // 고른 그 파일이 그대로 올라갔는지
    expect(api.uploadPostImage.mock.calls[0]?.[0]).toHaveProperty(
      'name',
      '향수.jpg',
    )
  })

  it('지우면 목록에서 빠진다', async () => {
    render(<Harness />)

    await pick(file())
    await screen.findByText('알린 주소: /api/v1/posts/images/2026/09/a.jpg')

    await userEvent.click(screen.getByRole('button', { name: /사진 1 지우기/ }))

    expect(screen.getByText('알린 주소:')).toBeInTheDocument()
  })

  /*
    형식 · 용량은 **서버가** 봅니다(415 · 413). 화면이 같은 규칙을 한 벌 더 들고
    있으면 서버가 설정을 바꾼 날 둘이 갈라집니다 — 그래서 서버 말을 그대로 옮깁니다.
  */
  it('서버가 거절하면 그 사정을 보여준다', async () => {
    api.uploadPostImage.mockRejectedValue(
      new ApiError(415, 'UNSUPPORTED', '이미지 파일만 올릴 수 있습니다.'),
    )
    render(<Harness />)

    await pick(file('메모.txt'))

    expect(
      await screen.findByText('이미지 파일만 올릴 수 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('알린 주소:')).toBeInTheDocument()
  })
})
