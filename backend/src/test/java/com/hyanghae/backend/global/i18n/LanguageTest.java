package com.hyanghae.backend.global.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class LanguageTest {

    @AfterEach
    void tearDown() {
        LocaleContextHolder.resetLocaleContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void readsEnglishOnlyFromEnglishLanguageTags() {
        assertThat(Language.of(Locale.forLanguageTag("en"))).isEqualTo(Language.EN);
        assertThat(Language.of(Locale.forLanguageTag("en-US"))).isEqualTo(Language.EN);
        assertThat(Language.of(Locale.forLanguageTag("ko"))).isEqualTo(Language.KO);
        assertThat(Language.of(Locale.forLanguageTag("ja-JP"))).isEqualTo(Language.KO);
        assertThat(Language.of(null)).isEqualTo(Language.KO);
    }

    @Test
    void followsTheCurrentRequestLocale() {
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        assertThat(Language.current().isEnglish()).isTrue();

        LocaleContextHolder.setLocale(Locale.KOREAN);
        assertThat(Language.current().isEnglish()).isFalse();
    }

    /**
     * 헤더가 없는 요청은 LocaleResolver 가 서버 기본 로케일(여기서는 영어)을 넣어도 한국어입니다.
     * MockMvc 요청의 기본 로케일도 영어라 이 규칙이 없으면 헤더 없는 테스트가 영어가 됩니다.
     */
    @Test
    void treatsRequestWithoutLanguageHeaderAsKorean() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        LocaleContextHolder.setLocale(Locale.ENGLISH);

        assertThat(Language.current()).isEqualTo(Language.KO);

        request.addHeader("Accept-Language", "en");
        assertThat(Language.current()).isEqualTo(Language.EN);
    }

    /** 요청 밖에서 로케일 문맥이 없으면 JVM 기본 로케일과 상관없이 한국어입니다. */
    @Test
    void isKoreanOutsideRequests() {
        LocaleContextHolder.resetLocaleContext();

        assertThat(Language.current()).isEqualTo(Language.KO);
    }
}
