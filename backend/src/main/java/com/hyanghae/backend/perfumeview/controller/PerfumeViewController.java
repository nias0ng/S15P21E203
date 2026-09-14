package com.hyanghae.backend.perfumeview.controller;

import com.hyanghae.backend.perfumeview.dto.request.PerfumeViewStartRequest;
import com.hyanghae.backend.perfumeview.dto.response.PerfumeViewExitResponse;
import com.hyanghae.backend.perfumeview.dto.response.PerfumeViewStartResponse;
import com.hyanghae.backend.perfumeview.service.PerfumeViewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "향수 상세 조회 기록", description = "향수 상세 화면의 조회 시작과 체류 시간을 기록합니다.")
@RestController
@RequestMapping("/api/v1/perfume-views")
public class PerfumeViewController {

    private final PerfumeViewService perfumeViewService;

    public PerfumeViewController(PerfumeViewService perfumeViewService) {
        this.perfumeViewService = perfumeViewService;
    }

    @Operation(
            summary = "향수 상세 조회 기록 시작",
            description = "상세 화면에 들어온 시각과 유입 경로를 기록합니다."
    )
    @ApiResponse(responseCode = "201", description = "조회 시작 기록 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 요청")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "향수 또는 유입 경로 향수 없음")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PerfumeViewStartResponse start(
            @Valid @RequestBody PerfumeViewStartRequest request
    ) {
        return perfumeViewService.start(request);
    }

    @Operation(
            summary = "향수 상세 조회 기록 종료",
            description = "서버 시각으로 조회를 종료하고 체류 시간을 초 단위로 계산합니다."
    )
    @ApiResponse(responseCode = "200", description = "조회 종료 기록 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "본인의 조회 기록 없음")
    @PatchMapping("/{perfumeViewId}/exit")
    public PerfumeViewExitResponse exit(
            @Parameter(
                    name = "perfumeViewId",
                    description = "향수 상세 조회 기록 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long perfumeViewId
    ) {
        return perfumeViewService.exit(perfumeViewId);
    }
}
