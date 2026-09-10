package com.hyanghae.backend.shelf.controller;

import com.hyanghae.backend.shelf.dto.request.FitRatingRequest;
import com.hyanghae.backend.shelf.dto.request.RepresentativeRequest;
import com.hyanghae.backend.shelf.dto.response.FitRatingResponse;
import com.hyanghae.backend.shelf.dto.response.RepresentativeResponse;
import com.hyanghae.backend.shelf.service.FitRatingService;
import com.hyanghae.backend.shelf.service.RepresentativePerfumeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "진열대 항목", description = "사용자의 진열대 항목을 관리합니다.")
@RestController
@RequestMapping("/api/v1/users/me/shelf-items")
public class ShelfItemController {

    private final FitRatingService fitRatingService;
    private final RepresentativePerfumeService representativePerfumeService;

    public ShelfItemController(
            FitRatingService fitRatingService,
            RepresentativePerfumeService representativePerfumeService
    ) {
        this.fitRatingService = fitRatingService;
        this.representativePerfumeService = representativePerfumeService;
    }

    @Operation(summary = "취향 적합도 등록·수정")
    @ApiResponse(responseCode = "200", description = "등록·수정 성공")
    @ApiResponse(responseCode = "400", description = "올바르지 않은 취향 적합도")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PutMapping("/{shelfItemId}/fit-rating")
    public FitRatingResponse updateFitRating(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId,
            @Valid @RequestBody FitRatingRequest request
    ) {
        return fitRatingService.update(shelfItemId, request.fitRating());
    }

    @Operation(summary = "취향 적합도 삭제")
    @ApiResponse(responseCode = "204", description = "삭제 성공")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @DeleteMapping("/{shelfItemId}/fit-rating")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFitRating(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId
    ) {
        fitRatingService.delete(shelfItemId);
    }

    @Operation(
            summary = "대표 향수 지정·해제",
            description = "true이면 기존 대표 향수를 해제하고 선택한 보유 향수를 대표로 지정합니다. "
                    + "false이면 선택한 향수의 대표 지정을 해제합니다."
    )
    @ApiResponse(responseCode = "200", description = "대표 향수 변경 성공")
    @ApiResponse(responseCode = "400", description = "대표로 지정할 수 없는 진열대 항목")
    @ApiResponse(responseCode = "401", description = "로그인 필요")
    @ApiResponse(responseCode = "404", description = "진열대 항목 없음")
    @PatchMapping("/{shelfItemId}/representative")
    public RepresentativeResponse updateRepresentative(
            @Parameter(
                    name = "shelfItemId",
                    description = "사용자 진열대 항목 ID",
                    in = ParameterIn.PATH,
                    required = true,
                    schema = @Schema(type = "integer", format = "int64")
            )
            @PathVariable Long shelfItemId,
            @Valid @RequestBody RepresentativeRequest request
    ) {
        return representativePerfumeService.update(
                shelfItemId,
                request.representative()
        );
    }
}
