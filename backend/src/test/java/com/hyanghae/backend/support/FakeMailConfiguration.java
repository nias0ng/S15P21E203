package com.hyanghae.backend.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration(proxyBeanMethods = false)
public class FakeMailConfiguration {

    @Bean
    @Primary
    FakeEmailVerificationMailSender fakeEmailVerificationMailSender() {
        return new FakeEmailVerificationMailSender();
    }
}
