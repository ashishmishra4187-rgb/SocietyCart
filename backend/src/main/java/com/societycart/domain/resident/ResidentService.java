package com.societycart.domain.resident;

import com.societycart.common.ApiExceptions.UnauthorizedException;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ResidentService {

    private static final Logger log = LoggerFactory.getLogger(ResidentService.class);

    private final ResidentRepository residentRepository;
    private final SocietyRepository societyRepository;

    public ResidentService(ResidentRepository residentRepository, SocietyRepository societyRepository) {
        this.residentRepository = residentRepository;
        this.societyRepository = societyRepository;
    }

    public Optional<Resident> findByPhone(String phone) {
        return residentRepository.findByPhone(phone);
    }

    /**
     * Loads the signed-in resident fresh from the database so deactivation or a role change takes
     * effect immediately, instead of trusting whatever was cached in the session.
     */
    public Resident requireActive(UUID residentId) {
        return residentRepository.findById(residentId)
                .filter(Resident::isActive)
                .orElseThrow(() -> new UnauthorizedException("Your session is no longer valid. Please sign in again."));
    }

    public List<Society> listActiveSocieties() {
        return societyRepository.findByActiveTrue();
    }

    public Society requireSociety(UUID societyId) {
        return societyRepository.findById(societyId)
                .filter(Society::isActive)
                .orElseThrow(() -> new NoSuchElementException("That society was not found."));
    }

    /** Creates the account once the phone has been proven with an OTP. */
    @Transactional
    public Resident createResident(String phone, String name, Society society, String flatNumber, Resident.Role role) {
        Resident resident = new Resident(null, society, phone, name, flatNumber, role);
        log.info("Created {} account {} in society {}", role, mask(phone), society.getName());
        return residentRepository.save(resident);
    }

    @Transactional
    public Resident updateProfile(UUID residentId, String name, String flatNumber) {
        Resident resident = requireActive(residentId);
        if (name != null) {
            resident.setName(name.isBlank() ? null : name.trim());
        }
        if (flatNumber != null) {
            resident.setFlatNumber(flatNumber.isBlank() ? null : flatNumber.trim());
        }
        return residentRepository.save(resident);
    }

    /** Dev/seed helper: make sure a phone exists with (at least) the given role. Never overwrites an existing name. */
    @Transactional
    public Resident ensureWithRole(String phone, String name, String flatNumber, Society society, Resident.Role role) {
        Resident resident = residentRepository.findByPhone(phone)
                .orElseGet(() -> new Resident(null, society, phone, name, flatNumber, role));
        if (resident.getName() == null) {
            resident.setName(name);
        }
        if (resident.getFlatNumber() == null) {
            resident.setFlatNumber(flatNumber);
        }
        resident.setRole(role);
        resident.setActive(true);
        return residentRepository.save(resident);
    }

    public static String mask(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "******" + phone.substring(phone.length() - 4);
    }
}
