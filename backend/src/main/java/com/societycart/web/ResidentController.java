package com.societycart.web;

import com.societycart.auth.AuthenticatedResident;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.ResidentProfileView;
import com.societycart.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/residents")
public class ResidentController {

    private final ResidentService residentService;

    public ResidentController(ResidentService residentService) {
        this.residentService = residentService;
    }

    @GetMapping("/me")
    public ResidentProfileView me(@AuthenticationPrincipal AuthenticatedResident me) {
        return toView(residentService.requireActive(me.residentId()));
    }

    @PatchMapping("/me")
    public ResidentProfileView update(@AuthenticationPrincipal AuthenticatedResident me,
                                      @Valid @RequestBody UpdateProfileRequest body) {
        return toView(residentService.updateProfile(me.residentId(), body.name(), body.flatNumber()));
    }

    private static ResidentProfileView toView(Resident r) {
        return new ResidentProfileView(
                r.getName() == null ? "" : r.getName(),
                r.getPhone(),
                r.getFlatNumber() == null ? "" : r.getFlatNumber(),
                r.getSociety().getId(),
                r.getSociety().getName(),
                r.getSociety().getSocietyCode());
    }
}
