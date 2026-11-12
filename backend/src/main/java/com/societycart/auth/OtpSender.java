package com.societycart.auth;

/**
 * Delivers an OTP to a phone. Production needs a real implementation (SMS / WhatsApp provider).
 */
public interface OtpSender {
    void send(String phone, String code);
}
