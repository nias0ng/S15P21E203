import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Thumbnail } from './Thumbnail'

describe('Thumbnail', () => {
  it('src 가 있으면 이미지를 그린다', () => {
    render(<Thumbnail src="https://example.test/a.png" alt="샤넬 No.5" />)

    expect(screen.getByRole('img', { name: '샤넬 No.5' })).toHaveAttribute(
      'src',
      'https://example.test/a.png',
    )
  })

  it('src 가 없으면 자리표시자 문구를 보여준다', () => {
    render(<Thumbnail fallback="이미지" />)

    expect(screen.getByText('이미지')).toBeInTheDocument()
    // 이미지가 없으니 img 역할이 있으면 안 됩니다
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('src 가 null 이어도 자리표시자를 그린다', () => {
    // 백엔드가 이미지 없는 향수에 null 을 내려주는 경우입니다
    render(<Thumbnail src={null} fallback="이미지" />)

    expect(screen.getByText('이미지')).toBeInTheDocument()
  })

  it('fallback 문구가 없으면 빈 상자만 그린다', () => {
    const { container } = render(<Thumbnail className="size-6" />)

    expect(container.textContent).toBe('')
  })

  it('alt 를 주지 않으면 낭독기가 건너뛰는 장식 이미지가 된다', () => {
    // alt="" 인 img 는 role 이 presentation 이라 getByRole('img') 로 잡히지 않습니다.
    // 호출부 대부분이 이미지 옆에 이름을 글자로 두고 있어 이게 의도된 기본값입니다.
    render(<Thumbnail src="https://example.test/a.png" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('fit="contain" 이면 object-contain 을 쓴다', () => {
    const { container } = render(
      <Thumbnail src="https://example.test/logo.png" fit="contain" />,
    )

    const image = container.querySelector('img')
    expect(image?.className).toContain('object-contain')
    expect(image?.className).not.toContain('object-cover')
  })

  it('className 으로 크기를 지정한다', () => {
    const { container } = render(
      <Thumbnail src="https://example.test/a.png" className="size-14" />,
    )

    expect(container.querySelector('img')?.className).toContain('size-14')
  })

  /*
    배경이 투명한 PNG(향수병)를 넣는 자리용입니다. 상자를 그대로 두면 투명한 영역이
    네모로 드러나 병이 상자에 담긴 것처럼 보입니다.
  */
  it('bare 면 이미지 뒤 상자를 그리지 않는다', () => {
    const { container } = render(
      <Thumbnail src="https://example.test/bottle.png" bare />,
    )

    const image = container.querySelector('img')
    expect(image?.className).not.toContain('bg-surface-sunken')
    expect(image?.className).not.toContain('border-line')
  })

  /* 자리표시자까지 상자를 지우면 "이미지" 라는 글자만 허공에 뜹니다 */
  it('bare 여도 이미지가 없으면 자리표시자 상자는 그대로 그린다', () => {
    const { container } = render(<Thumbnail bare fallback="이미지" />)

    const box = container.firstElementChild
    expect(box?.className).toContain('bg-surface-sunken')
    expect(screen.getByText('이미지')).toBeInTheDocument()
  })

  it('자리표시자에도 className 이 적용된다', () => {
    const { container } = render(<Thumbnail className="size-20 rounded-full" />)

    const box = container.firstElementChild
    expect(box?.className).toContain('size-20')
    expect(box?.className).toContain('rounded-full')
  })
})
