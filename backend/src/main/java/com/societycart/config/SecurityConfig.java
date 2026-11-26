package com.societycart.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.boot.autoconfigure.security.servlet.PathRequest;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher;

/**
 * Security model:
 * <ul>
 *   <li>Sign-in is phone + OTP; the session id lives in an httpOnly SameSite=Lax cookie.</li>
 *   <li>Everything under /api (and the WebSocket handshake) requires a session, except the login endpoints.</li>
 *   <li>/api/admin/** needs SOCIETY_ADMIN; creating societies needs PLATFORM_ADMIN.</li>
 *   <li>CSRF: double-submit cookie. The SPA reads the XSRF-TOKEN cookie and echoes it in X-XSRF-TOKEN
 *       (axios does this automatically). Login endpoints are exempt because there is no session yet.</li>
 *   <li>CORS is limited to the configured web origins (no wildcard) and allows credentials.</li>
 * </ul>
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain apiSecurity(HttpSecurity http, SecurityContextRepository securityContextRepository) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                        .ignoringRequestMatchers(
                                antMatcher(HttpMethod.POST, "/api/auth/otp"),
                                antMatcher(HttpMethod.POST, "/api/auth/signup"),
                                antMatcher(HttpMethod.POST, "/api/auth/verify")))
                .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
                .securityContext(ctx -> ctx.securityContextRepository(securityContextRepository))
                .sessionManagement(s -> s
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(f -> f.changeSessionId()))
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                // Explicit Ant matchers (not requestMatchers(String)) so the rules behave identically in every
                // profile: with a second servlet present (H2 console) Spring Security refuses to guess.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(antMatcher("/error")).permitAll()
                        .requestMatchers(post("/api/auth/otp"), post("/api/auth/signup"), post("/api/auth/verify"), post("/api/auth/logout")).permitAll()
                        .requestMatchers(antMatcher(HttpMethod.GET, "/api/auth/societies")).permitAll()
                        .requestMatchers(antMatcher("/api/shopkeeper/**")).hasRole("SHOPKEEPER")
                        .requestMatchers(antMatcher("/api/admin/**")).hasAnyRole("SOCIETY_ADMIN", "PLATFORM_ADMIN")
                        .requestMatchers(post("/api/societies")).hasRole("PLATFORM_ADMIN")
                        .requestMatchers(antMatcher("/api/societies/nearby")).hasRole("PLATFORM_ADMIN")
                        .anyRequest().authenticated());
        return http.build();
    }

    private static RequestMatcher post(String pattern) {
        return antMatcher(HttpMethod.POST, pattern);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${societycart.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Idempotency-Key", "X-XSRF-TOKEN", "X-Requested-With"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /** The H2 console (h2 profile only) needs frames and no CSRF; it is never exposed otherwise. */
    @Bean
    @Order(1)
    @Profile("h2")
    public SecurityFilterChain h2ConsoleSecurity(HttpSecurity http) throws Exception {
        http.securityMatcher(PathRequest.toH2Console())
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(AbstractHttpConfigurer::disable)
                .headers(h -> h.frameOptions(f -> f.sameOrigin()));
        return http.build();
    }
}
