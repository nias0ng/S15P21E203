import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { mapKeys } from '@/features/map'
import { TasteTestStep } from '@/features/taste'
import { tasteLandingState } from '@/shared/config/mapEntryState'
import { ROUTES } from '@/shared/config/routes'

export default function TasteTestPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /**
   첫 테스트 마친 후 -> 서버가 결과 향수 좌표를 **배의 자리**로 둡니다
   (`TasteTestService.complete` → `ExplorationService.placeStartingPoint`).
   출발은 엔진당 한 번뿐이라(`ScentScene` 의 `started`) 뒤늦게 새 값이 와도 되돌리지 않습니다.

   NOTE: 무효화(`invalidateQueries`)로는 모자랍니다. 오래됐다고 표시할 뿐 캐시된 값을
   그대로 내주기 때문입니다. 지워야 메인이 받을 값이 없어 새로 읽습니다.

   ⚠️ **`landed` 일 때만 알립니다.** 이미 마친 사람(409)은 서버가 배를 놓은 것까지 같은 트랜잭션으로 되돌려 자리가 안 바뀝니다
   — 그때도 표를 실으면 **마지막 항해 자리에 착륙 연출이 걸려**, 결과 모달이 말한 향("1순위로 고르신 …에 맞춰 출발점을 잡았어요")과
     배가 실제로 서는곳이 어긋납니다. 그 경우는 평소처럼 조용히 그 자리에서 이어 갑니다.
  */
  const handleComplete = (landed: boolean) => {
    if (!landed) {
      navigate(ROUTES.HOME)
      return
    }
    queryClient.removeQueries({ queryKey: mapKeys.exploration() })
    navigate(ROUTES.HOME, { state: tasteLandingState() })
  }

  return <TasteTestStep onComplete={handleComplete} />
}
