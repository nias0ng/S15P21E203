package com.hyanghae.backend.map.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.dto.request.ExplorationLogCreateRequest;
import com.hyanghae.backend.map.dto.response.ExplorationLogCreateResponse;
import com.hyanghae.backend.map.dto.response.ExplorationStateResponse;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.repository.ExplorationLogRepository;
import com.hyanghae.backend.map.repository.ExplorationPoint;
import com.hyanghae.backend.map.repository.ExplorationStateRepository;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배가 움직인 것을 다룹니다.
 *
 * <p>클릭 한 번이 두 가지를 만듭니다. 배가 지금 있는 자리가 갱신되고, 향해 일지에 적을 만한
 * 이동이면 기록이 한 줄 남습니다.
 *
 * <p>자리는 클릭마다 덮어씁니다. 지도를 다시 열었을 때 배를 있던 곳에 돌려놓아야 하는데,
 * 기록만으로는 그 자리를 알 수 없습니다. 기록은 일지에 적을 사건만 남기므로 같은 향 영역 안에서
 * 움직인 마지막 자리가 빠지기 때문입니다.
 *
 * <p>기록은 두 가지만 남깁니다. 향수를 고른 이동과, 빈 바다를 골라 향 영역이 바뀐 이동입니다.
 * 같은 영역 안에서 바다를 여러 번 누른 것은 일지에 적을 내용이 없습니다.
 *
 * <p>영역은 좌표로 그때그때 판정합니다({@link ScentRegionLocator}). 기록에는 좌표만 남고 영역
 * 번호는 저장하지 않습니다. 지도의 모양과 향 영역이 고정이라 같은 좌표는 언제 읽어도 같은
 * 영역으로 판정됩니다.
 *
 * <p>배는 사용자에게 매달리므로 로그인이 필요합니다. 인증이 아직 없어 지금은 모든 요청이
 * 401 이고, 로그인한 경우의 동작은 통합 테스트가 가짜 {@link CurrentUser} 로 검증합니다.
 */
@Service
public class ExplorationService {

    private final ExplorationLogRepository explorationLogRepository;
    private final ExplorationStateRepository explorationStateRepository;
    private final ScentRegionLocator scentRegionLocator;
    private final CurrentUser currentUser;

    public ExplorationService(
            ExplorationLogRepository explorationLogRepository,
            ExplorationStateRepository explorationStateRepository,
            ScentRegionLocator scentRegionLocator,
            CurrentUser currentUser
    ) {
        this.explorationLogRepository = explorationLogRepository;
        this.explorationStateRepository = explorationStateRepository;
        this.scentRegionLocator = scentRegionLocator;
        this.currentUser = currentUser;
    }

    /**
     * 배를 옮깁니다. 일지에 남길 것이 있으면 그 기록을, 없으면 빈 {@link Optional} 을 돌려줍니다.
     *
     * <p>자리는 어느 경우에나 갱신됩니다. 일지에 안 남는 이동이라도 배는 그리로 갔기 때문입니다.
     *
     * <p>향수를 고른 이동은 언제나 기록합니다. 같은 향수를 다시 골라도 줄을 따로 쌓습니다. 일지는
     * 배가 지나온 자리를 적는 화면이라, 지난번에 본 향수를 다시 봤다면 두 번 나오는 것이 맞습니다.
     *
     * <p>빈 바다로 간 이동은 향 영역이 바뀐 경우에만 기록합니다. 영역 밖으로 나간 것도 바뀐
     * 것으로 봅니다. 그 줄은 일지에 구역으로 그릴 수 없지만, 다음에 어느 구역으로 들어갔는지
     * 판단하는 기준이 됩니다.
     *
     * <p>지도에 없는 향수는 404 입니다. 좌표가 없거나 비활성인 향수는 지도에 찍히지 않으니 그
     * 향수로 배를 옮길 수도 없습니다. 지도 조회 두 개와 같은 코드로 답합니다.
     */
    @Transactional
    public Optional<ExplorationLogCreateResponse> move(ExplorationLogCreateRequest request) {
        Long userId = currentUserId();
        ExplorationPoint movedTo = resolvePoint(request);

        explorationStateRepository.save(userId, movedTo);

        if (request.isPerfumeVisit()) {
            return Optional.of(
                    explorationLogRepository.insert(userId, request.perfumeId(), movedTo));
        }
        if (entersNewRegion(userId, movedTo)) {
            return Optional.of(explorationLogRepository.insert(userId, null, movedTo));
        }
        return Optional.empty();
    }

    /**
     * 배가 지금 있는 자리입니다. 한 번도 움직인 적이 없으면 세 필드가 모두 {@code null} 입니다.
     */
    @Transactional(readOnly = true)
    public ExplorationStateResponse findMyPosition() {
        return explorationStateRepository.find(currentUserId())
                .orElseGet(ExplorationStateResponse::empty);
    }

    /**
     * 향수를 고른 이동이면 그 향수의 지도 좌표를, 빈 바다면 클릭한 좌표를 씁니다.
     *
     * <p>향수를 고른 경우 화면이 보낸 좌표를 쓰지 않습니다. 지도에 찍힌 자리와 기록에 남는 자리가
     * 어긋날 수 있고, 같은 값을 두 곳이 각자 갖게 됩니다.
     */
    private ExplorationPoint resolvePoint(ExplorationLogCreateRequest request) {
        if (request.isPerfumeVisit()) {
            return explorationLogRepository.findMapPoint(request.perfumeId())
                    .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_PERFUME_NOT_FOUND));
        }
        if (!request.hasCoordinate()) {
            throw new BusinessException(MapErrorCode.MAP_EXPLORATION_POINT_REQUIRED);
        }
        return new ExplorationPoint(request.x(), request.y());
    }

    /**
     * 직전 기록의 자리와 향 영역이 다른지 봅니다.
     *
     * <p>기록이 하나도 없는 상태는 영역 밖으로 봅니다. 그래서 첫 클릭이 바다면 남지 않고, 첫
     * 클릭이 어느 구역 안이면 진입으로 남습니다.
     *
     * <p>배의 현재 자리가 아니라 마지막 기록의 자리와 비교합니다. 영역이 바뀌는 이동은 모두
     * 기록되므로 두 값의 영역은 언제나 같고, 기록 쪽이 판단의 근거를 그대로 보여줍니다.
     */
    private boolean entersNewRegion(Long userId, ExplorationPoint movedTo) {
        Long movedInto = scentRegionLocator.regionIdAt(movedTo.x(), movedTo.y()).orElse(null);
        Long cameFrom = explorationLogRepository.findLastPoint(userId)
                .flatMap(point -> scentRegionLocator.regionIdAt(point.x(), point.y()))
                .orElse(null);

        return !Objects.equals(movedInto, cameFrom);
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_LOGIN_REQUIRED));
    }
}
