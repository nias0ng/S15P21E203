package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.service.ScentMapService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/map")
public class MapController {

    private final ScentMapService scentMapService;

    public MapController(ScentMapService scentMapService) {
        this.scentMapService = scentMapService;
    }

    /**
     * 향 지도 조회입니다. 계열 영역과 향수 좌표를 함께 돌려줍니다.
     *
     * <p>조건이 없습니다. 지도에 좌표가 있는 활성 향수 전체와 활성 계열 전체가 나갑니다. 화면은
     * 이 목록을 받아 두고 배와 가까운 향수를 직접 고릅니다. 배가 움직일 때마다 서버에 물으면
     * 그만큼 왕복이 생기는데, 지도에 올리는 향수가 200개로 고정이라 한 번에 받는 편이 낫습니다.
     *
     * <p>지도에 올리는 향수를 늘려 한 번에 받기 부담스러워지면 그때 조회 범위를 더합니다.
     */
    @GetMapping
    public ScentMapResponse getMap() {
        return scentMapService.getMap();
    }

    /**
     * 지도에서 선택한 향수의 요약입니다.
     *
     * <p>지도에 없는 향수는 404 입니다. 향수가 없을 때, 비활성일 때, 좌표가 없을 때가 모두
     * {@code MAP_PERFUME_NOT_FOUND} 입니다.
     */
    @GetMapping("/perfumes/{perfumeId}")
    public MapPerfumeDetailResponse getPerfume(@PathVariable Long perfumeId) {
        return scentMapService.getPerfume(perfumeId);
    }
}
