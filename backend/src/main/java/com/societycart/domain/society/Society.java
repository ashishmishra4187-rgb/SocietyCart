package com.societycart.domain.society;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Entity representing a gated residential complex or housing society.
 * Used for demand pooling geofencing and batch drop-off hubs.
 */
@Entity
@Table(name = "societies", indexes = {
        @Index(name = "idx_societies_geo", columnList = "latitude, longitude"),
        @Index(name = "idx_societies_code", columnList = "societyCode", unique = true)
})
public class Society {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank(message = "Society name is required")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Society code is required")
    @Column(nullable = false, unique = true, length = 50)
    private String societyCode;

    @NotBlank(message = "Address is required")
    @Column(nullable = false)
    private String addressLine;

    @NotBlank(message = "City is required")
    @Column(nullable = false, length = 100)
    private String city;

    @NotBlank(message = "State is required")
    @Column(nullable = false, length = 100)
    private String state;

    @NotBlank(message = "Postal code is required")
    @Column(nullable = false, length = 20)
    private String postalCode;

    @NotNull(message = "Latitude is required")
    @Column(nullable = false)
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Double geofenceRadiusMeters = 500.0;

    @Column(length = 255)
    private String deliveryGateNote;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Society() {
    }

    public Society(UUID id, String name, String societyCode, String addressLine, String city,
                   String state, String postalCode, Double latitude, Double longitude,
                   Double geofenceRadiusMeters, String deliveryGateNote, boolean active) {
        this.id = id;
        this.name = name;
        this.societyCode = societyCode;
        this.addressLine = addressLine;
        this.city = city;
        this.state = state;
        this.postalCode = postalCode;
        this.latitude = latitude;
        this.longitude = longitude;
        this.geofenceRadiusMeters = geofenceRadiusMeters != null ? geofenceRadiusMeters : 500.0;
        this.deliveryGateNote = deliveryGateNote;
        this.active = active;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSocietyCode() {
        return societyCode;
    }

    public void setSocietyCode(String societyCode) {
        this.societyCode = societyCode;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getGeofenceRadiusMeters() {
        return geofenceRadiusMeters;
    }

    public void setGeofenceRadiusMeters(Double geofenceRadiusMeters) {
        this.geofenceRadiusMeters = geofenceRadiusMeters;
    }

    public String getDeliveryGateNote() {
        return deliveryGateNote;
    }

    public void setDeliveryGateNote(String deliveryGateNote) {
        this.deliveryGateNote = deliveryGateNote;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Society society = (Society) o;
        return Objects.equals(id, society.id) || Objects.equals(societyCode, society.societyCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, societyCode);
    }
}
