package com.hyanghae.backend.perfume.service;

/**
 * 배치 한 번의 결과입니다. 실행 로그와 테스트가 씁니다.
 *
 * @param targets    정책 조건을 넘겨 이번 실행이 집어 든 향수 수입니다.
 * @param summarized 요약을 적재한 향수 수입니다.
 * @param skipped    보낼 후기 본문이 없거나 응답에 요약이 없어 적재하지 않은 향수 수입니다.
 * @param failed     호출이나 적재가 예외로 끝난 향수 수입니다. 다음 실행에서 다시 시도됩니다.
 */
public record ReviewAnalysisBatchResult(int targets, int summarized, int skipped, int failed) {
}
