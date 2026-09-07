package com.hyanghae.backend.perfume;

import com.hyanghae.backend.common.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerfumeService {

    private final PerfumeRepository perfumeRepository;

    public PerfumeService(PerfumeRepository perfumeRepository) {
        this.perfumeRepository = perfumeRepository;
    }

    /**
     * 향수명·브랜드명으로 향수를 검색합니다. 검색어가 없으면 활성 향수 전체를 반환합니다.
     */
    @Transactional(readOnly = true)
    public PageResponse<PerfumeSummaryResponse> search(String keyword, Pageable pageable) {
        String normalized = normalize(keyword);

        Page<PerfumeSummaryResponse> page = normalized == null
                ? perfumeRepository.findAllActive(pageable)
                : perfumeRepository.searchByKeyword(normalized, pageable);

        return PageResponse.from(page);
    }

    /**
     * 빈 문자열과 공백만 있는 검색어를 {@code null} 로 만들어 "검색어 없음"과 같게 다룹니다.
     * 정규화하지 않으면 {@code ?keyword=} 같은 요청이 공백을 포함한 이름만 찾게 됩니다.
     */
    private String normalize(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim();
    }
}
