package com.societycart.domain.society;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SocietyServiceTest {

    @Mock
    private SocietyRepository societyRepository;

    @InjectMocks
    private SocietyService societyService;

    private Society society;

    @BeforeEach
    void setUp() {
        society = new Society(
                UUID.randomUUID(), "Greenwood Heights", "GWH-01", "100 Green Rd",
                "Bengaluru", "Karnataka", "560066", 12.9800, 77.7500, 600.0, "Gate 2", true
        );
    }

    @Test
    @DisplayName("Should successfully retrieve all active societies")
    void testGetAllSocieties() {
        when(societyRepository.findByActiveTrue()).thenReturn(List.of(society));
        List<Society> result = societyService.getAllSocieties();
        assertEquals(1, result.size());
        assertEquals("Greenwood Heights", result.get(0).getName());
    }

    @Test
    @DisplayName("Should find nearby societies with geofencing coordinates")
    void testFindNearbySocieties() {
        when(societyRepository.findNearbySocieties(12.9800, 77.7500, 1000.0)).thenReturn(List.of(society));
        List<Society> nearby = societyService.findNearbySocieties(12.9800, 77.7500, 1000.0);
        assertFalse(nearby.isEmpty());
        assertEquals("GWH-01", nearby.get(0).getSocietyCode());
    }

    @Test
    @DisplayName("Should reject society with duplicate code")
    void testCreateSociety_DuplicateCode() {
        when(societyRepository.findBySocietyCode("GWH-01")).thenReturn(Optional.of(society));
        assertThrows(IllegalArgumentException.class, () -> societyService.createSociety(society));
    }
}
