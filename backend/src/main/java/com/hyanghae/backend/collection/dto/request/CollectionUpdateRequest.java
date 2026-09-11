package com.hyanghae.backend.collection.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

public class CollectionUpdateRequest {
    private String name;
    private String description;
    private boolean namePresent;
    private boolean descriptionPresent;

    public void setName(String name) {
        this.name = name;
        this.namePresent = true;
    }

    public void setDescription(String description) {
        this.description = description;
        this.descriptionPresent = true;
    }

    @Schema(description = "생략 시 유지. null 또는 공백은 불가", maxLength = 50)
    @Size(max = 50)
    public String getName() { return name; }

    @Schema(description = "생략 시 유지. null 또는 공백이면 설명 삭제", maxLength = 300, nullable = true)
    @Size(max = 300)
    public String getDescription() { return description; }

    @JsonIgnore
    public boolean isNamePresent() { return namePresent; }
    @JsonIgnore
    public boolean isDescriptionPresent() { return descriptionPresent; }

    @JsonIgnore
    @AssertTrue(message = "수정할 값이 필요하며 이름은 비어 있을 수 없습니다.")
    public boolean isValidPatch() {
        return (namePresent || descriptionPresent)
                && (!namePresent || (name != null && !name.isBlank()));
    }
}
