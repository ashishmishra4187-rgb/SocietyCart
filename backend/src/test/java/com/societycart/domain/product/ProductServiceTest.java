package com.societycart.domain.product;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.common.ApiExceptions.ForbiddenException;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import com.societycart.dto.ProductRequest;
import com.societycart.dto.ProductUpdateRequest;
import com.societycart.dto.ProductView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;
    @Mock
    private SocietyRepository societyRepository;

    private ProductService service;
    private Society society;
    private Resident admin;
    private Resident resident;

    @BeforeEach
    void setUp() {
        service = new ProductService(productRepository, societyRepository);
        society = new Society(UUID.randomUUID(), "Greenwood Heights", "GWH-01", "1 Park Rd", "Bengaluru",
                "Karnataka", "560001", 12.9, 77.6, 500.0, "Gate 2", true);
        admin = new Resident(UUID.randomUUID(), society, "9000000001", "Admin", "A-1", Resident.Role.SOCIETY_ADMIN);
        resident = new Resident(UUID.randomUUID(), society, "9000000002", "Res", "B-1", Resident.Role.RESIDENT);
        when(societyRepository.findById(society.getId())).thenReturn(Optional.of(society));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private ProductRequest request(String sku) {
        return new ProductRequest(society.getId(), sku, "  Atta 5kg ", "https://img.example/atta.png", " Staples ", null, new BigDecimal("450"));
    }

    private Product stored(String sku) {
        Product p = new Product(UUID.randomUUID(), society, sku, "Atta 5kg", null, "Staples", "kg", new BigDecimal("450"));
        when(productRepository.findById(p.getId())).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    @DisplayName("Adding a product trims text, defaults the unit and makes it active")
    void createProduct() {
        ProductView view = service.create(request("SKU-ATTA"), admin);

        ArgumentCaptor<Product> saved = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(saved.capture());
        Product p = saved.getValue();
        assertEquals("SKU-ATTA", p.getSku());
        assertEquals("Atta 5kg", p.getName());
        assertEquals("Staples", p.getCategory());
        assertEquals("unit", p.getUnit(), "missing unit falls back to 'unit'");
        assertTrue(p.isActive());
        assertEquals(society.getId(), view.societyId());
        assertEquals(new BigDecimal("450"), view.basePrice());
    }

    @Test
    @DisplayName("A duplicate SKU in the same society is a conflict")
    void duplicateSku() {
        when(productRepository.existsBySocietyIdAndSku(society.getId(), "SKU-ATTA")).thenReturn(true);
        ConflictException e = assertThrows(ConflictException.class, () -> service.create(request("SKU-ATTA"), admin));
        assertTrue(e.getMessage().contains("SKU-ATTA"));
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    @DisplayName("Only admins of the society can list or add products")
    void accessRules() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident foreignAdmin = new Resident(UUID.randomUUID(), other, "9000000009", "FA", "A-1", Resident.Role.SOCIETY_ADMIN);

        assertThrows(ForbiddenException.class, () -> service.create(request("SKU-X"), resident));
        assertThrows(ForbiddenException.class, () -> service.create(request("SKU-X"), foreignAdmin));
        assertThrows(ForbiddenException.class, () -> service.list(society.getId(), resident));
        assertThrows(ForbiddenException.class, () -> service.list(society.getId(), foreignAdmin));
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    @DisplayName("Listing returns the society's products")
    void list() {
        when(productRepository.findBySocietyIdOrderByNameAsc(society.getId())).thenReturn(List.of(stored("SKU-A"), stored("SKU-B")));
        assertEquals(2, service.list(society.getId(), admin).size());
    }

    @Test
    @DisplayName("Update changes only the fields sent, and never the SKU")
    void partialUpdate() {
        Product p = stored("SKU-ATTA");

        ProductView view = service.update(p.getId(), new ProductUpdateRequest("Atta Premium 5kg", null, null, null, new BigDecimal("480"), null), admin);

        assertEquals("Atta Premium 5kg", view.name());
        assertEquals(new BigDecimal("480"), view.basePrice());
        assertEquals("Staples", view.category(), "untouched");
        assertEquals("kg", view.unit(), "untouched");
        assertEquals("SKU-ATTA", view.sku(), "SKU is immutable");
    }

    @Test
    @DisplayName("A product can be archived and restored, and a blank image link clears the photo")
    void archiveRestoreAndClearImage() {
        Product p = stored("SKU-ATTA");
        p.setImageUrl("https://img.example/a.png");

        assertFalse(service.update(p.getId(), new ProductUpdateRequest(null, null, null, null, null, false), admin).active());
        assertTrue(service.update(p.getId(), new ProductUpdateRequest(null, null, null, null, null, true), admin).active());
        assertNull(service.update(p.getId(), new ProductUpdateRequest(null, "", null, null, null, null), admin).imageUrl());
    }

    @Test
    @DisplayName("Update rejects an empty name, an unknown product and a foreign admin")
    void updateGuards() {
        Product p = stored("SKU-ATTA");
        assertThrows(IllegalArgumentException.class, () -> service.update(p.getId(), new ProductUpdateRequest("   ", null, null, null, null, null), admin));
        assertThrows(NoSuchElementException.class, () -> service.update(UUID.randomUUID(), new ProductUpdateRequest("X", null, null, null, null, null), admin));

        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident foreignAdmin = new Resident(UUID.randomUUID(), other, "9000000009", "FA", "A-1", Resident.Role.SOCIETY_ADMIN);
        assertThrows(ForbiddenException.class, () -> service.update(p.getId(), new ProductUpdateRequest("Hijack", null, null, null, null, null), foreignAdmin));
        assertEquals("Atta 5kg", p.getName());
    }
}
