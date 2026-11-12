package com.societycart.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 60, message = "Name is too long")
        String name,

        @Pattern(regexp = "^$|^[A-Za-z0-9][A-Za-z0-9\\-/ ]{0,19}$", message = "Flat number may contain letters, numbers, dash or slash (max 20)")
        String flatNumber
) {
}
