package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.request.ExplorationLogCreateRequest;
import com.hyanghae.backend.map.dto.response.ExplorationLogCreateResponse;
import com.hyanghae.backend.map.service.ExplorationLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 향 지도 탐색 기록입니다.
 *
 * <p>{@link MapController} 와 나눈 이유는 성격이 다르기 때문입니다. 지도 조회는 누구에게나 같은
 * 답을 주는 읽기이고, 여기는 로그인한 사용자에게 매달리는 쓰기입니다.
 */
@RestController
@RequestMapping("/api/v1/map/exploration-logs")
public class ExplorationLogController {

    private final ExplorationLogService explorationLogService;

    public ExplorationLogController(ExplorationLogService explorationLogService) {
        this.explorationLogService = explorationLogService;
    }

    /**
     * 배가 움직인 것을 기록합니다. 클릭 한 번에 한 번 부릅니다.
     *
     * <p>향수를 골랐으면 {@code perfumeId} 를, 빈 바다를 골랐으면 {@code x}·{@code y} 를 보냅니다.
     * 향수를 고른 경우 좌표는 서버가 그 향수의 지도 좌표로 채웁니다.
     *
     * <p><b>기록이 남으면 201, 남길 것이 없으면 204 입니다.</b> 같은 향 영역 안에서 빈 바다를
     * 다시 누른 이동은 일지에 적을 내용이 없어 남기지 않습니다. 화면은 두 경우를 구분하지 않고
     * 클릭마다 부르면 됩니다.
     *
     * <p>지도에 없는 향수는 404, 향수 번호도 좌표도 없으면 400, 로그인하지 않았으면 401 입니다.
     */
    @PostMapping
    public ResponseEntity<ExplorationLogCreateResponse> createLog(
            @RequestBody ExplorationLogCreateRequest request
    ) {
        return explorationLogService.create(request)
                .map(log -> ResponseEntity.status(HttpStatus.CREATED).body(log))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
