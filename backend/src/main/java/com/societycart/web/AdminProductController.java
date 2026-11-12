package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.product.ProductService;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.ProductRequest;
import com.societycart.dto.ProductUpdateRequest;
import com.societycart.dto.ProductView;
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

/** Society admin's product catalog (covered by the /api/admin/** rule in SecurityConfig). */
@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    private final ProductService productService;
    private final ResidentService residentService;

    public AdminProductController(ProductService productService, ResidentService residentService) {
        this.productService = productService;
        this.residentService = residentService;
    }

    @GetMapping
    public List<ProductView> list(@AuthenticationPrincipal AuthenticatedResident me, @RequestParam UUID societyId) {
        return productService.list(societyId, residentService.requireActive(me.residentId()));
    }

    @PostMapping
    public ResponseEntity<ProductView> create(@AuthenticationPrincipal AuthenticatedResident me,
                                              @Valid @RequestBody ProductRequest body) {
        ProductView created = productService.create(body, residentService.requireActive(me.residentId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** Edit a product, or archive/restore it with {@code {"active": false}}. */
    @PatchMapping("/{id}")
    public ProductView update(@AuthenticationPrincipal AuthenticatedResident me,
                              @PathVariable UUID id,
                              @Valid @RequestBody ProductUpdateRequest body) {
        return productService.update(id, body, residentService.requireActive(me.residentId()));
    }
}
