package com.societycart.web;

import com.societycart.auth.AuthService;
import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.resident.Resident;
import com.societycart.dto.OtpRequest;
import com.societycart.dto.SignupRequest;
import com.societycart.dto.SocietyOptionView;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.VerifyOtpRequest;
import com.societycart.dto.VerifyResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

/**
 * Phone + OTP sign-in. A successful verify creates a server-side session whose id travels in an
 * httpOnly, SameSite=Lax cookie, so no credential is ever readable by JavaScript.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final ResidentService residentService;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(AuthService authService,
                          ResidentService residentService,
                          SecurityContextRepository securityContextRepository) {
        this.authService = authService;
        this.residentService = residentService;
        this.securityContextRepository = securityContextRepository;
    }

    /** Societies a new resident can choose from while creating an account (public, minimal fields). */
    @GetMapping("/societies")
    public List<SocietyOptionView> societies() {
        return residentService.listActiveSocieties().stream()
                .map(s -> new SocietyOptionView(s.getId(), s.getName(), s.getCity()))
                .toList();
    }

    /** Sign in, step 1: only for numbers that already have an account. */
    @PostMapping("/otp")
    public ResponseEntity<Void> requestOtp(@Valid @RequestBody OtpRequest body) {
        authService.requestLoginOtp(body.phone());
        return ResponseEntity.noContent().build();
    }

    /** Sign up, step 1: details are held until the phone is verified. */
    @PostMapping("/signup")
    public ResponseEntity<Void> signup(@Valid @RequestBody SignupRequest body) {
        authService.startSignup(body);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/verify")
    public VerifyResponse verify(@Valid @RequestBody VerifyOtpRequest body,
                                 HttpServletRequest request,
                                 HttpServletResponse response) {
        AuthService.AuthResult result = authService.verify(body.phone(), body.otp());
        Resident resident = result.resident();
        establishSession(resident, request, response);
        return new VerifyResponse(
                resident.getId(),
                resident.getSociety().getId(),
                resident.getFlatNumber() == null ? "" : resident.getFlatNumber(),
                resident.getRole().name(),
                resident.getName() == null ? "" : resident.getName(),
                result.newAccount());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return ResponseEntity.noContent().build();
    }

    private void establishSession(Resident resident, HttpServletRequest request, HttpServletResponse response) {
        // Session-fixation defence: never reuse a pre-login session id.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        AuthenticatedResident principal = new AuthenticatedResident(
                resident.getId(), resident.getSociety().getId(), resident.getPhone(), resident.getRole().name());

        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_RESIDENT"));
        if (resident.getRole() == Resident.Role.SOCIETY_ADMIN || resident.getRole() == Resident.Role.PLATFORM_ADMIN) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SOCIETY_ADMIN"));
        }
        if (resident.getRole() == Resident.Role.PLATFORM_ADMIN) {
            authorities.add(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"));
        }

        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}
