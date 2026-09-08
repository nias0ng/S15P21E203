package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.perfume.dto.response.PerfumeDetailResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSearchResponse;
import com.hyanghae.backend.perfume.dto.response.PerfumeSummaryResponse;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeRepository;
import com.hyanghae.backend.perfume.dto.response.PerfumePriceResponse;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import com.hyanghae.backend.perfume.repository.PerfumePriceRepository;
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
    private final PerfumePriceRepository perfumePriceRepository;

    public PerfumeService(
            PerfumeRepository perfumeRepository,
            PerfumeImageRepository perfumeImageRepository,
            PerfumePriceRepository perfumePriceRepository
    ) {
        this.perfumeRepository = perfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
        this.perfumePriceRepository = perfumePriceRepository;
    }

    /**
     * 향수명·브랜드명으로 향수를 검색합니다.
     *
     * <p>기능 명세의 "검색어가 입력되지 않은 경우 검색을 수행하지 않는다" 에 따라, 검색어가 없으면
     * 데이터베이스를 조회하지 않고 빈 결과를 반환합니다. 전체 목록을 돌려주면 검색창을 누르기만 해도
     * 카탈로그 전체를 긁는 요청이 됩니다.
     */
    @Transactional(readOnly = true)
    public PerfumeSearchResponse search(String keyword, Pageable pageable) {
        String normalized = normalize(keyword);
        if (normalized == null) {
            return PerfumeSearchResponse.from(Page.empty(pageable));
        }

        Page<PerfumeSummaryResponse> found = perfumeRepository.searchByKeyword(normalized, pageable);
        Map<Long, String> images = loadThumbnails(
                found.getContent().stream().map(PerfumeSummaryResponse::perfumeId).toList()
        );

        return PerfumeSearchResponse.from(
                found.map(perfume -> perfume.withImageUrl(images.get(perfume.perfumeId())))
        );
    }

    /**
     * 향수 기본 정보를 조회합니다.
     *
     * <p>기능 명세의 "향수 정보가 존재하지 않는 경우 조회 실패 사실을 안내한다" 에 따라 없는 향수는
     * 예외를 던집니다. 향조·후기·후기 통계·계절별 평가는 명세가 별도 기능으로 분리해 두었으므로
     * 여기서 내려주지 않습니다.
     */
    @Transactional(readOnly = true)
    public PerfumeDetailResponse getDetail(Long perfumeId) {
        PerfumeDetailResponse detail = perfumeRepository.findDetailById(perfumeId)
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_NOT_FOUND));

        return detail.withImagesAndPrices(
                loadImages(perfumeId),
                perfumePriceRepository.findByPerfumeId(perfumeId)
        );
    }

    /**
     * 향수 한 건의 이미지를 대표 이미지가 먼저 오도록 전부 가져옵니다. 검색이 쓰는 조회와 같은
     * 정렬 규칙을 쓰므로, 두 API 가 이미지 순서를 다르게 보는 일이 없습니다.
     */
    private List<String> loadImages(Long perfumeId) {
        return perfumeImageRepository.findOrderedByPerfumeIds(List.of(perfumeId)).stream()
                .map(PerfumeImageUrl::imageUrl)
                .toList();
    }

    /**
     * 향수들의 대표 이미지를 한 번의 쿼리로 가져옵니다.
     *
     * <p>조회 쿼리에 이미지 조인을 합치지 않는 이유는, 한 향수에 이미지가 여러 장이면 행이 중복되고
     * {@code display_order} 가 같거나 {@code NULL} 인 경우 어떤 행이 남을지 예측하기 어려워지기
     * 때문입니다. 정렬된 결과에서 향수별 첫 행만 취하면 규칙이 명확하고, 검색과 기본 정보 조회가
     * 같은 규칙을 씁니다.
     */
    private Map<Long, String> loadThumbnails(List<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, String> thumbnails = new HashMap<>();
        for (PerfumeImageUrl candidate : perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)) {
            thumbnails.putIfAbsent(candidate.perfumeId(), candidate.imageUrl());
        }
        return thumbnails;
    }

    /**
     * 검색어를 쿼리에 넣을 수 있는 형태로 다듬습니다.
     *
     * <p>빈 문자열과 공백만 있는 검색어는 {@code null} 로 만들어 "검색어 없음"과 같게 다룹니다.
     * 정규화하지 않으면 {@code ?keyword=} 같은 요청이 공백을 포함한 이름만 찾게 됩니다.
     */
    private String normalize(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return escapeLikeWildcards(keyword.trim());
    }

    /**
     * 사용자가 입력한 LIKE 와일드카드를 일반 문자로 만듭니다.
     *
     * <p>이스케이프하지 않으면 {@code %} 한 글자만 입력해도 모든 이름과 일치해 활성 향수 전체가
     * 조회됩니다. 검색어 없는 요청을 막아둔 의미가 사라지고, 데이터가 쌓이면 인덱스를 타지 못하는
     * 전체 조회가 됩니다.
     *
     * <p>이스케이프 문자 자신을 먼저 치환해야 합니다. 순서를 바꾸면 뒤 단계가 앞 단계에서 붙인
     * 이스케이프 문자를 다시 이스케이프합니다.
     */
    private String escapeLikeWildcards(String keyword) {
        String escape = PerfumeRepository.LIKE_ESCAPE;
        return keyword
                .replace(escape, escape + escape)
                .replace("%", escape + "%")
                .replace("_", escape + "_");
    }
}
