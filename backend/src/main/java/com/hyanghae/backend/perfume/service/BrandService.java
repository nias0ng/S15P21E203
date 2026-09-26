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
     * <p><b>공백을 모두 지웁니다.</b> 브랜드 7,873곳 중 5,042곳의 한국어 이름에 공백이 있어
     * ('빅토리아 시크릿', '배스 앤 바디 웍스'), 붙여 친 검색어가 0건이 되고 있었습니다. 어디서
     * 띄는지는 사람마다 다른데 이름은 한 가지로만 저장됩니다. 비교하는 쪽도 같이 지우므로
     * ({@code BrandRepository.BRAND_WHERE}) 양쪽이 공백 없는 형태로 만납니다.
     *
     * <p>이 정규화는 걸리는 범위를 넓히기만 합니다. 전에 걸리던 검색어는 그대로 걸립니다 —
     * 양쪽에서 같은 문자를 지우면 부분 일치 관계가 깨지지 않기 때문입니다.
     *
     * <p><b>{@code %} 와 {@code _} 를 막습니다.</b> 사용자가 {@code %} 만 쳐서 보내면
     * 와일드카드로 해석되어 전체가 걸리고, 검색이 검색이 아니게 됩니다. 탈출 문자
     * ({@code \})부터 바꾸는 이유는, 나중에 바꾸면 앞서 넣은 탈출 문자까지 다시 탈출시켜 무늬가
     * 어긋나기 때문입니다. 공백을 먼저 지우는 것은 탈출 문자가 공백을 만들지 않아 순서가
     * 결과를 바꾸지 않지만, 사용자가 친 그대로를 먼저 다듬는 편이 읽기 쉽기 때문입니다.
     */
    private String likePattern(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String escaped = keyword.replaceAll("\\s+", "")
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
