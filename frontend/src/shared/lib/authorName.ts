import { i18n } from '@/shared/i18n'

export function authorName(nickname: string | null | undefined): string {
  return nickname ?? i18n.t('common:withdrawnMember')
}
