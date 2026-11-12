package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.resident.ResidentService;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyService;
import com.societycart.dto.CreateSocietyRequest;
import com.societycart.dto.SocietyView;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.NoSuchElementException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST API for residential complexes and society geofence queries.
 */
@RestController
@RequestMapping("/api/societies")
public class SocietyController {

    private final SocietyService societyService;
    private final ResidentService residentService;

    public SocietyController(SocietyService societyService, ResidentService residentService) {
        this.societyService = societyService;
        this.residentService = residentService;
    }

    /**
     * The societies the signed-in resident belongs to (platform admins see all active societies).
     */
    @GetMapping
    public ResponseEntity<List<SocietyView>> mySocieties(@AuthenticationPrincipal AuthenticatedResident me) {
        Resident resident = residentService.requireActive(me.residentId());
        List<Society> societies = resident.getRole() == Resident.Role.PLATFORM_ADMIN
                ? societyService.getAllSocieties()
                : List.of(resident.getSociety());
        return ResponseEntity.ok(societies.stream().map(SocietyController::toView).toList());
    }

    /**
     * Society summary. Residents can only read their own society (others look like 404).
     */
    @GetMapping("/{id}")
    public ResponseEntity<SocietyView> getSocietyById(@AuthenticationPrincipal AuthenticatedResident me,
                                                      @PathVariable UUID id) {
        Resident resident = residentService.requireActive(me.residentId());
        if (resident.getRole() != Resident.Role.PLATFORM_ADMIN && !resident.getSociety().getId().equals(id)) {
            throw new NoSuchElementException("Society not found");
        }
        return ResponseEntity.ok(toView(societyService.getSocietyById(id)));
    }

    private static SocietyView toView(Society s) {
        return new SocietyView(s.getId(), s.getName(), s.getCity(), s.getSocietyCode());
    }

    /**
     * Geofencing endpoint (platform admins only; see SecurityConfig).
     */
    @GetMapping("/nearby")
    public ResponseEntity<List<Society>> getNearbySocieties(
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam(required = false, defaultValue = "1000.0") Double radiusMeters
    ) {
        return ResponseEntity.ok(societyService.findNearbySocieties(latitude, longitude, radiusMeters));
    }

    /**
     * Register a new society / apartment complex (platform admins only; see SecurityConfig).
     */
    @PostMapping
    public ResponseEntity<Society> createSociety(@Valid @RequestBody CreateSocietyRequest request) {
        Society society = new Society(
                null,
                request.name(),
                request.societyCode(),
                request.addressLine(),
                request.city(),
                request.state(),
                request.postalCode(),
                request.latitude(),
                request.longitude(),
                request.geofenceRadiusMeters(),
                request.deliveryGateNote(),
                true
        );
        Society created = societyService.createSociety(society);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
