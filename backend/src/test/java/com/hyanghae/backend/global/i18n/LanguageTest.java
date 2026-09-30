package com.hyanghae.backend.global.i18n;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

class LanguageTest {

    @AfterEach
    void tearDown() {
        LocaleContextHolder.resetLocaleContext();
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
}
