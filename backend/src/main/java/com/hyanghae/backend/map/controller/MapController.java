package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.request.MapViewportCondition;
import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.service.ScentMapService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
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
     * <p>범위({@code minX}·{@code maxX}·{@code minY}·{@code maxY})는 선택입니다. 주지 않으면
     * 지도에 좌표가 있는 활성 향수 전체가 나갑니다. <b>넷 중 일부만 주면 400 입니다.</b>
     *
     * <p>화면은 지금 범위를 주지 않고 전체를 받아 갑니다. 이유는
     * {@link MapViewportCondition} 주석에 있습니다.
     *
     * <p>범위는 향수에만 걸립니다. 계열 영역은 폴리곤이 지도 바깥 여백까지 뻗어 있어 좌표계가
     * 다르고, 9개뿐이라 잘라서 얻는 것이 없습니다.
     */
    @GetMapping
    public ScentMapResponse getMap(@ModelAttribute MapViewportCondition viewport) {
        return scentMapService.getMap(viewport);
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
