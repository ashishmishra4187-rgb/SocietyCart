package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.pool.PoolService;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.PoolView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/shopkeeper/pools")
public class ShopkeeperPoolController {

    private final PoolService poolService;
    private final ResidentService residentService;

    public ShopkeeperPoolController(PoolService poolService, ResidentService residentService) {
        this.poolService = poolService;
        this.residentService = residentService;
    }

    @GetMapping
    public List<PoolView> ready(@AuthenticationPrincipal AuthenticatedResident me) {
        return poolService.readyForDispatch(residentService.requireActive(me.residentId()));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<Void> dispatch(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID id) {
        poolService.dispatchPool(id, residentService.requireActive(me.residentId()));
        return ResponseEntity.noContent().build();
    }

}
