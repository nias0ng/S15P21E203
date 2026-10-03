import { useTranslation } from 'react-i18next'

import { i18n } from '@/shared/i18n'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import { familyAdjective } from '../families'
import type { ScentFamilyKey, TasteMatch } from '../types'

type TasteResultModalProps = {
  match: TasteMatch | null
  onRetry: () => void
  onConfirm: () => void
  saving: boolean
  saveError: string | null
}

function headlineOf(match: TasteMatch): string {
  switch (match.mode) {
    case 'RARE':
      return i18n.t('taste:result.headline.rare')
    case 'PRIMARY_ONLY':
      return i18n.t('taste:result.headline.primaryOnly')
    default:
      return i18n.t('taste:result.headline.normal')
  }
}

/** 문장 가운데에 끼우는 형용사 — 영어는 타일의 첫 대문자를 내립니다(한국어는 그대로입니다) */
const inline = (key: ScentFamilyKey) => familyAdjective(key).toLowerCase()

function leadOf(match: TasteMatch): string {
  const [first, second] = match.picks

  if (match.mode === 'RARE') {
    return i18n.t('taste:result.lead.rare')
  }

  if (match.mode === 'PRIMARY_ONLY' && first && second) {
    return i18n.t('taste:result.lead.primaryOnly', {
      first: inline(first),
      second: inline(second),
    })
  }

  if (!first) return ''

  return second
    ? i18n.t('taste:result.lead.two', { first: inline(first) })
    : i18n.t('taste:result.lead.one', { first: inline(first) })
}

export function TasteResultModal({
  match,
  onRetry,
  onConfirm,
  saving,
  saveError,
}: TasteResultModalProps) {
  // 문구를 부를 때 읽으므로, 언어를 바꾸면 이 판이 다시 그려져야 합니다
  const { t } = useTranslation('taste')
  if (!match) return null

  return (
    <Modal
      open
      onClose={onRetry}
      title={headlineOf(match)}
      footer={
        <>
          <Button variant="outline" onClick={onRetry} disabled={saving}>
            {t('result.retry')}
          </Button>
          <Button onClick={onConfirm} isLoading={saving}>
            {saveError === null ? t('result.confirm') : t('result.retrySave')}
          </Button>
        </>
      }
    >
      <p className="text-ink">{leadOf(match)}</p>
      <p className="text-ink-muted mt-4">{t('result.closing')}</p>
      {saveError !== null && (
        <p role="alert" className="text-danger mt-4">
          {saveError}
        </p>
      )}
    </Modal>
  )
}
