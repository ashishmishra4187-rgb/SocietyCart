package com.societycart.dto;

import java.util.UUID;

/** Public-facing society summary (no coordinates, no gate notes). */
public record SocietyView(UUID id, String name, String city, String joinCode) {
}
