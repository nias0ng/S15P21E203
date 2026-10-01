import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/shared/api/http'
import { cn } from '@/shared/lib/cn'
import { useCausticsStore } from '@/shared/store/causticsStore'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { GLASS_PANEL } from '@/shared/ui/panel'
import { Skeleton } from '@/shared/ui/Skeleton'

import { completeTasteTest } from '../api'
import { MAX_PICKS } from '../families'
import { matchStartingPoint } from '../match'
import { scentVectorsQuery, tasteKeys } from '../queries'
import type { ScentFamilyKey, TasteMatch } from '../types'

import { FamilyPicker } from './FamilyPicker'
import { TasteResultModal } from './TasteResultModal'

type TasteTestStepProps = {
  onComplete: (landed: boolean) => void
}

export function TasteTestStep({ onComplete }: TasteTestStepProps) {
  const { t } = useTranslation('taste')
  const vectors = useQuery(scentVectorsQuery())
  const queryClient = useQueryClient()

  const [picks, setPicks] = useState<ScentFamilyKey[]>([])
  const [match, setMatch] = useState<TasteMatch | null>(null)

  const setCausticsLayers = useCausticsStore((state) => state.setLayers)
  useEffect(() => {
    setCausticsLayers(picks.length)
  }, [picks.length, setCausticsLayers])
  useEffect(() => () => setCausticsLayers(null), [setCausticsLayers])

  const handleSubmit = () => {
    if (!vectors.data || picks.length === 0) return
    setMatch(matchStartingPoint(vectors.data, picks))
  }

  /**
   * NOTE: 이미 마친 사람은 409 인데 **넘어가는 것은** 성공으로 다룹니다
   * 막으면 주소로 다시 들어온 사람이 아무 데도 못 갑니다.
   * 저장한 기록은 로그인 화면이 보도록 캐시에 넣습니다.
   *
   * NOTE: 다만 `landed` 는 409 는 배를 놓은 것까지 되돌아가므로 false 입니다.
   */
  const save = useMutation({
    mutationFn: (result: TasteMatch) =>
      completeTasteTest({
        picks: result.picks,
        matchedPerfumeId: result.perfumeId,
      }),
    onSuccess: (record) => {
      queryClient.setQueryData(tasteKeys.mine(), record)
      onComplete(true)
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: tasteKeys.mine() })
        onComplete(false)
      }
    },
  })

  const saveError =
    save.isError && !(isApiError(save.error) && save.error.status === 409)
      ? t('step.saveFailed')
      : null

  return (
    <div className="space-y-8">
      <header className="space-y-3 break-keep">
        <p className="text-ink-muted text-caption">{t('step.kicker')}</p>
        <h1 className="text-display font-serif font-semibold">
          {t('step.title')}
        </h1>
        <p className="text-ink-muted text-body">{t('step.lead')}</p>
      </header>

      {vectors.isPending && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-18" />
          ))}
        </div>
      )}

      {vectors.isError && (
        <EmptyState
          title={t('step.loadFailedTitle')}
          description={t('step.loadFailedDescription')}
          onRetry={() => vectors.refetch()}
        />
      )}

      {vectors.isSuccess && (
        <section className={cn(GLASS_PANEL, 'rounded-card space-y-8')}>
          <FamilyPicker value={picks} onChange={setPicks} />

          <div className="border-line-soft flex items-center justify-between gap-6 border-t pt-6">
            <p
              className="text-caption text-ink font-medium tabular-nums"
              aria-live="polite"
            >
              <span className="sr-only">{t('step.picked')}</span>
              {picks.length} / {MAX_PICKS}
            </p>
            <Button
              size="lg"
              disabled={picks.length === 0}
              onClick={handleSubmit}
            >
              {t('step.submit')}
            </Button>
          </div>
        </section>
      )}

      <TasteResultModal
        match={match}
        onRetry={() => {
          if (save.isPending) return
          save.reset()
          setMatch(null)
        }}
        onConfirm={() => match && save.mutate(match)}
        saving={save.isPending}
        saveError={saveError}
      />
    </div>
  )
}
