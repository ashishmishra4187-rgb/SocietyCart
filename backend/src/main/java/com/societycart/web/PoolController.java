package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.pool.PoolOrderService;
import com.societycart.domain.pool.PoolService;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.JoinPoolRequest;
import com.societycart.dto.PoolView;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Resident-facing pool API. Every call is scoped to the signed-in resident's society.
 * Pool creation, closing and dispatch live in {@link AdminPoolController}.
 */
@RestController
@RequestMapping("/api/pools")
public class PoolController {

    private final PoolService poolService;
    private final PoolOrderService poolOrderService;
    private final ResidentService residentService;

    public PoolController(PoolService poolService, PoolOrderService poolOrderService, ResidentService residentService) {
        this.poolService = poolService;
        this.poolOrderService = poolOrderService;
        this.residentService = residentService;
    }

    @GetMapping("/society/{societyId}")
    public List<PoolView> openPools(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID societyId) {
        return poolService.getOpenPoolViews(societyId, residentService.requireActive(me.residentId()));
    }

    @GetMapping("/{poolId}")
    public PoolView pool(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID poolId) {
        return poolService.getPoolView(poolId, residentService.requireActive(me.residentId()));
    }

    @PostMapping("/{poolId}/orders")
    public PoolView join(@AuthenticationPrincipal AuthenticatedResident me,
                         @PathVariable UUID poolId,
                         @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                         @Valid @RequestBody JoinPoolRequest body) {
        return poolOrderService.join(poolId, residentService.requireActive(me.residentId()), body, idempotencyKey);
    }

    @DeleteMapping("/{poolId}/orders/{orderId}")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal AuthenticatedResident me,
                                       @PathVariable UUID poolId,
                                       @PathVariable UUID orderId) {
        poolOrderService.cancel(poolId, orderId, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }
}
