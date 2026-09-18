package com.hyanghae.backend.recommendation.batch;

import com.hyanghae.backend.recommendation.repository.NlrRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 보관 기간이 지난 사용자 원문을 비웁니다.
 *
 * <p>비우는 것은 둘뿐입니다 — 사용자가 쓴 문장({@code raw_query})과 만족도에 딸린 한마디
 * ({@code comment}). 둘 다 사람이 직접 쓴 글이라 성질이 같고, 한쪽만 비우면 개인정보가 절반
 * 남습니다.
 *
 * <p><b>행을 지우지 않습니다.</b> {@code nlr_recommendations} 를 지우면 {@code ON DELETE
 * CASCADE} 로 결과 · 클릭 · 미매칭 · 만족도가 모두 함께 사라집니다. 사전을 키우는 데 필요한
 * {@code expression} 과 {@code normalized_key} 까지 없어집니다.
 *
 * <p><b>원문을 비워도 분석은 살아 있습니다.</b> 사전 확장에 필요한 것은 미매칭 표현이고, 원문은
 * 표본을 눈으로 볼 때 쓰는 것입니다. 만족도 지표의 본체인 {@code satisfaction} 도 그대로
 * 남습니다.
 */
@Service
public class NlrRetentionService {

    private static final Logger log = LoggerFactory.getLogger(NlrRetentionService.class);

    private final NlrRecordRepository repository;
    private final NlrRetentionProperties properties;

    public NlrRetentionService(
            NlrRecordRepository repository,
            NlrRetentionProperties properties
    ) {
        this.repository = repository;
        this.properties = properties;
    }

    /**
     * 한 번 돌립니다. 스케줄러가 부르고, 필요하면 손으로도 부를 수 있습니다.
     *
     * <p>둘을 한 트랜잭션에 둡니다. 원문만 비우고 한마디가 남으면 개인정보가 절반 남은 상태로
     * 굳는데, 다음 주기에 다시 잡히기는 하지만 그때까지 남습니다.
     *
     * <p>비운 줄 수를 남깁니다. <b>0 이 계속 나오면 확인이 필요합니다</b> — 보관 기간이 지난
     * 기록이 정말 없는 것일 수도 있고, 시계나 설정이 어긋난 것일 수도 있습니다.
     */
    @Transactional
    public void purge() {
        int days = properties.retentionDays();
        int queries = repository.purgeRawQueries(days);
        int comments = repository.purgeComments(days);

        log.info("자연어 추천 보관 기간 정리: {}일 지난 원문 {}건 · 한마디 {}건을 비웠습니다.",
                days, queries, comments);
    }
}
