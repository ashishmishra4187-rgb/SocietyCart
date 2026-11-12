package com.societycart.dto;

import java.time.Instant;

/** Uniform error body. The frontend reads {@code message}. */
public record ErrorResponse(Instant timestamp, int status, String error, String message) {
}
