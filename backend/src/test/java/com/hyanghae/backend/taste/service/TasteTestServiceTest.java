package com.hyanghae.backend.taste.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.repository.ExplorationPoint;
import com.hyanghae.backend.map.service.ExplorationService;
import com.hyanghae.backend.taste.dto.request.TasteTestCreateRequest;
import com.hyanghae.backend.taste.dto.response.TasteTestResponse;
import com.hyanghae.backend.taste.exception.TasteErrorCode;
import com.hyanghae.backend.taste.repository.TasteTestRepository;
import com.hyanghae.backend.taste.repository.TasteTestRepository.InsertedTest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * 배를 띄우지 못했을 때 응시를 남기지 않는지 경계에서 바로 확인합니다.
 *
 * <p>통합 테스트가 좌표 없는 향수·없는 번호·내려간 향수 셋을 이미 끝에서 끝까지 검증합니다.
 * 여기서 따로 보는 것은 <b>그 셋을 묶는 규칙</b>입니다. 서비스가 보는 것은 "왜" 가 아니라
 * {@link ExplorationService#placeStartingPoint} 가 비어 있다는 사실 하나뿐이고, 비면 언제나
 * {@code TASTE_PERFUME_NOT_ON_MAP} 여야 합니다. 지도 조회에 조건이 하나 더 붙는 날에도 그
 * 경우가 어떤 답을 받을지 여기서 정해집니다.
 *
 * <p>상태가 남지 않는 것까지 봅니다. 응시를 먼저 넣고 배를 나중에 띄웠다면 배를 못 띄운 회원에게
 * 기록만 남아, 다시 치르지도 못하고 배도 뜨지 않는 자리에 갇힙니다. 통합 테스트는 트랜잭션이
 * 되돌린 결과를 보지만 여기서는 <b>애초에 부르지 않는지</b>를 봅니다. 트랜잭션이 사라져도 순서가
 * 지켜지는지는 이쪽이 알려줍니다.
 */
class TasteTestServiceTest {

    private static final long USER_ID = 1;
    private static final long PERFUME_ID = 42;

    private final TasteTestRepository tasteTestRepository = mock(TasteTestRepository.class);
    private final ExplorationService explorationService = mock(ExplorationService.class);
    private final CurrentUser currentUser = () -> Optional.of(USER_ID);
    private final TasteTestService service =
            new TasteTestService(tasteTestRepository, explorationService, currentUser);

    /**
     * 배를 띄우지 못하면 {@code TASTE_PERFUME_NOT_ON_MAP} 이고 <b>응시가 남지 않습니다.</b>
     *
     * <p>비어 있는 이유는 묻지 않습니다. 좌표가 없어서든, 내려간 향수라서든, 아예 없는 번호라서든
     * 화면이 받은 후보 밖의 값을 보낸 것이라 답이 같아야 합니다.
     */
    @Test
    void refusesAndSavesNothingWhenShipCannotBePlaced() {
        // 고른 계열 둘이 모두 번호로 풀립니다. 여기서 모자라면 계열 검증에서 먼저 걸려
        // 배를 못 띄운 경우를 보지 못합니다.
        when(tasteTestRepository.findScentRegionIds(anyList())).thenReturn(List.of(3L, 1L));
        when(explorationService.placeStartingPoint(USER_ID, PERFUME_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.complete(request()))
                .isInstanceOf(BusinessException.class)
                .extracting(thrown -> ((BusinessException) thrown).errorCode())
                .isEqualTo(TasteErrorCode.TASTE_PERFUME_NOT_ON_MAP);

        verify(tasteTestRepository, never()).insert(anyLong(), anyLong());
        verify(tasteTestRepository, never()).insertSelections(anyLong(), anyList());
    }

    /**
     * 배를 띄웠으면 응시가 남고 그 자리가 응답에 실립니다.
     *
     * <p>짝이 되는 경우입니다. 이것이 없으면 위의 검증이 "원래 부르지 않는 코드" 를 확인한 것인지
     * 구분할 수 없습니다.
     */
    @Test
    void savesAndAnswersWithTheStartingPoint() {
        OffsetDateTime completedAt = OffsetDateTime.now();
        when(tasteTestRepository.findScentRegionIds(anyList())).thenReturn(List.of(3L, 1L));
        when(explorationService.placeStartingPoint(USER_ID, PERFUME_ID))
                .thenReturn(Optional.of(new ExplorationPoint(0.09163, 0.04484)));
        when(tasteTestRepository.insert(USER_ID, PERFUME_ID))
                .thenReturn(new InsertedTest(7L, completedAt));

        TasteTestResponse response = service.complete(request());

        assertThat(response.completed()).isTrue();
        assertThat(response.picks()).containsExactly("WOODY", "FLORAL");
        assertThat(response.matchedPerfumeId()).isEqualTo(PERFUME_ID);
        assertThat(response.x()).isEqualTo(0.09163);
        assertThat(response.y()).isEqualTo(0.04484);
        assertThat(response.completedAt()).isEqualTo(completedAt);

        verify(tasteTestRepository).insertSelections(7L, List.of(3L, 1L));
    }

    /**
     * 고른 계열을 확인하기 전에는 배를 건드리지 않습니다.
     *
     * <p>순서가 뒤집히면 요청이 400 으로 끝나는데도 배가 옮겨져 있습니다.
     */
    @Test
    void doesNotTouchTheShipWhenPicksAreRejected() {
        assertThatThrownBy(() -> service.complete(
                new TasteTestCreateRequest(List.of("FLORAL", "WOODY", "CITRUS"), PERFUME_ID)))
                .isInstanceOf(BusinessException.class);

        verify(explorationService, never()).placeStartingPoint(anyLong(), any());
    }

    private TasteTestCreateRequest request() {
        return new TasteTestCreateRequest(List.of("WOODY", "FLORAL"), PERFUME_ID);
    }
}
