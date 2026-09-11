package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.request.ExplorationLogCreateRequest;
import com.hyanghae.backend.map.dto.response.ExplorationLogCreateResponse;
import com.hyanghae.backend.map.dto.response.ExplorationStateResponse;
import com.hyanghae.backend.map.service.ExplorationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 향 지도에서 배가 움직이는 일을 다룹니다.
 *
 * <p>{@link MapController} 와 나눈 이유는 성격이 다르기 때문입니다. 지도 조회는 누구에게나 같은
 * 답을 주는 읽기이고, 여기는 로그인한 사용자의 배에 매달리는 기능입니다.
 */
@RestController
@RequestMapping("/api/v1/map")
public class ExplorationController {

    private final ExplorationService explorationService;

    public ExplorationController(ExplorationService explorationService) {
        this.explorationService = explorationService;
    }

    /**
     * 배가 움직인 것을 알립니다. 지도에서 클릭 한 번에 한 번 부릅니다.
     *
     * <p>향수를 골랐으면 {@code perfumeId} 를, 빈 바다를 골랐으면 {@code x}·{@code y} 를 보냅니다.
     * 향수를 고른 경우 좌표는 서버가 그 향수의 지도 좌표로 채웁니다.
     *
     * <p>배가 있는 자리는 어느 경우에나 갱신됩니다. <b>향해 일지에 남을 이동이면 201, 남길 것이
     * 없으면 204 입니다.</b> 같은 향 영역 안에서 빈 바다를 다시 누른 이동은 일지에 적을 내용이
     * 없어 기록하지 않습니다. 화면은 두 경우를 구분하지 않고 클릭마다 부르면 됩니다.
     *
     * <p>지도에 없는 향수는 404, 향수 번호도 좌표도 없으면 400, 로그인하지 않았으면 401 입니다.
     */
    @PostMapping("/exploration-logs")
    public ResponseEntity<ExplorationLogCreateResponse> move(
            @RequestBody ExplorationLogCreateRequest request
    ) {
        return explorationService.move(request)
                .map(log -> ResponseEntity.status(HttpStatus.CREATED).body(log))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * 배가 지금 떠 있는 자리입니다. 지도를 다시 열 때 배를 돌려놓는 데 씁니다.
     *
     * <p>한 번도 움직인 적이 없으면 세 필드가 모두 {@code null} 인 200 입니다. 404 로 하면 화면이
     * 처음 온 사용자를 오류로 다뤄야 합니다. 로그인하지 않았으면 401 입니다.
     */
    @GetMapping("/exploration/me")
    public ExplorationStateResponse getMyPosition() {
        return explorationService.findMyPosition();
    }
}
