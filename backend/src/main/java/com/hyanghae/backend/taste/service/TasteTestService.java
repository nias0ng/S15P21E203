package com.hyanghae.backend.taste.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.repository.ExplorationPoint;
import com.hyanghae.backend.map.service.ExplorationService;
import com.hyanghae.backend.taste.dto.request.TasteTestCreateRequest;
import com.hyanghae.backend.taste.dto.response.TasteTestResponse;
import com.hyanghae.backend.taste.exception.TasteErrorCode;
import com.hyanghae.backend.taste.repository.TasteTestRepository;
import com.hyanghae.backend.taste.repository.TasteTestRepository.InsertedTest;
import java.util.HashSet;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 취향 테스트를 저장하고 읽습니다.
 *
 * <p>회원가입 뒤 첫 로그인에 한 번만 치릅니다. 고른 향 계열을 남기고, 결과 향수 자리에 배를
 * 처음 띄웁니다.
 *
 * <p>로그인이 필요합니다. 기록이 사용자에게 매달려 있고, 비회원은 애초에 치르지 않습니다.
 *
 * <p><b>결과 향수를 서버가 다시 계산하지 않습니다.</b> 코사인 유사도 계산이 화면에 있고 테스트도
 * 거기 붙어 있습니다. 같은 규칙을 자바로 한 벌 더 두면 두 결과가 갈렸을 때 어느 쪽이 맞는지
 * 판단할 근거가 없습니다. 서버는 그 향수가 지도에 있는지만 봅니다.
 */
@Service
public class TasteTestService {

    /** 화면이 한 개만 고르는 것을 허용합니다. 그때는 그 계열에 1.0 을 줍니다. */
    private static final int MIN_PICKS = 1;

    /** 1순위와 2순위까지입니다. 화면이 0.58 과 0.42 로 나눠 씁니다. */
    private static final int MAX_PICKS = 2;

    private final TasteTestRepository tasteTestRepository;
    private final ExplorationService explorationService;
    private final CurrentUser currentUser;

    public TasteTestService(
            TasteTestRepository tasteTestRepository,
            ExplorationService explorationService,
            CurrentUser currentUser) {
        this.tasteTestRepository = tasteTestRepository;
        this.explorationService = explorationService;
        this.currentUser = currentUser;
    }

    /**
     * 테스트를 마쳤다고 남기고 배를 처음 띄웁니다.
     *
     * <p>이미 마친 회원은 409 입니다. 덮어쓰지 않는 이유는 한 번만 치른다는 약속 때문입니다.
     * 덮어쓰면 배를 처음 띄운 자리가 사라져 무엇을 근거로 거기 있었는지 알 수 없게 됩니다.
     *
     * <p>먼저 세어 보고 넣지 않습니다. 두 요청이 거의 같은 순간에 들어오면 둘 다 "아직 안 했다"
     * 를 보고 지나갑니다. 그냥 넣고 {@code uk_user_taste_tests_user} 에 걸리는 쪽을 409 로
     * 돌립니다.
     *
     * <p>배를 먼저 띄우고 기록을 넣습니다. 순서가 뒤집혀 보이지만 한 트랜잭션이라, 409 로 끝나는
     * 요청은 배를 띄운 것까지 함께 되돌아갑니다. 이 순서라야 지도에 없는 향수를 400 으로 답할 수
     * 있습니다 — 기록을 먼저 넣으면 외래키가 먼저 걸려 무엇이 잘못됐는지 알려주지 못합니다.
     */
    @Transactional
    public TasteTestResponse complete(TasteTestCreateRequest request) {
        Long userId = currentUserId();
        List<String> picks = validatePicks(request.picks());
        List<Long> scentRegionIds = tasteTestRepository.findScentRegionIds(picks);

        if (scentRegionIds.size() != picks.size()) {
            throw new BusinessException(TasteErrorCode.TASTE_UNKNOWN_SCENT_REGION);
        }

        ExplorationPoint start =
                explorationService.placeStartingPoint(userId, request.matchedPerfumeId())
                        .orElseThrow(() -> new BusinessException(
                                TasteErrorCode.TASTE_PERFUME_NOT_ON_MAP));

        InsertedTest inserted = insertOrConflict(userId, request.matchedPerfumeId());
        tasteTestRepository.insertSelections(inserted.userTestId(), scentRegionIds);

        return new TasteTestResponse(
                true,
                picks,
                request.matchedPerfumeId(),
                start.x(),
                start.y(),
                inserted.completedAt());
    }

    /**
     * 내 취향 테스트 기록입니다.
     *
     * <p>화면이 온보딩을 띄울지 판단하는 데 씁니다. 아직 치르지 않았으면 {@code completed} 가
     * {@code false} 인 200 입니다.
     */
    @Transactional(readOnly = true)
    public TasteTestResponse findMine() {
        return tasteTestRepository.find(currentUserId())
                .map(row -> new TasteTestResponse(
                        true,
                        row.picks(),
                        row.matchedPerfumeId(),
                        row.x(),
                        row.y(),
                        row.completedAt()))
                .orElseGet(TasteTestResponse::notCompleted);
    }

    private InsertedTest insertOrConflict(Long userId, Long matchedPerfumeId) {
        try {
            return tasteTestRepository.insert(userId, matchedPerfumeId);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(TasteErrorCode.TASTE_ALREADY_COMPLETED);
        }
    }

    /**
     * 고른 계열이 쓸 수 있는 값인지 봅니다.
     *
     * <p>같은 계열을 1순위와 2순위로 겹쳐 고르면 막습니다. 표의 기본키도 같은 것을 막지만, 여기서
     * 걸러야 무엇이 잘못됐는지 알려줄 수 있습니다.
     *
     * <p>계열 코드가 실제로 있는지는 여기서 보지 않습니다. 그것은 표에 물어봐야 알 수 있습니다.
     */
    private List<String> validatePicks(List<String> picks) {
        if (picks == null || picks.size() < MIN_PICKS || picks.size() > MAX_PICKS) {
            throw new BusinessException(TasteErrorCode.TASTE_PICKS_REQUIRED);
        }
        if (picks.stream().anyMatch(pick -> pick == null || pick.isBlank())) {
            throw new BusinessException(TasteErrorCode.TASTE_PICKS_REQUIRED);
        }
        if (new HashSet<>(picks).size() != picks.size()) {
            throw new BusinessException(TasteErrorCode.TASTE_PICKS_DUPLICATED);
        }
        return List.copyOf(picks);
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(TasteErrorCode.TASTE_LOGIN_REQUIRED));
    }
}
