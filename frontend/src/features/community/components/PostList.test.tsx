import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

import type { BoardItem } from '../types'

import { PostList } from './PostList'

const item: BoardItem = {
  id: 1,
  to: '/community/free/1',
  title: '여름에 뿌릴 시트러스',
  nickname: '향해테스터',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  perfume: null,
  category: 'CHAT',
  content: null,
  likeCount: 1,
  liked: false,
  viewCount: 12,
  commentCount: 3,
}

const renderList = (items: BoardItem[]) =>
  render(
    <MemoryRouter>
      <PostList
        items={items}
        isPending={false}
        emptyAction={null}
        onToggleLike={() => {}}
      />
    </MemoryRouter>,
  )

const toEnglish = async () => {
  await act(async () => {
    useLocaleStore.getState().setLocale('en')
    await i18n.changeLanguage('en')
  })
}

describe('PostList', () => {
  it('한국어 화면은 분류 · 수치를 한국어로 적는다', () => {
    renderList([item])

    expect(screen.getByText('잡담')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '좋아요 1' })).toBeInTheDocument()
    expect(screen.getByText('댓글 3')).toBeInTheDocument()
    expect(screen.getByText('조회 12')).toBeInTheDocument()
  })

  it('영어 화면은 분류 · 수치를 영어로 적고, 사용자가 쓴 제목은 그대로 둔다', async () => {
    await toEnglish()
    renderList([item])

    expect(screen.getByText('Chit-chat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 like' })).toBeInTheDocument()
    expect(screen.getByText('3 comments')).toBeInTheDocument()
    expect(screen.getByText('12 views')).toBeInTheDocument()
    expect(screen.getByText('여름에 뿌릴 시트러스')).toBeInTheDocument()
  })

  describe('걸린 향수 — 서버가 원래 이름과 한국어 이름을 짝으로 준다', () => {
    const perfume = {
      perfumeId: 7,
      name: 'Bleu de Chanel',
      nameKo: '블루 드 샤넬',
      brand: 'Chanel',
      brandKo: '샤넬',
    }
    const withPerfume: BoardItem = { ...item, perfume }

    it('한국어 화면은 한국어 이름 · 브랜드를 쓴다', () => {
      renderList([withPerfume])

      expect(screen.getByText('블루 드 샤넬')).toBeInTheDocument()
      expect(screen.getByText('샤넬')).toBeInTheDocument()
      expect(screen.queryByText('Bleu de Chanel')).not.toBeInTheDocument()
    })

    it('한국어 이름이 없으면 한국어 화면도 원래 이름을 쓴다', () => {
      renderList([
        {
          ...withPerfume,
          perfume: { ...perfume, nameKo: null, brandKo: null },
        },
      ])

      expect(screen.getByText('Bleu de Chanel')).toBeInTheDocument()
      expect(screen.getByText('Chanel')).toBeInTheDocument()
    })

    it('영어 화면은 원래 이름 · 브랜드를 쓴다', async () => {
      await toEnglish()
      renderList([withPerfume])

      expect(screen.getByText('Bleu de Chanel')).toBeInTheDocument()
      expect(screen.getByText('Chanel')).toBeInTheDocument()
      expect(screen.queryByText('블루 드 샤넬')).not.toBeInTheDocument()
    })
  })

  it('영어 화면의 빈 게시판 안내도 영어다', async () => {
    await toEnglish()
    renderList([])

    expect(screen.getByText('No posts on this board yet')).toBeInTheDocument()
  })
})
