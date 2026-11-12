package com.societycart.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/** Admin changes when an open pool closes. */
public record UpdatePoolRequest(
        @NotNull(message = "Closing time is required")
        Instant cutoffAt
) {
}
