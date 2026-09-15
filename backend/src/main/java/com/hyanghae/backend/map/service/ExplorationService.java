package com.hyanghae.backend.map.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.global.security.CurrentUser;
import com.hyanghae.backend.map.dto.request.ExplorationMoveRequest;
import com.hyanghae.backend.map.dto.response.ExplorationStateResponse;
import com.hyanghae.backend.map.dto.response.VoyageLogEntryResponse;
import com.hyanghae.backend.map.dto.response.VoyageLogResponse;
import com.hyanghae.backend.map.exception.MapErrorCode;
import com.hyanghae.backend.map.repository.ExplorationLogRepository;
import com.hyanghae.backend.map.repository.ExplorationLogRow;
import com.hyanghae.backend.map.repository.ExplorationPoint;
import com.hyanghae.backend.map.repository.ExplorationStateRepository;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
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
 * <p>배를 옮기는 것은 로그인 없이도 됩니다. 남기는 것만 로그인이 필요합니다. 자리와 일지는
 * 사용자에게 매달리는 값이라, 비로그인 요청은 좌표만 돌려받고 아무것도 남기지 않습니다.
 *
 * <p>인증이 아직 없어 지금은 모든 요청이 비로그인이고, 로그인한 경우의 동작은 통합 테스트가
 * 가짜 {@link CurrentUser} 로 검증합니다.
 */
@Service
public class ExplorationService {

    /** 일지를 만들 때 훑는 기록 수의 상한입니다. 그보다 오래된 진입은 일지에 나오지 않습니다. */
    private static final int MAX_SCANNED_LOGS = 200;

    /**
     * 한 번에 돌려주는 구역 진입 수의 상한입니다.
     *
     * <p>{@link #MAX_SCANNED_LOGS} 와 맞물려 있습니다. 진입 20개를 만들려면 훑는 200줄 안에
     * 진입이 20개 있어야 하고, 진입당 평균 10줄입니다. 이보다 크게 받으면 요청한 수를 채우지
     * 못하는 일이 흔해집니다. 더 멀리 보여줘야 하면 기록에 영역을 저장해 SQL 로 묶는 쪽으로
     * 바꾸는 것이 낫습니다. 그러면 상한 자체가 필요 없어집니다.
     */
    private static final int MAX_ENTRIES = 20;

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
     * 배를 옮기고 옮긴 자리를 돌려줍니다.
     *
     * <p><b>로그인하지 않아도 배는 움직입니다.</b> 요구사항 정의서 MAP-16 이 "비회원도 향 지도를
     * 이용하여 향수를 탐색할 수 있다" 로 정하고 있어, 배를 못 움직이면 비회원은 지도를 쓸 수
     * 없습니다. 대신 남기지 않습니다. 자리와 일지는 사용자에게 매달리는 값이라 매달 곳이 없습니다.
     * 그때는 옮긴 좌표만 돌려주고 {@code updatedAt} 이 비어 나갑니다.
     *
     * <p>지도에 없는 향수를 고르거나 좌표가 빠진 요청은 로그인 여부와 상관없이 막습니다. 배를
     * 옮길 수 없는 요청인 것은 같기 때문입니다.
     *
     * <p>자리는 로그인한 사용자라면 어느 경우에나 갱신됩니다. 일지에 안 남는 이동이라도 배는
     * 그리로 갔기 때문입니다. 일지 기록은 이 안에서 알아서 남기고 응답에 드러내지 않습니다.
     * 화면이 기록 한 줄의 번호를 쓸 일이 없고, 이 요청의 결과는 "배가 어디로 갔는가" 하나입니다.
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
    public ExplorationStateResponse move(ExplorationMoveRequest request) {
        ExplorationPoint movedTo = resolvePoint(request);
        Optional<Long> sailor = currentUser.id();

        if (sailor.isEmpty()) {
            return ExplorationStateResponse.notSaved(movedTo.x(), movedTo.y());
        }

        Long userId = sailor.get();
        if (request.isPerfumeVisit()) {
            explorationLogRepository.insert(userId, request.perfumeId(), movedTo);
        } else if (entersNewRegion(userId, movedTo)) {
            explorationLogRepository.insert(userId, null, movedTo);
        }

        return explorationStateRepository.save(userId, movedTo);
    }

