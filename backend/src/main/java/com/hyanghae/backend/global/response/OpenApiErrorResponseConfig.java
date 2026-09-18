package com.hyanghae.backend.global.response;

import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.converter.ResolvedSchema;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 오류 응답의 스키마를 {@link ApiErrorResponse} 로 맞춥니다.
 *
 * <p><b>왜 필요한가</b>: {@code @ApiResponse} 에 {@code content} 를 적지 않으면 springdoc 이
 * 그 메서드의 <b>반환 타입</b>을 응답 스키마로 씁니다. 그래서 문서에는 404 도 성공 응답과 같은
 * 모양으로 나옵니다 — 예를 들어 {@code GET /notes/{noteId}/perfumes} 의 404 가
 * {@code PerfumeSearchResponse} 로 적힙니다. 실제로는 {@code ApiErrorResponse(code, message)}
 * 가 나가므로 문서가 구현과 다릅니다.
 *
 * <p>화면은 이 문서를 보고 오류 처리를 만듭니다. 틀린 모양을 적어 두면 그대로 잘못 만들어집니다.
 *
 * <p><b>왜 애너테이션마다 적지 않는가</b>: 그렇게 하려면 오류 응답 143곳에 같은
 * {@code content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))} 를
 * 붙여야 하고, 앞으로 추가되는 엔드포인트마다 빠뜨리기 쉽습니다. 여기서 한 번 채우면 새
 * 엔드포인트도 자동으로 맞습니다.
 *
 * <p>{@code auth/config/OpenApiSecurityConfig} 가 같은 방식으로 보안 요구사항을 채웁니다. 새
 * 구조가 아니라 이미 쓰고 있는 방식입니다.
 *
 * <p><b>설명은 건드리지 않습니다.</b> 각 {@code @ApiResponse} 가 적어 둔
 * {@code description}("향수 없음" 등)은 그대로 두고 {@code content} 만 채웁니다.
 */
@Configuration(proxyBeanMethods = false)
public class OpenApiErrorResponseConfig {

    private static final String SCHEMA_NAME = "ApiErrorResponse";
    private static final String SCHEMA_REF = "#/components/schemas/" + SCHEMA_NAME;

    @Bean
    OpenApiCustomizer errorResponseSchemas() {
        return openApi -> {
            registerSchema(openApi.getComponents());

            if (openApi.getPaths() == null) {
                return;
            }
            openApi.getPaths().values().forEach(pathItem ->
                    pathItem.readOperations().forEach(operation -> {
                        if (operation.getResponses() == null) {
                            return;
                        }
                        operation.getResponses().forEach(this::applyErrorSchema);
                    }));
        };
    }

    /**
     * 4xx · 5xx 만 바꿉니다. 2xx 는 각 엔드포인트가 제 응답 타입을 갖고 있고, {@code default}
     * 처럼 범위를 알 수 없는 코드는 오류라고 단정할 수 없어 그대로 둡니다.
     */
    private void applyErrorSchema(String code, ApiResponse response) {
        if (code == null || code.isEmpty()) {
            return;
        }
        char first = code.charAt(0);
        if (first != '4' && first != '5') {
            return;
        }
        response.setContent(new Content().addMediaType(
                org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                new MediaType().schema(new Schema<>().$ref(SCHEMA_REF))));
    }

    /**
     * 지금은 어떤 엔드포인트도 {@link ApiErrorResponse} 를 반환하지 않아 springdoc 이 이 스키마를
     * 만들지 않습니다. {@code $ref} 만 걸면 가리킬 곳이 없으므로 여기서 직접 넣습니다.
     *
     * <p>손으로 필드를 적지 않고 클래스에서 읽습니다. {@code ApiErrorResponse} 의 필드가 바뀌면
     * 문서도 따라 바뀌어야 합니다.
     */
    private void registerSchema(Components components) {
        if (components == null || components.getSchemas() != null
                && components.getSchemas().containsKey(SCHEMA_NAME)) {
            return;
        }
        ResolvedSchema resolved = ModelConverters.getInstance()
                .resolveAsResolvedSchema(new AnnotatedType(ApiErrorResponse.class));
        resolved.referencedSchemas.forEach(components::addSchemas);
    }
}
