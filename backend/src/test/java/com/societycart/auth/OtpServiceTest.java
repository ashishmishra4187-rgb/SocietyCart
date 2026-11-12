package com.societycart.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class OtpServiceTest {

    /** Clock the test can move forward. */
    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-10T10:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private static final String PHONE = "9876543210";

    private MutableClock clock;
    private OtpService otp;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        otp = new OtpService(clock, Duration.ofMinutes(5), Duration.ofSeconds(30), 5, 3, "");
    }

    @Test
    @DisplayName("A freshly issued six-digit code verifies exactly once")
    void codeWorksOnce() {
        String code = otp.issue(PHONE);
        assertTrue(code.matches("\\d{6}"));
        assertEquals(OtpService.VerifyResult.OK, otp.verify(PHONE, code));
        assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, code), "code must be single use");
    }

    @Test
    @DisplayName("A wrong code is rejected and a code for another phone does not work")
    void wrongCodeRejected() {
        String code = otp.issue(PHONE);
        String wrong = code.equals("000000") ? "111111" : "000000";
        assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, wrong));
        assertEquals(OtpService.VerifyResult.INVALID, otp.verify("9123456780", code));
        assertEquals(OtpService.VerifyResult.OK, otp.verify(PHONE, code), "wrong guesses must not burn the real code");
    }

    @Test
    @DisplayName("Code expires after the TTL")
    void codeExpires() {
        String code = otp.issue(PHONE);
        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        assertEquals(OtpService.VerifyResult.EXPIRED, otp.verify(PHONE, code));
    }

    @Test
    @DisplayName("After too many wrong guesses even the correct code is refused")
    void lockoutAfterMaxAttempts() {
        String code = otp.issue(PHONE);
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 4; i++) {
            assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, wrong));
        }
        assertEquals(OtpService.VerifyResult.LOCKED, otp.verify(PHONE, wrong), "5th wrong guess locks");
        assertEquals(OtpService.VerifyResult.LOCKED, otp.verify(PHONE, code), "correct code no longer accepted");
    }

    @Test
    @DisplayName("Requesting a new code resets the lockout and invalidates the old code")
    void newCodeReplacesOld() {
        String first = otp.issue(PHONE);
        clock.advance(Duration.ofSeconds(31));
        String second = otp.issue(PHONE);
        if (!first.equals(second)) {
            assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, first));
        }
        assertEquals(OtpService.VerifyResult.OK, otp.verify(PHONE, second));
    }

    @Test
    @DisplayName("Resend cool-down: a second request inside 30s is rate limited with a retry hint")
    void resendCooldown() {
        otp.issue(PHONE);
        clock.advance(Duration.ofSeconds(10));
        OtpService.OtpRateLimitException e = assertThrows(OtpService.OtpRateLimitException.class, () -> otp.issue(PHONE));
        assertTrue(e.retryAfterSeconds() >= 1 && e.retryAfterSeconds() <= 20, "retry hint was " + e.retryAfterSeconds());
        clock.advance(Duration.ofSeconds(21));
        assertNotNull(otp.issue(PHONE));
    }

    @Test
    @DisplayName("Hourly cap: the 4th request within an hour is refused, then allowed after the window")
    void hourlyCap() {
        for (int i = 0; i < 3; i++) {
            otp.issue(PHONE);
            clock.advance(Duration.ofSeconds(31));
        }
        assertThrows(OtpService.OtpRateLimitException.class, () -> otp.issue(PHONE));
        clock.advance(Duration.ofHours(1));
        assertNotNull(otp.issue(PHONE));
    }

    @Test
    @DisplayName("Limits are per phone number")
    void limitsArePerPhone() {
        otp.issue(PHONE);
        assertNotNull(otp.issue("9123456780"));
    }

    @Test
    @DisplayName("A configured fixed code (dev only) is returned and verifies")
    void fixedCode() {
        OtpService dev = new OtpService(clock, Duration.ofMinutes(5), Duration.ZERO, 5, 100, "123456");
        assertEquals("123456", dev.issue(PHONE));
        assertEquals(OtpService.VerifyResult.INVALID, dev.verify(PHONE, "654321"));
        assertEquals(OtpService.VerifyResult.OK, dev.verify(PHONE, "123456"));
    }

    @Test
    @DisplayName("Verifying without ever requesting a code, or with null, is just invalid")
    void noChallenge() {
        assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, "123456"));
        otp.issue(PHONE);
        assertEquals(OtpService.VerifyResult.INVALID, otp.verify(PHONE, null));
    }

    @Test
    @DisplayName("Concurrent wrong guesses never exceed the attempt budget")
    void concurrentGuessesAreCounted() throws Exception {
        String code = otp.issue(PHONE);
        String wrong = code.equals("000000") ? "111111" : "000000";
        Thread[] threads = new Thread[20];
        for (int i = 0; i < threads.length; i++) {
            threads[i] = new Thread(() -> otp.verify(PHONE, wrong));
            threads[i].start();
        }
        for (Thread t : threads) {
            t.join();
        }
        assertEquals(OtpService.VerifyResult.LOCKED, otp.verify(PHONE, code),
                "20 parallel wrong guesses must have locked the challenge");
    }
}
