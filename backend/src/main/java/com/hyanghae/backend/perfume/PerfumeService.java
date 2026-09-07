package com.hyanghae.backend.perfume;

import com.hyanghae.backend.common.PageResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerfumeService {

    private final PerfumeRepository perfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;

    public PerfumeService(
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository
    ) {
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
    }

    /**
     * 향수명·브랜드명으로 향수를 검색합니다.
     *
     * <p>기능 명세의 "검색어가 입력되지 않은 경우 검색을 수행하지 않는다" 에 따라, 검색어가 없으면
     * 데이터베이스를 조회하지 않고 빈 결과를 반환합니다. 전체 목록을 돌려주면 검색창을 누르기만 해도
     * 카탈로그 전체를 긁는 요청이 됩니다.
     */
    @Transactional(readOnly = true)
    public PageResponse<PerfumeSummaryResponse> search(String keyword, Pageable pageable) {
        String normalized = normalize(keyword);
        if (normalized == null) {
            return PageResponse.from(Page.empty(pageable));
        }

        Page<PerfumeSummaryResponse> found = perfumeRepository.searchByKeyword(normalized, pageable);
        Map<Long, String> thumbnails = loadThumbnails(found.getContent());

        return PageResponse.from(
                found.map(perfume -> perfume.withThumbnailUrl(thumbnails.get(perfume.perfumeId())))
        );
    }

    /**
     * 조회된 향수들의 대표 이미지를 한 번의 쿼리로 가져옵니다.
     *
     * <p>검색 쿼리에 이미지 조인을 합치지 않는 이유는, 한 향수에 이미지가 여러 장이면 행이 중복되고
     * {@code display_order} 가 같거나 {@code NULL} 인 경우 어떤 행이 남을지 예측하기 어려워지기
     * 때문입니다. 정렬된 결과에서 향수별 첫 행만 취하면 규칙이 명확합니다.
     */
    private Map<Long, String> loadThumbnails(List<PerfumeSummaryResponse> perfumes) {
        if (perfumes.isEmpty()) {
            return Map.of();
        }

        List<Long> perfumeIds = perfumes.stream()
                .map(PerfumeSummaryResponse::perfumeId)
                .toList();

        Map<Long, String> thumbnails = new HashMap<>();
        for (PerfumeThumbnail candidate : perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)) {
            thumbnails.putIfAbsent(candidate.perfumeId(), candidate.imageUrl());
        }
        return thumbnails;
    }

    /**
     * 빈 문자열과 공백만 있는 검색어를 {@code null} 로 만들어 "검색어 없음"과 같게 다룹니다.
     */
    private String normalize(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim();
    }
}
