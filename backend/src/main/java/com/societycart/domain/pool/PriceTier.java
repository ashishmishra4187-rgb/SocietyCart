package com.societycart.domain.pool;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/**
 * Defines a volume discount tier for a PoolWindow.
 * As total pooled quantity increases, unlocks lower unit prices for all participating neighbors.
 */
@Entity
@Table(name = "price_tiers", indexes = {
        @Index(name = "idx_price_tiers_pool", columnList = "pool_window_id, minQuantity")
})
public class PriceTier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pool_window_id", nullable = false)
    private PoolWindow poolWindow;

    @NotNull
    @Min(1)
    @Column(nullable = false)
    private Integer tierLevel;

    @NotNull
    @Min(0)
    @Column(nullable = false)
    private Integer minQuantity;

    @NotNull
    @DecimalMin("0.00")
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercentage;

    @NotNull
    @DecimalMin("0.01")
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(length = 255)
    private String description;

    public PriceTier() {
    }

    public PriceTier(Integer tierLevel, Integer minQuantity, BigDecimal discountPercentage,
                     BigDecimal unitPrice, String description) {
        this.tierLevel = tierLevel;
        this.minQuantity = minQuantity;
        this.discountPercentage = discountPercentage;
        this.unitPrice = unitPrice;
        this.description = description;
    }

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public PoolWindow getPoolWindow() {
        return poolWindow;
    }

    public void setPoolWindow(PoolWindow poolWindow) {
        this.poolWindow = poolWindow;
    }

    public Integer getTierLevel() {
        return tierLevel;
    }

    public void setTierLevel(Integer tierLevel) {
        this.tierLevel = tierLevel;
    }

    public Integer getMinQuantity() {
        return minQuantity;
    }

    public void setMinQuantity(Integer minQuantity) {
        this.minQuantity = minQuantity;
    }

    public BigDecimal getDiscountPercentage() {
        return discountPercentage;
    }

    public void setDiscountPercentage(BigDecimal discountPercentage) {
        this.discountPercentage = discountPercentage;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PriceTier priceTier = (PriceTier) o;
        return Objects.equals(id, priceTier.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
