package com.societycart.domain.society;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SocietyService {

    private final SocietyRepository societyRepository;

    public SocietyService(SocietyRepository societyRepository) {
        this.societyRepository = societyRepository;
    }

    public List<Society> getAllSocieties() {
        return societyRepository.findByActiveTrue();
    }

    public Society getSocietyById(UUID id) {
        return societyRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Society not found with id: " + id));
    }

    public Society getSocietyByCode(String societyCode) {
        return societyRepository.findBySocietyCode(societyCode)
                .orElseThrow(() -> new NoSuchElementException("Society not found with code: " + societyCode));
    }

    public List<Society> findNearbySocieties(Double latitude, Double longitude, Double radiusMeters) {
        double radius = (radiusMeters != null && radiusMeters > 0) ? radiusMeters : 1000.0;
        return societyRepository.findNearbySocieties(latitude, longitude, radius);
    }

    @Transactional
    public Society createSociety(Society society) {
        if (societyRepository.findBySocietyCode(society.getSocietyCode()).isPresent()) {
            throw new IllegalArgumentException("Society with code '" + society.getSocietyCode() + "' already exists");
        }
        return societyRepository.save(society);
    }

    @Transactional
    public Society updateSociety(UUID id, Society updated) {
        Society existing = getSocietyById(id);
        existing.setName(updated.getName());
        existing.setAddressLine(updated.getAddressLine());
        existing.setCity(updated.getCity());
        existing.setState(updated.getState());
        existing.setPostalCode(updated.getPostalCode());
        existing.setLatitude(updated.getLatitude());
        existing.setLongitude(updated.getLongitude());
        existing.setGeofenceRadiusMeters(updated.getGeofenceRadiusMeters());
        existing.setDeliveryGateNote(updated.getDeliveryGateNote());
        existing.setActive(updated.isActive());
        return societyRepository.save(existing);
    }
}
