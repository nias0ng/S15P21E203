import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { useLocaleStore } from '@/shared/store/localeStore'

import type { Note } from '../types'

import { NoteCategorySections } from './NoteCategorySections'

const note = (
  partial: Partial<Note> & Pick<Note, 'noteId' | 'name'>,
): Note => ({
  nameKo: null,
  accordFamily: 'CITRUS',
  imageUrl: null,
  popularityRank: null,
  ...partial,
})

const NOTES: Note[] = [
  note({ noteId: 1, name: 'Bergamot', nameKo: '베르가못' }),
  note({ noteId: 2, name: 'Lemon', nameKo: '레몬' }),
  note({ noteId: 3, name: 'Musk', nameKo: '머스크', accordFamily: 'MUSK' }),
  note({ noteId: 4, name: 'Vetiver', accordFamily: null }),
]

const renderSections = (notes: Note[]) =>
  render(
    <MemoryRouter>
      <NoteCategorySections notes={notes} />
    </MemoryRouter>,
  )

describe('NoteCategorySections', () => {
  it('받은 순서대로 대분류가 바뀌는 자리에서 섹션을 끊는다', () => {
    renderSections(NOTES)

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    expect(headings).toEqual(['CITRUS', 'MUSK', '기타'])
  })

  it('처음 보는 대분류도 그대로 그린다', () => {
    renderSections([
      note({ noteId: 9, name: 'Ambergris', accordFamily: 'ANIMAL' }),
    ])

    expect(screen.getByRole('heading', { name: 'ANIMAL' })).toBeInTheDocument()
    expect(screen.getByText('Ambergris')).toBeInTheDocument()
  })

  it('영문 이름을 크게, 한국어 이름을 그 아래 적는다', () => {
    renderSections([NOTES[0]!])

    expect(screen.getByText('Bergamot')).toBeInTheDocument()
    expect(screen.getByText('베르가못')).toBeInTheDocument()
  })

  it('노트가 없으면 안내를 보여준다', () => {
    renderSections([])

    expect(screen.getByText('노트를 찾지 못했습니다')).toBeInTheDocument()
  })
})

describe('NoteCategorySections (영어 화면)', () => {
  it('원래 이름만 적고 대분류 없는 묶음은 Other 로 부른다', async () => {
    useLocaleStore.getState().setLocale('en')
    await i18n.changeLanguage('en')

    renderSections(NOTES)

    expect(screen.getByText('Bergamot')).toBeInTheDocument()
    expect(screen.queryByText('베르가못')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Other' })).toBeInTheDocument()
    expect(screen.getByText('2 notes')).toBeInTheDocument()
  })
})
