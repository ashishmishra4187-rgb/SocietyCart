package com.societycart.domain.product;

import com.societycart.domain.society.Society;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A product a society admin keeps in the society's catalog, so a deal is opened by picking a product
 * instead of retyping its name, SKU and photo every time. The SKU never changes once created
 * (deals and orders refer to it).
 */
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "society_id", nullable = false)
    private Society society;

    @Column(nullable = false, length = 100)
    private String sku;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 500)
    private String imageUrl;

    @Column(nullable = false, length = 100)
    private String category = "General";

    @Column(nullable = false, length = 50)
    private String unit = "unit";

    /** Usual shop price: a starting point when opening a deal (the admin can change it per deal). */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    /** Archived products stay on past deals but can no longer be used for new ones. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Product() {
    }

    public Product(UUID id, Society society, String sku, String name, String imageUrl, String category, String unit, BigDecimal basePrice) {
        this.id = id;
        this.society = society;
        this.sku = sku;
        this.name = name;
        this.imageUrl = imageUrl;
        this.category = category == null || category.isBlank() ? "General" : category;
        this.unit = unit == null || unit.isBlank() ? "unit" : unit;
        this.basePrice = basePrice;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Society getSociety() { return society; }
    public void setSociety(Society society) { this.society = society; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getBasePrice() { return basePrice; }
    public void setBasePrice(BigDecimal basePrice) { this.basePrice = basePrice; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Product that = (Product) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
