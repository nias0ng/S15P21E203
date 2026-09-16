package com.hyanghae.backend.recommendation.client;

/**
 * AI 서버의 {@code POST /nlr/recommend} 요청입니다.
 *
 * <p><b>{@code structured} 를 보내지 않습니다.</b> 계약서가 정한 선택 칸인데, 비워 두면 AI
 * 서버가 ①단계 LLM 구조화를 스스로 부릅니다. 백엔드가 문장만 넘기면 되는 이유입니다.
 * 프롬프트를 고칠 때 이쪽을 다시 배포하지 않아도 됩니다.
 *
 * <p>칸 이름이 {@code conditions} 가 아니라 {@code structured} 인 것은 AI 응답에도
 * {@code conditions} 가 있는데 모양이 다르기 때문입니다. 응답의 것을 요청에 되돌려 넣으면
 * AI 서버가 400 을 냅니다. 여기서는 아예 보내지 않으므로 그 사고가 생기지 않습니다.
 *
 * @param text 사용자가 쓴 문장 그대로입니다. AI 서버도 1~500자만 받습니다.
 * @param topK 몇 개까지 받을지입니다. 1~20 입니다.
 */
record NlrRecommendRequest(String text, int topK) {
}
