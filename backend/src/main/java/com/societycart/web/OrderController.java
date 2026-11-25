package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.pool.PoolOrderService;
import com.societycart.dto.OrderDetailView;
import com.societycart.dto.OrderView;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.societycart.dto.OrderHistoryPage;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final PoolOrderService poolOrderService;

    public OrderController(PoolOrderService poolOrderService) {
        this.poolOrderService = poolOrderService;
    }

    @GetMapping("/me")
    public List<OrderView> myOrders(@AuthenticationPrincipal AuthenticatedResident me) {
        return poolOrderService.myOrders(me.residentId());
    }

    @GetMapping("/me/history")
    public OrderHistoryPage history(@AuthenticationPrincipal AuthenticatedResident me,
                                    @RequestParam(defaultValue = "false") boolean past,
                                    @RequestParam(defaultValue = "0") @Min(0) @Max(100000000) int page) {
        return poolOrderService.history(me.residentId(), past, page);
    }

    /** Only the owner can read an order; anyone else gets 404. */
    @GetMapping("/{orderId}")
    public OrderDetailView order(@AuthenticationPrincipal AuthenticatedResident me, @PathVariable UUID orderId) {
        return poolOrderService.getOrder(orderId, me.residentId());
    }
}
