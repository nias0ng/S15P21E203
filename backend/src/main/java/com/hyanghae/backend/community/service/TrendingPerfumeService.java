package com.hyanghae.backend.community.service;

import com.hyanghae.backend.community.dto.response.TrendingPerfumeResponse;
import com.hyanghae.backend.community.dto.response.TrendingPerfumesResponse;
import com.hyanghae.backend.community.repository.TrendingPerfumeRepository;
import com.hyanghae.backend.community.repository.TrendingPerfumeRow;
import com.hyanghae.backend.perfume.repository.PerfumeImageRepository;
import com.hyanghae.backend.perfume.repository.PerfumeImageUrl;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 지금 많이 언급되는 향수입니다. 자유 게시판 오른쪽 칸(와이어프레임 A22b)이 씁니다.
 *
 * <p><b>향수 검색의 인기 순과 다른 값입니다.</b> 그쪽은 담거나 열어 본 횟수라 혼자 보는
 * 행동이고, 이쪽은 글에 써서 남들에게 보인 횟수입니다. 한쪽으로 다른 쪽을 대신할 수 없습니다.
 *
 * <p>로그인이 필요 없습니다. 게시판은 누구나 볼 수 있어야 합니다.
 */
@Service
public class TrendingPerfumeService {

    /**
     * 기본으로 세는 기간입니다. "최근 한 주"가 화면의 문구입니다.
     *
     * <p>고정값인 이유는 화면이 기간을 고르지 않기 때문입니다. 나중에 고르게 되면 그때 파라미터로
     * 열면 됩니다 — 쓰지 않는 선택지를 미리 열어 두면 캐시를 붙일 때 경우의 수만 늘어납니다.
     */
    private static final int TRENDING_DAYS = 7;

    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 50;

    private final TrendingPerfumeRepository trendingPerfumeRepository;
    private final PerfumeImageRepository perfumeImageRepository;

    public TrendingPerfumeService(
            TrendingPerfumeRepository trendingPerfumeRepository,
            PerfumeImageRepository perfumeImageRepository
    ) {
        this.trendingPerfumeRepository = trendingPerfumeRepository;
        this.perfumeImageRepository = perfumeImageRepository;
    }

    /**
     * 최근 한 주 동안 글에 많이 걸린 향수입니다.
     *
     * <p>이미지는 목록에 오른 향수만 한 번에 읽습니다. 향수마다 따로 읽으면 쿼리가 목록 길이만큼
     * 나갑니다.
     *
     * @param limit 몇 개를 받을지입니다. 1~50 으로 자릅니다.
     */
    @Transactional(readOnly = true)
    public TrendingPerfumesResponse findTrending(Integer limit) {
        int size = limit == null ? DEFAULT_LIMIT : Math.clamp(limit, 1, MAX_LIMIT);
        OffsetDateTime since = OffsetDateTime.now().minusDays(TRENDING_DAYS);

        List<TrendingPerfumeRow> rows = trendingPerfumeRepository.findTrending(since, size);
        Map<Long, String> thumbnails = loadThumbnails(
                rows.stream().map(TrendingPerfumeRow::getPerfumeId).toList());

        return new TrendingPerfumesResponse(
                TRENDING_DAYS,
                rows.stream()
                        .map(row -> new TrendingPerfumeResponse(
                                row.getPerfumeId(),
                                row.getName(),
                                row.getBrand(),
                                thumbnails.get(row.getPerfumeId()),
                                row.getMentionCount()))
                        .toList()
        );
    }

    private Map<Long, String> loadThumbnails(List<Long> perfumeIds) {
        if (perfumeIds.isEmpty()) {
            return Map.of();
        }
        return perfumeImageRepository.findOrderedByPerfumeIds(perfumeIds)
                .stream()
                .filter(image -> image.imageUrl() != null)
                .collect(Collectors.toMap(
                        PerfumeImageUrl::perfumeId,
                        PerfumeImageUrl::imageUrl,
                        (first, ignored) -> first
                ));
    }
}
