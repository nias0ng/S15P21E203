package com.hyanghae.backend.shelf.controller;

import com.hyanghae.backend.shelf.dto.request.FitRatingRequest;
import com.hyanghae.backend.shelf.dto.response.FitRatingResponse;
import com.hyanghae.backend.shelf.service.FitRatingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "진열대 취향 적합도", description = "진열대 향수의 취향 적합도를 관리합니다.")
@RestController
@RequestMapping("/api/v1/users/me/perfumes/{userPerfumeId}/fit-rating")
public class FitRatingController {

    private final FitRatingService fitRatingService;

    public FitRatingController(FitRatingService fitRatingService) {
        this.fitRatingService = fitRatingService;
    }

    @Operation(summary = "취향 적합도 등록·수정")
    @ApiResponse(responseCode = "200", description = "등록·수정 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 취향 적합도")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PutMapping
    public FitRatingResponse update(
            @Parameter(
                    name = "userPerfumeId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long userPerfumeId,
            @Valid @RequestBody FitRatingRequest request
    ) {
        return fitRatingService.update(userPerfumeId, request.fitRating());
    }

    @Operation(summary = "취향 적합도 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @Parameter(
                    name = "userPerfumeId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long userPerfumeId
    ) {
        fitRatingService.delete(userPerfumeId);
    }
}
