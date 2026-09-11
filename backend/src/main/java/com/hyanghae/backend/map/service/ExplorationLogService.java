package com.hyanghae.backend.map.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.dto.request.ExplorationLogCreateRequest;
import com.hyanghae.backend.map.dto.response.ExplorationLogCreateResponse;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.repository.ExplorationLogRepository;
import com.hyanghae.backend.map.repository.ExplorationPoint;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배가 움직인 자취를 남깁니다.
 *
 * <p>모든 클릭을 남기지 않고 향해 일지에 의미가 있는 것만 남깁니다. 향수를 고른 것과, 빈 바다를
 * 골라 향 영역이 바뀐 것 두 가지입니다. 같은 영역 안에서 바다를 여러 번 누른 것은 일지에 적을
 * 내용이 없어 남기지 않습니다.
 *
 * <p>영역은 좌표로 그때그때 판정합니다({@link ScentRegionLocator}). 기록에는 좌표만 남고 영역
 * 번호는 저장하지 않습니다. 지도의 모양과 향 영역이 고정이라 같은 좌표는 언제 읽어도 같은
 * 영역으로 판정됩니다.
 *
 * <p>기록은 사용자에게 매달리므로 로그인이 필요합니다. 인증이 아직 없어 지금은 모든 요청이
 * 401 이고, 로그인한 경우의 동작은 통합 테스트가 가짜 {@link CurrentUser} 로 검증합니다.
 */
@Service
public class ExplorationLogService {

    private final ExplorationLogRepository explorationLogRepository;
    private final ScentRegionLocator scentRegionLocator;
    private final CurrentUser currentUser;

    public ExplorationLogService(
            ExplorationLogRepository explorationLogRepository,
            ScentRegionLocator scentRegionLocator,
            CurrentUser currentUser
    ) {
        this.explorationLogRepository = explorationLogRepository;
        this.scentRegionLocator = scentRegionLocator;
        this.currentUser = currentUser;
    }

    /**
     * 배가 움직인 것을 기록합니다. 남길 것이 없으면 빈 {@link Optional} 입니다.
     *
     * <p>향수를 고른 이동은 언제나 남깁니다. 같은 향수를 다시 골라도 줄을 따로 쌓습니다. 일지는
     * 배가 지나온 자리를 적는 화면이라, 지난번에 본 향수를 다시 봤다면 두 번 나오는 것이 맞습니다.
     *
     * <p>빈 바다로 간 이동은 향 영역이 바뀐 경우에만 남깁니다. 영역 밖으로 나간 것도 바뀐 것으로
     * 봅니다. 그 줄은 일지에 구역으로 그릴 수 없지만, 다음에 어느 구역으로 들어갔는지 판단하는
     * 기준이 됩니다.
     *
     * <p>지도에 없는 향수는 404 입니다. 좌표가 없거나 비활성인 향수는 지도에 찍히지 않으니 그
     * 향수로 배를 옮길 수도 없습니다. 지도 조회 두 개와 같은 코드로 답합니다.
     */
    @Transactional
    public Optional<ExplorationLogCreateResponse> create(ExplorationLogCreateRequest request) {
        Long userId = currentUserId();

        if (request.isPerfumeVisit()) {
            return Optional.of(
                    explorationLogRepository.insertPerfumeVisit(userId, request.perfumeId())
                            .orElseThrow(() ->
                                    new BusinessException(MapErrorCode.MAP_PERFUME_NOT_FOUND))
            );
        }

        if (!request.hasCoordinate()) {
            throw new BusinessException(MapErrorCode.MAP_EXPLORATION_POINT_REQUIRED);
        }

        return recordSeaMove(userId, request.x(), request.y());
    }

    private Optional<ExplorationLogCreateResponse> recordSeaMove(Long userId, double x, double y) {
        Long movedInto = scentRegionLocator.regionIdAt(x, y).orElse(null);
        Long cameFrom = explorationLogRepository.findLastPoint(userId)
                .flatMap(point -> scentRegionLocator.regionIdAt(point.x(), point.y()))
                .orElse(null);

        if (Objects.equals(movedInto, cameFrom)) {
            return Optional.empty();
        }
        return Optional.of(explorationLogRepository.insertSeaMove(userId, x, y));
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_LOGIN_REQUIRED));
    }
}
