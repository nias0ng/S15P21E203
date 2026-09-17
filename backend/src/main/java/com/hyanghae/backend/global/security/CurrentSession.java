package com.hyanghae.backend.global.security;

import java.util.Optional;

public interface CurrentSession {

    Optional<String> id();
}
