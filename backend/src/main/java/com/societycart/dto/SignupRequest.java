package com.societycart.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Create-account request. The account only exists after the phone is verified with an OTP. */
public record SignupRequest(
        @NotBlank(message = "Phone number is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
        String phone,

        @NotBlank(message = "Full name is required")
        @Size(min = 2, max = 60, message = "Name must be 2-60 characters")
        @Pattern(regexp = "^\\p{L}[\\p{L} .'-]*$", message = "Name may contain letters, spaces, dots, apostrophes and dashes")
        String name,

        @NotNull(message = "Choose your society")
        UUID societyId,

        @NotBlank(message = "Flat number is required")
        @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9\\-/ ]{0,19}$", message = "Flat number may contain letters, numbers, dash or slash (max 20)")
        String flatNumber,

        @NotBlank(message = "Choose an account type")
        @Pattern(regexp = "^(RESIDENT|SOCIETY_ADMIN)$", message = "Account type must be Resident or Society admin")
        String role,

        /** Only needed for SOCIETY_ADMIN. Issued to society administrators by the platform. */
        @Size(max = 100)
        String adminCode
) {
}
