package com.hyanghae.backend.global.i18n;

import java.util.Locale;
import org.springframework.context.i18n.LocaleContextHolder;

/**
 * 응답 데이터의 언어입니다. 화면이 요청마다 {@code Accept-Language} 로 {@code ko} 또는 {@code en} 을 보냅니다.
 *
 * <p>한국어가 기본입니다. 영어로 시작하는 언어 태그만 영어로 보고, 헤더가 없거나 다른 언어면 한국어입니다.
 * 영어 데이터가 비어 있는 곳은 부르는 쪽이 한국어로 되돌아갑니다.
 */
public enum Language {
    KO,
    EN;

    /** 지금 요청의 언어입니다. 요청 밖(배치 · 스케줄러)에서는 한국어입니다. */
    public static Language current() {
        return of(LocaleContextHolder.getLocale());
    }

    public static Language of(Locale locale) {
        if (locale == null) {
            return KO;
        }
        return "en".equalsIgnoreCase(locale.getLanguage()) ? EN : KO;
    }

    public boolean isEnglish() {
        return this == EN;
    }
}
