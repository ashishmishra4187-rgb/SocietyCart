package com.societycart.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.pool.PoolService;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.AdminCreatePoolRequest;
import com.societycart.dto.AdminPoolView;
import com.societycart.dto.PackingListView;
import com.societycart.dto.UpdatePoolRequest;
import com.societycart.dto.PoolView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Society-admin API. The URL rule in SecurityConfig is the first gate; the service re-checks against the
 * database that the caller is an admin of the pool's own society.
 */
@RestController
@RequestMapping("/api/admin/pools")
public class AdminPoolController {

    private final PoolService poolService;
    private final ResidentService residentService;

    public AdminPoolController(PoolService poolService, ResidentService residentService) {
        this.poolService = poolService;
        this.residentService = residentService;
    }

    @GetMapping
    public List<PoolView> list(@AuthenticationPrincipal AuthenticatedResident me, @RequestParam UUID societyId) {
        return poolService.listForAdmin(societyId, residentService.requireActive(me.residentId()));
    }

    @GetMapping("/history")
    public PoolService.PoolHistory history(@AuthenticationPrincipal AuthenticatedResident me, @RequestParam UUID societyId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000000) int page) {
        return poolService.historyForAdmin(societyId, residentService.requireActive(me.residentId()), page);
    }

    @GetMapping("/{id}")
    public AdminPoolView detail(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        return poolService.getAdminView(id, residentService.requireActive(me.residentId()));
    }

    @PostMapping
    public ResponseEntity<PoolView> create(@AuthenticationPrincipal AuthenticatedResident me,
                                           @Valid @RequestBody AdminCreatePoolRequest body) {
        PoolView created = poolService.createPool(body, residentService.requireActive(me.residentId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** Change when an open deal closes. */
    @PatchMapping("/{id}")
    public PoolView updateCutoff(@AuthenticationPrincipal AuthenticatedResident me,
                                 @PathVariable UUID id,
                                 @Valid @RequestBody UpdatePoolRequest body) {
        return poolService.updateCutoff(id, body.cutoffAt(), residentService.requireActive(me.residentId()));
    }

    @GetMapping("/{id}/packing-list")
    public PackingListView packingList(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        return poolService.packingList(id, residentService.requireActive(me.residentId()));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        poolService.cancelPool(id, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<Void> close(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        poolService.lockPool(id, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<Void> dispatch(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        poolService.dispatchPool(id, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/deliver")
    public ResponseEntity<Void> deliver(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        poolService.markDelivered(id, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }
}
