package com.hyanghae.backend.perfume.service;

import com.hyanghae.backend.global.exception.BusinessException;
import com.hyanghae.backend.perfume.dto.response.BrandDetailResponse;
import com.hyanghae.backend.perfume.dto.response.BrandSummaryResponse;
import com.hyanghae.backend.perfume.dto.response.BrandsResponse;
import com.hyanghae.backend.perfume.repository.BrandRepository;
import com.hyanghae.backend.perfume.repository.BrandSort;
import com.hyanghae.backend.perfume.exception.PerfumeErrorCode;
import com.hyanghae.backend.perfume.repository.BrandSummaryRow;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 브랜드 목록을 읽습니다.
 *
 * <p>로그인이 필요 없습니다. 브랜드 페이지는 누구나 볼 수 있어야 합니다.
 *
 * <p>내려간 브랜드는 빼고, 향수가 하나도 없는 브랜드는 <b>남깁니다.</b> 브랜드 페이지는
 * 카탈로그라서, 향수가 잠깐 0이 됐다고 브랜드가 목록에서 사라지면 이상합니다.
 */
@Service
public class BrandService {

    private final BrandRepository brandRepository;

    public BrandService(BrandRepository brandRepository) {
        this.brandRepository = brandRepository;
    }

    /**
     * 브랜드 전체입니다. 검색어를 주면 이름으로 거릅니다.
     *
     * <p>정렬 셋 중 무엇을 화면에 띄울지는 프론트가 정합니다. 여기서는 셋 다 받습니다.
     */
    @Transactional(readOnly = true)
    public BrandsResponse findAll(String keyword, BrandSort sort) {
        String pattern = likePattern(keyword);

        List<BrandSummaryRow> rows = switch (sort) {
            case NAME_KO -> brandRepository.findAllByNameKo(pattern);
            case NAME_EN -> brandRepository.findAllByNameEn(pattern);
            case PERFUME_COUNT -> brandRepository.findAllByPerfumeCount(pattern);
        };

        return new BrandsResponse(rows.stream()
                .map(row -> new BrandSummaryResponse(
                        row.getBrandId(),
                        row.getName(),
                        row.getNameKo(),
                        row.getLogoUrl()))
                .toList());
    }

    /**
     * 브랜드 한 곳입니다. 없거나 내려간 브랜드는 404 입니다.
     *
     * <p>목록에서 골라 쓰지 않고 따로 두는 이유는 크기입니다. 브랜드가 7,793개라 상세 화면
     * 하나를 그리려고 전체 목록을 받아 오게 됩니다.
     */
    @Transactional(readOnly = true)
    public BrandDetailResponse findOne(Long brandId) {
        return brandRepository.findDetailById(brandId)
                .map(row -> new BrandDetailResponse(
                        row.getBrandId(),
                        row.getName(),
                        row.getNameKo(),
                        row.getLogoUrl(),
                        row.getPerfumeCount()))
                .orElseThrow(() -> new BusinessException(PerfumeErrorCode.PERFUME_BRAND_NOT_FOUND));
    }

    /**
     * 검색어를 {@code LIKE} 무늬로 바꿉니다. 비었으면 {@code null} 이라 조건이 걸리지 않습니다.
     *
     * <p><b>{@code %} 와 {@code _} 를 먼저 막습니다.</b> 사용자가 {@code %} 만 쳐서 보내면
     * 와일드카드로 해석되어 전체가 걸리고, 검색이 검색이 아니게 됩니다. 탈출 문자
     * ({@code \})부터 바꾸는 이유는, 나중에 바꾸면 앞서 넣은 탈출 문자까지 다시 탈출시켜 무늬가
     * 어긋나기 때문입니다.
     */
    private String likePattern(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String escaped = keyword.strip()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
