package com.hyanghae.backend.map.controller;

import com.hyanghae.backend.map.dto.response.MapPerfumeDetailResponse;
import com.hyanghae.backend.map.dto.response.ScentMapResponse;
import com.hyanghae.backend.map.dto.response.ScentVectorsResponse;
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
     * 취향 테스트가 향수를 고를 때 쓰는 계열 벡터입니다.
     *
     * <p>지도 조회와 나눈 이유는 필요한 값도 부르는 때도 다르기 때문입니다. 지도는 점을 찍고
     * 이름을 띄우느라 대표 계열 하나와 이미지가 필요하고 열 때마다 부릅니다. 취향 테스트는 아홉
     * 계열의 비중을 모두 놓고 유사도를 재며 가입할 때 한 번 부릅니다. 합치면 지도를 열 때마다
     * 쓰지 않는 비중이 따라다닙니다.
     *
     * <p>고르는 일은 <b>화면이 합니다.</b> 200개를 한 번에 받아 브라우저에서 코사인 유사도를
     * 잽니다. 서버가 골라 주면 가중치를 바꿀 때마다 배포해야 하고, 화면이 결과를 설명하는 데
     * 필요한 중간값(후보 수 같은 것)도 따로 실어 보내야 합니다.
     *
     * <p>로그인이 필요 없습니다. 취향 테스트는 가입 직후 온보딩에서 도는데, 비회원도 지도를 볼
     * 수 있어야 합니다(MAP-16).
     */
    @GetMapping("/scent-vectors")
    public ScentVectorsResponse getScentVectors() {
        return scentMapService.getScentVectors();
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
