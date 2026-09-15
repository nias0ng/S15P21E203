package com.hyanghae.backend.auth.service;

import java.time.Instant;

public record IssuedRefreshToken(String value, Instant expiresAt) {
}
