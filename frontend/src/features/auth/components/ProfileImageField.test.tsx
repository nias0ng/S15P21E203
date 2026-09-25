import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/http'

import { ProfileImageField } from './ProfileImageField'

const api = vi.hoisted(() => ({
  uploadProfileImage: vi.fn(),
  removeProfileImage: vi.fn(),
}))

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...api }
})

const UPLOADED = '/api/v1/users/profile-images/2026/09/a.jpg'

function Harness({ initial = null }: { initial?: string | null }) {
  const [url, setUrl] = useState<string | null>(initial)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ProfileImageField value={url} onChange={setUrl} />
      <p>{`알린 주소: ${url ?? '없음'}`}</p>
    </QueryClientProvider>
  )
}

const file = (name = '얼굴.jpg') =>
  new File(['사진'], name, { type: 'image/jpeg' })

const pick = (f: File) =>
  userEvent.upload(screen.getByLabelText('프로필 사진 고르기'), f)

beforeEach(() => {
  api.uploadProfileImage.mockResolvedValue(UPLOADED)
  api.removeProfileImage.mockResolvedValue(undefined)
})

afterEach(() => vi.clearAllMocks())

describe('ProfileImageField', () => {
  it('고른 사진을 올리고 그 주소를 알린다', async () => {
    render(<Harness />)

    await pick(file())

    expect(
      await screen.findByText(`알린 주소: ${UPLOADED}`),
    ).toBeInTheDocument()
    expect(api.uploadProfileImage).toHaveBeenCalledOnce()
    expect(api.uploadProfileImage.mock.calls[0]?.[0]).toHaveProperty(
      'name',
      '얼굴.jpg',
    )
  })

  it('사진을 지우면 null 을 알린다', async () => {
    render(<Harness initial={UPLOADED} />)

    await userEvent.click(screen.getByRole('button', { name: '이미지 삭제' }))

    expect(await screen.findByText('알린 주소: 없음')).toBeInTheDocument()
    expect(api.removeProfileImage).toHaveBeenCalledOnce()
  })

  it('사진이 없으면 삭제를 누를 수 없다', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: '이미지 삭제' })).toBeDisabled()
  })

  it('서버가 거절하면 그 사정을 보여준다', async () => {
    api.uploadProfileImage.mockRejectedValue(
      new ApiError(413, 'TOO_LARGE', '이미지 크기 제한을 넘었습니다.'),
    )
    render(<Harness />)

    await pick(file())

    expect(
      await screen.findByText('이미지 크기 제한을 넘었습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByText('알린 주소: 없음')).toBeInTheDocument()
  })
})
