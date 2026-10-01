import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'
import { GLASS_PANEL } from '@/shared/ui/panel'

type Props = {
  title: string
  description: string
  cancelTo: string
  submitLabel: string
  submitDisabled: boolean
  onSubmit: () => void
  children: React.ReactNode
}

export function WriteForm({
  title,
  description,
  cancelTo,
  submitLabel,
  submitDisabled,
  onSubmit,
  children,
}: Props) {
  const { t } = useTranslation('community')

  return (
    <div className="space-y-6.25">
      <header className="space-y-2.5">
        <h1 className="text-ink text-display font-serif font-bold">{title}</h1>
        <p className="text-ink-muted text-body">{description}</p>
      </header>

      <form
        className={cn(GLASS_PANEL, 'space-y-6.25')}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}

        <div className="border-line flex justify-end gap-2.5 border-t pt-6.25">
          <LinkButton to={cancelTo} variant="outline">
            {t('writeForm.cancel')}
          </LinkButton>
          <Button type="submit" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}
