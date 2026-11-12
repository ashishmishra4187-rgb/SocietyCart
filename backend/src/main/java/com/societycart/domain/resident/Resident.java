package com.societycart.domain.resident;

import com.societycart.domain.society.Society;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A person who can sign in (by phone OTP) and join pools for their society.
 */
@Entity
@Table(name = "residents")
public class Resident {

    public enum Role {
        RESIDENT,
        SOCIETY_ADMIN,
        PLATFORM_ADMIN
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "society_id", nullable = false)
    private Society society;

    /** 10-digit Indian mobile number, digits only. */
    @Column(nullable = false, unique = true, length = 15)
    private String phone;

    @Column(length = 120)
    private String name;

    @Column(length = 255)
    private String email;

    @Column(length = 20)
    private String flatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role = Role.RESIDENT;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Resident() {
    }

    public Resident(UUID id, Society society, String phone, String name, String flatNumber, Role role) {
        this.id = id;
        this.society = society;
        this.phone = phone;
        this.name = name;
        this.flatNumber = flatNumber;
        this.role = role == null ? Role.RESIDENT : role;
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

    public boolean isAdmin() {
        return role == Role.SOCIETY_ADMIN || role == Role.PLATFORM_ADMIN;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Society getSociety() {
        return society;
    }

    public void setSociety(Society society) {
        this.society = society;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFlatNumber() {
        return flatNumber;
    }

    public void setFlatNumber(String flatNumber) {
        this.flatNumber = flatNumber;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
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

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Resident that = (Resident) o;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
