package com.societycart.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * One-time-password issuing and verification. Deliberately framework-free so it is easy to test.
 *
 * <ul>
 *   <li>Codes are never stored: only an HMAC (random per-process key) of phone+code is kept.</li>
 *   <li>Short TTL, a resend cool-down, an hourly cap per phone and a max number of wrong guesses.</li>
 *   <li>A correct code is consumed (single use).</li>
 * </ul>
 *
 * State is in memory, so this is correct for a single instance only. For several instances, back the
 * two maps with Redis or a database table (same logic).
 */
public class OtpService {

    public enum VerifyResult { OK, INVALID, EXPIRED, LOCKED }

    public static class OtpRateLimitException extends RuntimeException {
        private final long retryAfterSeconds;

        public OtpRateLimitException(long retryAfterSeconds) {
            super("Rate limited, retry in " + retryAfterSeconds + "s");
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public long retryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    private record Challenge(byte[] digest, Instant expiresAt, int attempts) {
    }

    private static final Duration HOUR = Duration.ofHours(1);

    private final Clock clock;
    private final Duration ttl;
    private final Duration cooldown;
    private final int maxAttempts;
    private final int maxSendsPerHour;
    private final String fixedOtp;

    private final SecureRandom random = new SecureRandom();
    private final byte[] hmacKey = new byte[32];
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> sendLog = new ConcurrentHashMap<>();

    public OtpService(Clock clock, Duration ttl, Duration cooldown, int maxAttempts, int maxSendsPerHour, String fixedOtp) {
        this.clock = clock;
        this.ttl = ttl;
        this.cooldown = cooldown;
        this.maxAttempts = maxAttempts;
        this.maxSendsPerHour = maxSendsPerHour;
        this.fixedOtp = fixedOtp == null ? "" : fixedOtp.trim();
        random.nextBytes(hmacKey);
    }

    /** Creates a new challenge for the phone and returns the plain code so the caller can send it. */
    public String issue(String phone) {
        Instant now = clock.instant();
        purgeExpired(now);

        Deque<Instant> sends = sendLog.computeIfAbsent(phone, k -> new ArrayDeque<>());
        synchronized (sends) {
            Instant windowStart = now.minus(HOUR);
            while (!sends.isEmpty() && sends.peekFirst().isBefore(windowStart)) {
                sends.pollFirst();
            }
            if (!sends.isEmpty()) {
                Duration remaining = cooldown.minus(Duration.between(sends.peekLast(), now));
                if (!remaining.isNegative() && !remaining.isZero()) {
                    throw new OtpRateLimitException(Math.max(1, remaining.toSeconds()));
                }
            }
            if (sends.size() >= maxSendsPerHour) {
                long wait = Duration.between(now, sends.peekFirst().plus(HOUR)).toSeconds() + 1;
                throw new OtpRateLimitException(Math.max(1, wait));
            }
            sends.addLast(now);
        }

        String code = fixedOtp.isEmpty() ? randomCode() : fixedOtp;
        challenges.put(phone, new Challenge(digest(phone, code), now.plus(ttl), 0));
        return code;
    }

    /** Checks a code. A correct code is consumed; wrong guesses are counted and eventually lock the challenge. */
    public VerifyResult verify(String phone, String code) {
        Instant now = clock.instant();
        AtomicReference<VerifyResult> result = new AtomicReference<>(VerifyResult.INVALID);
        byte[] attempt = digest(phone, code == null ? "" : code);

        challenges.compute(phone, (k, c) -> {
            if (c == null) {
                result.set(VerifyResult.INVALID);
                return null;
            }
            if (now.isAfter(c.expiresAt())) {
                result.set(VerifyResult.EXPIRED);
                return null;
            }
            if (c.attempts() >= maxAttempts) {
                result.set(VerifyResult.LOCKED);
                return c;
            }
            if (MessageDigest.isEqual(c.digest(), attempt)) {
                result.set(VerifyResult.OK);
                return null;
            }
            Challenge next = new Challenge(c.digest(), c.expiresAt(), c.attempts() + 1);
            result.set(next.attempts() >= maxAttempts ? VerifyResult.LOCKED : VerifyResult.INVALID);
            return next;
        });
        return result.get();
    }

    private String randomCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private byte[] digest(String phone, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacKey, "HmacSHA256"));
            return mac.doFinal((phone + ":" + code).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    private void purgeExpired(Instant now) {
        challenges.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        Instant windowStart = now.minus(HOUR);
        sendLog.entrySet().removeIf(e -> {
            Deque<Instant> d = e.getValue();
            synchronized (d) {
                return d.isEmpty() || d.peekLast().isBefore(windowStart);
            }
        });
    }
}
