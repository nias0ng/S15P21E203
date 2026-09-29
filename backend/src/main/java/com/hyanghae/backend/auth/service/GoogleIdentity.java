package com.hyanghae.backend.auth.service;

/**
 * 검증을 마친 Google ID 토큰에서 꺼낸 값입니다.
 *
 * @param subject Google 계정마다 바뀌지 않는 식별자({@code sub}). 사람을 찾을 때 씁니다
 * @param email   소문자로 다듬은 이메일. Google 이 인증을 마친 주소만 들어옵니다
 * @param name    Google 프로필 이름. 닉네임 추천에만 쓰고, 없을 수 있습니다
 */
public record GoogleIdentity(String subject, String email, String name) {
}
