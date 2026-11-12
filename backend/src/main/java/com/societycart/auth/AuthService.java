package com.societycart.auth;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.common.ApiExceptions.ForbiddenException;
import com.societycart.common.ApiExceptions.TooManyRequestsException;
import com.societycart.common.ApiExceptions.UnauthorizedException;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.resident.ResidentService;
import com.societycart.domain.society.Society;
import com.societycart.dto.SignupRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.NoSuchElementException;

/**
 * Two ways in, both proven with an OTP:
 * <ul>
 *   <li><b>Sign in</b>: the number must already belong to an account.</li>
 *   <li><b>Sign up</b>: name, society and flat are held aside until the OTP is verified, then the account is created.
 *       Society admins additionally need the admin code issued by the platform.</li>
 * </ul>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String GENERIC_INVALID = "Invalid or expired code. Please try again.";

    /** Result of a successful verification. */
    public record AuthResult(Resident resident, boolean newAccount) {
    }

    private final OtpService otpService;
    private final OtpSender otpSender;
    private final ResidentService residentService;
    private final PendingRegistrations pendingRegistrations;
    private final String adminSignupCode;

    public AuthService(OtpService otpService,
                       OtpSender otpSender,
                       ResidentService residentService,
                       PendingRegistrations pendingRegistrations,
                       @Value("${societycart.auth.admin-signup-code:}") String adminSignupCode) {
        this.otpService = otpService;
        this.otpSender = otpSender;
        this.residentService = residentService;
        this.pendingRegistrations = pendingRegistrations;
        this.adminSignupCode = adminSignupCode == null ? "" : adminSignupCode.trim();
    }

    /** Sign in, step 1: send a code to a number that already has an account. */
    public void requestLoginOtp(String phone) {
        Resident resident = residentService.findByPhone(phone)
                .orElseThrow(() -> new NoSuchElementException("No account found for this number. Please create an account."));
        if (!resident.isActive()) {
            throw new ForbiddenException("This account has been deactivated. Please contact your society admin.");
        }
        issueAndSend(phone);
    }

    /** Sign up, step 1: validate, remember the details, and send a code. No account exists yet. */
    public void startSignup(SignupRequest request) {
        String phone = request.phone();
        if (residentService.findByPhone(phone).isPresent()) {
            throw new ConflictException("An account already exists for this number. Please sign in instead.");
        }
        Society society = residentService.requireSociety(request.societyId());

        if ("SOCIETY_ADMIN".equals(request.role())) {
            if (adminSignupCode.isEmpty()) {
                throw new ForbiddenException("Society admin sign-up is not enabled. Please contact the platform team.");
            }
            if (!constantTimeEquals(adminSignupCode, request.adminCode())) {
                throw new ForbiddenException("That admin code is not valid.");
            }
        }

        // Send the code first: if we are rate limited, nothing is stored.
        issueAndSend(phone);
        pendingRegistrations.put(phone, new PendingRegistrations.Registration(
                request.name().trim().replaceAll("\\s+", " "),
                society.getId(),
                request.flatNumber().trim(),
                request.role()));
    }

    /** Step 2 for both flows: check the code, then sign in (creating the account first for a new sign-up). */
    public AuthResult verify(String phone, String code) {
        OtpService.VerifyResult result = otpService.verify(phone, code);
        switch (result) {
            case OK:
                break;
            case LOCKED:
                throw new TooManyRequestsException("Too many incorrect attempts. Request a new code.", 60);
            default:
                throw new UnauthorizedException(GENERIC_INVALID);
        }

        Resident existing = residentService.findByPhone(phone).orElse(null);
        if (existing != null) {
            if (!existing.isActive()) {
                throw new UnauthorizedException(GENERIC_INVALID);
            }
            return new AuthResult(existing, false);
        }

        PendingRegistrations.Registration registration = pendingRegistrations.take(phone)
                .orElseThrow(() -> new UnauthorizedException(GENERIC_INVALID));
        Society society = residentService.requireSociety(registration.societyId());
        Resident created = residentService.createResident(
                phone, registration.name(), society, registration.flatNumber(), Resident.Role.valueOf(registration.role()));
        return new AuthResult(created, true);
    }

    private void issueAndSend(String phone) {
        final String code;
        try {
            code = otpService.issue(phone);
        } catch (OtpService.OtpRateLimitException e) {
            throw new TooManyRequestsException(
                    "Please wait " + e.retryAfterSeconds() + "s before requesting another code.", e.retryAfterSeconds());
        }
        otpSender.send(phone, code);
        log.debug("OTP sent to {}", ResidentService.mask(phone));
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = (actual == null ? "" : actual.trim()).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }
}