    /**
     * 배를 처음 띄웁니다. 취향 테스트가 정한 향수 자리입니다.
     *
     * <p>{@link #move} 와 달리 일지에 남기지 않습니다. 일지는 사용자가 움직인 자취이고 출발점은
     * 움직인 것이 아닙니다. 배를 처음 띄운 시각은 {@code map_exploration_states.created_at} 에
     * 남습니다.
     *
     * <p>지도에 없는 향수면 비어 있고 <b>배도 움직이지 않습니다.</b> 좌표가 없으니 놓을 자리가
     * 없습니다. 오류로 답하는 대신 비워 돌려주는 이유는 부르는 쪽이 자기 도메인의 코드로 답해야
     * 하기 때문입니다 — 취향 테스트에서는 결과 향수가 잘못된 것이라 400 입니다.
     *
     * <p>사용자 번호를 받습니다. 여기만 {@link CurrentUser} 를 쓰지 않는 이유는 부르는 쪽이 이미
     * 로그인을 확인하고 자기 도메인의 코드로 401 을 냈기 때문입니다.
     */
    @Transactional
    public Optional<ExplorationPoint> placeStartingPoint(Long userId, Long perfumeId) {
        Optional<ExplorationPoint> point = explorationLogRepository.findMapPoint(perfumeId);
        point.ifPresent(start -> explorationStateRepository.save(userId, start));
        return point;
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
     * 향해 일지입니다. 최근 구역 진입부터 {@code size} 개를 돌려줍니다.
     *
     * <p>기록을 시간순으로 늘어놓고 향 영역이 바뀌는 지점에서 끊습니다. 한 덩어리가 "○○ 구역
     * 진입" 한 줄이고, 그 안에서 들른 향수가 딸립니다. 계열 영역 밖의 바다로 나간 이동은 그릴
     * 구역이 없어 줄로 나오지 않지만, 덩어리를 끊기는 하므로 바다에 나갔다 같은 구역으로 돌아오면
     * 진입이 두 줄이 됩니다.
     *
     * <p>묶는 일을 서버가 합니다. 영역 번호를 저장하지 않기로 해서 SQL 로는 묶을 수 없고, 화면이
     * 묶으면 폴리곤 판정을 양쪽이 각자 구현하게 됩니다.
     *
     * <p>읽는 기록 수에 상한이 있습니다({@link #MAX_SCANNED_LOGS}). 그보다 오래된 진입은 일지에
     * 나오지 않습니다. 지금 화면이 최근 항해만 보여주므로 충분하고, 더 멀리 보여줘야 하면 영역
     * 번호를 저장해 SQL 로 묶는 쪽으로 바꾸는 것이 낫습니다.
     */
    @Transactional(readOnly = true)
    public VoyageLogResponse findMyVoyageLog(int size) {
        List<ExplorationLogRow> recent =
                explorationLogRepository.findRecent(currentUserId(), MAX_SCANNED_LOGS);
        List<VoyageLogEntryResponse> entries = toEntries(recent, scentRegionLocator.load());

        return new VoyageLogResponse(entries.stream()
                .limit(Math.clamp(size, 1, MAX_ENTRIES))
                .toList());
    }

    /**
     * 기록을 구역 진입 단위로 묶습니다. 돌려주는 순서는 최근 진입부터입니다.
     *
     * <p>받은 기록은 최근 순이라 뒤에서부터 훑어 시간순으로 봅니다. 영역이 직전과 다르면 새
     * 덩어리를 열고, 같으면 그 덩어리에 향수를 더합니다.
     *
     * <p>상한에 걸렸을 때 가장 오래된 덩어리는 버립니다. 그 덩어리를 연 기록이 상한 밖에 남아
     * 있을 수 있어, 진입 시각과 향수 목록이 실제보다 짧게 보입니다.
     *
     * <p>다만 덩어리가 하나뿐이면 버리지 않습니다. 한 구역에 머물며 향수를 계속 누른 사용자는
     * 상한 200줄이 전부 한 덩어리가 되는데, 그것까지 버리면 가장 열심히 본 사람의 일지가 텅
     * 빕니다. 진입 시각이 실제보다 늦게 보이는 편이 아무것도 안 보이는 것보다 낫습니다.
     */
    private List<VoyageLogEntryResponse> toEntries(
            List<ExplorationLogRow> recentFirst,
            ScentRegions regions
    ) {
        Deque<VoyageLogEntry> entries = new ArrayDeque<>();
        Long openedIn = null;

        for (int i = recentFirst.size() - 1; i >= 0; i--) {
            ExplorationLogRow row = recentFirst.get(i);
            Long region = regions.idAt(row.x(), row.y()).orElse(null);

            if (!Objects.equals(region, openedIn) || entries.isEmpty()) {
                entries.push(new VoyageLogEntry(row, regions.at(row.x(), row.y()).orElse(null)));
                openedIn = region;
            }
            if (row.perfumeId() != null) {
                entries.peek().visit(row);
            }
        }

        boolean scannedToTheLimit = recentFirst.size() == MAX_SCANNED_LOGS;
        if (scannedToTheLimit && entries.size() > 1) {
            entries.pollLast();
        }
        return entries.stream()
                .filter(VoyageLogEntry::isInsideRegion)
                .map(VoyageLogEntry::toResponse)
                .toList();
    }

    /**
     * 향수를 고른 이동이면 그 향수의 지도 좌표를, 빈 바다면 클릭한 좌표를 씁니다.
     *
     * <p>향수를 고른 경우 화면이 보낸 좌표를 쓰지 않습니다. 지도에 찍힌 자리와 기록에 남는 자리가
     * 어긋날 수 있고, 같은 값을 두 곳이 각자 갖게 됩니다.
     */
    private ExplorationPoint resolvePoint(ExplorationMoveRequest request) {
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
        ScentRegions regions = scentRegionLocator.load();
        Long movedInto = regions.idAt(movedTo.x(), movedTo.y()).orElse(null);
        Long cameFrom = explorationLogRepository.findLastPoint(userId)
                .flatMap(point -> regions.idAt(point.x(), point.y()))
                .orElse(null);

        return !Objects.equals(movedInto, cameFrom);
    }

    private Long currentUserId() {
        return currentUser.id()
                .orElseThrow(() -> new BusinessException(MapErrorCode.MAP_LOGIN_REQUIRED));
    }
}
