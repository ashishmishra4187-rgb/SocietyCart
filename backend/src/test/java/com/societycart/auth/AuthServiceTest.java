package com.societycart.auth;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.common.ApiExceptions.ForbiddenException;
import com.societycart.common.ApiExceptions.TooManyRequestsException;
import com.societycart.common.ApiExceptions.UnauthorizedException;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.resident.ResidentService;
import com.societycart.domain.society.Society;
import com.societycart.dto.SignupRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

    private static final String PHONE = "9876543210";
    private static final String ADMIN_CODE = "SECRET-ADMIN";

    @Mock
    private OtpSender otpSender;
    @Mock
    private ResidentService residentService;

    private AuthService service;
    private Society society;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-10T10:00:00Z"), ZoneOffset.UTC);
        OtpService otp = new OtpService(clock, Duration.ofMinutes(5), Duration.ZERO, 5, 100, "123456");
        PendingRegistrations pending = new PendingRegistrations(clock, Duration.ofMinutes(5), 100);
        service = new AuthService(otp, otpSender, residentService, pending, ADMIN_CODE);

        society = new Society(UUID.randomUUID(), "Greenwood Heights", "GWH-01", "1 Park Rd", "Bengaluru",
                "Karnataka", "560001", 12.9, 77.6, 500.0, "Gate 2", true);
        when(residentService.requireSociety(society.getId())).thenReturn(society);
        when(residentService.findByPhone(PHONE)).thenReturn(Optional.empty());
        when(residentService.createResident(any(), any(), any(), any(), any()))
                .thenAnswer(inv -> new Resident(UUID.randomUUID(), inv.getArgument(2), inv.getArgument(0),
                        inv.getArgument(1), inv.getArgument(3), inv.getArgument(4)));
    }

    private SignupRequest signup(String role, String adminCode) {
        return new SignupRequest(PHONE, "  Asha   Rao ", society.getId(), "B-1204", role, adminCode);
    }

    private Resident existing(boolean active) {
        Resident r = new Resident(UUID.randomUUID(), society, PHONE, "Asha", "B-1", Resident.Role.RESIDENT);
        r.setActive(active);
        return r;
    }

    // ---------------------------------------------------------------- sign in

    @Test
    @DisplayName("Sign in for a number with no account says so, and sends nothing")
    void loginUnknownNumber() {
        NoSuchElementException e = assertThrows(NoSuchElementException.class, () -> service.requestLoginOtp(PHONE));
        assertTrue(e.getMessage().contains("create an account"));
        verify(otpSender, never()).send(any(), any());
    }

    @Test
    @DisplayName("Sign in for a deactivated account is refused")
    void loginInactive() {
        when(residentService.findByPhone(PHONE)).thenReturn(Optional.of(existing(false)));
        assertThrows(ForbiddenException.class, () -> service.requestLoginOtp(PHONE));
        verify(otpSender, never()).send(any(), any());
    }

    @Test
    @DisplayName("Sign in for an existing account sends a code, and verifying signs them in (not a new account)")
    void loginExisting() {
        Resident r = existing(true);
        when(residentService.findByPhone(PHONE)).thenReturn(Optional.of(r));

        service.requestLoginOtp(PHONE);
        verify(otpSender).send(PHONE, "123456");

        AuthService.AuthResult result = service.verify(PHONE, "123456");
        assertSame(r, result.resident());
        assertFalse(result.newAccount());
    }

    // ---------------------------------------------------------------- sign up

    @Test
    @DisplayName("Sign up for a number that already has an account is a conflict")
    void signupExistingAccount() {
        when(residentService.findByPhone(PHONE)).thenReturn(Optional.of(existing(true)));
        ConflictException e = assertThrows(ConflictException.class, () -> service.startSignup(signup("RESIDENT", null)));
        assertTrue(e.getMessage().contains("sign in"));
        verify(otpSender, never()).send(any(), any());
    }

    @Test
    @DisplayName("Sign up sends a code but creates NO account until the code is verified")
    void signupDefersAccountCreation() {
        service.startSignup(signup("RESIDENT", null));
        verify(otpSender).send(PHONE, "123456");
        verify(residentService, never()).createResident(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Verifying after sign up creates the account from the saved details and reports a new account")
    void signupThenVerify() {
        service.startSignup(signup("RESIDENT", null));

        AuthService.AuthResult result = service.verify(PHONE, "123456");

        verify(residentService).createResident(eq(PHONE), eq("Asha Rao"), eq(society), eq("B-1204"), eq(Resident.Role.RESIDENT));
        assertTrue(result.newAccount());
        assertEquals("Asha Rao", result.resident().getName(), "extra spaces are collapsed");
        assertEquals(Resident.Role.RESIDENT, result.resident().getRole());
    }

    @Test
    @DisplayName("A wrong code never creates the account")
    void wrongCodeNoAccount() {
        service.startSignup(signup("RESIDENT", null));
        assertThrows(UnauthorizedException.class, () -> service.verify(PHONE, "000000"));
        verify(residentService, never()).createResident(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("A verified code with no pending sign-up and no account is just invalid")
    void verifyWithoutSignup() {
        // Someone requests a login code for a real account, then the account vanishes: still a clean 401.
        Resident r = existing(true);
        when(residentService.findByPhone(PHONE)).thenReturn(Optional.of(r), Optional.empty());
        service.requestLoginOtp(PHONE);
        assertThrows(UnauthorizedException.class, () -> service.verify(PHONE, "123456"));
    }

    @Test
    @DisplayName("Too many wrong guesses locks the code (429)")
    void lockout() {
        service.startSignup(signup("RESIDENT", null));
        for (int i = 0; i < 4; i++) {
            assertThrows(UnauthorizedException.class, () -> service.verify(PHONE, "000000"));
        }
        assertThrows(TooManyRequestsException.class, () -> service.verify(PHONE, "000000"));
        assertThrows(TooManyRequestsException.class, () -> service.verify(PHONE, "123456"));
    }

    // ---------------------------------------------------------------- admin sign up

    @Test
    @DisplayName("Society admin sign-up needs the right admin code")
    void adminNeedsCode() {
        assertThrows(ForbiddenException.class, () -> service.startSignup(signup("SOCIETY_ADMIN", null)));
        assertThrows(ForbiddenException.class, () -> service.startSignup(signup("SOCIETY_ADMIN", "wrong")));
        verify(otpSender, never()).send(any(), any());
    }

    @Test
    @DisplayName("With the right admin code the new account becomes a society admin")
    void adminWithCode() {
        service.startSignup(signup("SOCIETY_ADMIN", ADMIN_CODE));
        AuthService.AuthResult result = service.verify(PHONE, "123456");
        assertEquals(Resident.Role.SOCIETY_ADMIN, result.resident().getRole());
        assertTrue(result.newAccount());
    }

    @Test
    @DisplayName("When no admin code is configured, admin sign-up is disabled entirely")
    void adminDisabledWithoutConfiguredCode() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-10T10:00:00Z"), ZoneOffset.UTC);
        AuthService noAdmin = new AuthService(new OtpService(clock, Duration.ofMinutes(5), Duration.ZERO, 5, 100, "123456"),
                otpSender, residentService, new PendingRegistrations(clock, Duration.ofMinutes(5), 100), "");
        assertThrows(ForbiddenException.class, () -> noAdmin.startSignup(signup("SOCIETY_ADMIN", "")));
        assertThrows(ForbiddenException.class, () -> noAdmin.startSignup(signup("SOCIETY_ADMIN", null)));
    }

    @Test
    @DisplayName("A residents sign-up ignores any admin code they send")
    void residentIgnoresAdminCode() {
        service.startSignup(signup("RESIDENT", ADMIN_CODE));
        AuthService.AuthResult result = service.verify(PHONE, "123456");
        assertEquals(Resident.Role.RESIDENT, result.resident().getRole());
    }
}
