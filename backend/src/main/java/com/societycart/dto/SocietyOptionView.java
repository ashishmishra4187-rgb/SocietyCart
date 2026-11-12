package com.societycart.dto;

import java.util.UUID;

/** Minimal society info for the sign-up dropdown (no join code, no coordinates). */
public record SocietyOptionView(UUID id, String name, String city) {
}
