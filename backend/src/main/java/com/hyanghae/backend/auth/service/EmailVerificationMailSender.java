package com.hyanghae.backend.auth.service;

import com.hyanghae.backend.global.i18n.Language;

/**
 * 인증번호 메일을 보냅니다. 보내지 못하면 {@link org.springframework.mail.MailException} 을 던집니다.
 *
 * <p>인터페이스로 둔 것은 통합 테스트가 실제 SMTP 없이 보낸 번호를 읽어야 하기 때문입니다.
 *
 * <p>언어는 부르는 쪽이 정해 넘깁니다. 보내는 쪽이 요청 문맥을 직접 읽지 않아야 요청 밖에서
 * 불려도 같은 결과가 나옵니다.
 */
public interface EmailVerificationMailSender {

    void send(String email, String code, Language language);
}
