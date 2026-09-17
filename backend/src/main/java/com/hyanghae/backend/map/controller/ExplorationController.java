package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.request.ExplorationMoveRequest;
import com.hyanghae.backend.map.dto.response.ExplorationStateResponse;
import com.hyanghae.backend.map.dto.response.VoyageLogResponse;
import com.hyanghae.backend.map.service.ExplorationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 향 지도에서 배가 있는 자리를 다룹니다.
 *
 * <p>배를 옮기고, 배가 있는 자리를 읽고, 지나온 자취를 일지로 읽습니다.
 *
 * <p>{@link MapController} 와 나눈 이유는 성격이 다르기 때문입니다. 지도 조회는 누구에게나 같은
 * 답을 주는 읽기이고, 여기는 사용자의 배를 다루는 기능입니다.
 *
 * <p>로그인 요구가 셋이 다릅니다. 배를 옮기는 것은 로그인 없이도 되고(비회원도 지도를 탐색할 수
 * 있어야 합니다), 자리와 일지를 읽는 것은 로그인이 필요합니다. 읽을 값 자체가 사용자에게 매달려
 * 있기 때문입니다.
 */
@Tag(name = "향 지도 탐험", description = "지도 위 배의 자리와 지나온 자취를 다룹니다.")
@RestController
@RequestMapping("/api/v1/map")
public class ExplorationController {

    private static final int DEFAULT_ENTRY_SIZE = 20;

    private final ExplorationService explorationService;

    public ExplorationController(ExplorationService explorationService) {
        this.explorationService = explorationService;
    }

    /**
     * 배를 옮깁니다. 지도에서 클릭 한 번에 한 번 부릅니다.
     *
     * <p>향수를 골랐으면 {@code perfumeId} 를, 빈 바다를 골랐으면 {@code x}·{@code y} 를 보냅니다.
     * 향수를 고른 경우 좌표는 서버가 그 향수의 지도 좌표로 채웁니다. 응답은 옮긴 뒤의 자리입니다.
     *
     * <p>향해 일지에 남길 이동이면 기록도 함께 남습니다. 향수를 고른 이동은 언제나 남고, 빈 바다로
     * 간 이동은 향 영역이 바뀐 경우에만 남습니다. 화면은 그 차이를 알 필요가 없어 응답에 드러내지
     * 않습니다. 남은 기록은 {@code GET /api/v1/map/exploration-logs} 로 읽습니다.
     *
     * <p><b>로그인하지 않아도 배는 움직입니다.</b> 비회원도 지도를 탐색할 수 있어야 하기
     * 때문입니다. 대신 남기지 않습니다. 자리도 일지도 사용자에게 매달리는 값이라, 옮긴 좌표만
     * 돌려주고 {@code updatedAt} 이 비어 나갑니다.
     *
     * <p>지도에 없는 향수는 404, 향수 번호도 좌표도 없으면 400 입니다. 로그인 여부와 상관없이
     * 같습니다.
     */
    @Operation(
            summary = "배 옮기기",
            description = "향수를 골랐으면 perfumeId 를, 빈 바다를 골랐으면 x·y 를 보냅니다."
                    + " 향수를 고른 경우 좌표는 서버가 그 향수의 지도 좌표로 채웁니다."
                    + " 로그인하지 않아도 배는 움직이며, 그때는 자리를 저장하지 않아"
                    + " updatedAt 이 비어 나갑니다."
    )
    @ApiResponse(responseCode = "200", description = "옮긴 뒤의 자리")
    @ApiResponse(responseCode = "400", description = "향수 번호도 좌표도 없음")
    @ApiResponse(responseCode = "404", description = "지도에 없는 향수")
    @PutMapping("/exploration/me")
    public ExplorationStateResponse move(@RequestBody ExplorationMoveRequest request) {
        return explorationService.move(request);
    }

    /**
     * 배가 지금 떠 있는 자리입니다. 지도를 다시 열 때 배를 돌려놓는 데 씁니다.
     *
     * <p>한 번도 움직인 적이 없으면 세 필드가 모두 {@code null} 인 200 입니다. 404 로 하면 화면이
     * 처음 온 사용자를 오류로 다뤄야 합니다. 로그인하지 않았으면 401 입니다.
     */
    @Operation(
            summary = "내 배의 자리",
            description = "지도를 다시 열 때 배를 돌려놓는 데 씁니다."
                    + " 한 번도 움직인 적이 없으면 세 필드가 모두 null 인 200 입니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @GetMapping("/exploration/me")
    public ExplorationStateResponse getMyPosition() {
        return explorationService.findMyPosition();
    }

    /**
     * 향해 일지입니다. 최근 구역 진입부터 나옵니다.
     *
     * <p>한 줄이 "○○ 구역 진입" 이고 그 구역에서 들른 향수가 딸립니다. 들르지 않고 지나가기만 한
     * 구역은 향수 목록이 빈 채로 나옵니다. 계열 영역 밖의 바다로 나간 이동은 그릴 구역이 없어
     * 줄로 나오지 않지만, 바다에 나갔다 같은 구역으로 돌아오면 진입이 두 줄이 됩니다.
     *
     * <p>{@code size} 는 받을 진입 수입니다. 기본 20개, 최대 100개이고 그 범위를 벗어난 값은
     * 잘립니다. 오래된 항해까지 거슬러 볼 수 있는 페이지는 아직 없습니다. 화면이 필요해지면
     * 기록에 영역을 저장해 SQL 로 묶는 쪽으로 바꾸는 것이 낫습니다.
     *
     * <p>로그인하지 않았으면 401 입니다.
     */
    @Operation(
            summary = "향해 일지",
            description = "최근 구역 진입부터 나옵니다. 한 줄이 \"○○ 구역 진입\" 이고 그 구역에서"
                    + " 들른 향수가 딸립니다. 들르지 않고 지나가기만 한 구역은 향수 목록이 빈"
                    + " 채로 나옵니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @GetMapping("/exploration-logs")
    public VoyageLogResponse getMyVoyageLog(
            @Parameter(description = "받을 진입 수. 기본 20개, 최대 100개이고 범위를 벗어나면 잘립니다.")
            @RequestParam(defaultValue = "" + DEFAULT_ENTRY_SIZE) int size
    ) {
        return explorationService.findMyVoyageLog(size);
    }
}
