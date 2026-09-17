package com.hyanghae.backend.perfume.dto.response;

import java.math.BigDecimal;

/** 향수의 어코드 한 건입니다. {@code rank} 가 작을수록 두드러지는 어코드입니다. */
public record PerfumeAccordResponse(Long accordId, String name, Integer rank, BigDecimal weight) {
}
