package com.societycart.domain.product;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.domain.pool.PoolAccess;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import com.societycart.dto.ProductRequest;
import com.societycart.dto.ProductUpdateRequest;
import com.societycart.dto.ProductView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/** A society admin's product catalog. Every call is scoped to the admin's own society. */
@Service
@Transactional(readOnly = true)
public class ProductService {

    private static final Logger log = LoggerFactory.getLogger(ProductService.class);

    private final ProductRepository productRepository;
    private final SocietyRepository societyRepository;

    public ProductService(ProductRepository productRepository, SocietyRepository societyRepository) {
        this.productRepository = productRepository;
        this.societyRepository = societyRepository;
    }

    public List<ProductView> list(UUID societyId, Resident admin) {
        PoolAccess.assertAdminOf(admin, societyId);
        return productRepository.findBySocietyIdOrderByNameAsc(societyId).stream().map(ProductService::toView).toList();
    }

    @Transactional
    public ProductView create(ProductRequest req, Resident admin) {
        PoolAccess.assertAdminOf(admin, req.societyId());
        Society society = societyRepository.findById(req.societyId())
                .orElseThrow(() -> new NoSuchElementException("Society not found"));
        String sku = req.sku().trim();
        if (productRepository.existsBySocietyIdAndSku(society.getId(), sku)) {
            throw new ConflictException("A product with SKU " + sku + " already exists.");
        }
        Product product = new Product(null, society, sku, req.name().trim(), blankToNull(req.imageUrl()),
                trimOrNull(req.category()), trimOrNull(req.unit()), req.basePrice());
        Product saved = productRepository.save(product);
        log.info("Admin {} added product {} to society {}", admin.getId(), sku, society.getName());
        return toView(saved);
    }

    @Transactional
    public ProductView update(UUID productId, ProductUpdateRequest req, Resident admin) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new NoSuchElementException("Product not found"));
        PoolAccess.assertAdminOf(admin, product.getSociety().getId());

        if (req.name() != null) {
            if (req.name().isBlank()) {
                throw new IllegalArgumentException("Product name cannot be empty.");
            }
            product.setName(req.name().trim());
        }
        if (req.imageUrl() != null) {
            product.setImageUrl(blankToNull(req.imageUrl()));
        }
        if (req.category() != null && !req.category().isBlank()) {
            product.setCategory(req.category().trim());
        }
        if (req.unit() != null && !req.unit().isBlank()) {
            product.setUnit(req.unit().trim());
        }
        if (req.basePrice() != null) {
            product.setBasePrice(req.basePrice());
        }
        if (req.active() != null) {
            product.setActive(req.active());
        }
        return toView(productRepository.save(product));
    }

    static ProductView toView(Product p) {
        return new ProductView(p.getId(), p.getSociety().getId(), p.getSku(), p.getName(), p.getImageUrl(),
                p.getCategory(), p.getUnit(), p.getBasePrice(), p.isActive());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String trimOrNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
