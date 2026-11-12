package com.societycart.domain.pool;

import com.societycart.common.ApiExceptions.ForbiddenException;
import com.societycart.domain.resident.Resident;

import java.util.NoSuchElementException;
import java.util.UUID;

/** Tenant isolation rules: residents only see their own society; admins only manage their own society. */
public final class PoolAccess {

    private PoolAccess() {
    }

    /** Pools of other societies look like they do not exist (404), so ids cannot be probed. */
    public static void assertVisible(Resident caller, PoolWindow pool) {
        if (!canSee(caller, pool.getSociety().getId())) {
            throw new NoSuchElementException("Pool not found");
        }
    }

    public static void assertSocietyVisible(Resident caller, UUID societyId) {
        if (!canSee(caller, societyId)) {
            throw new NoSuchElementException("Society not found");
        }
    }

    public static void assertAdminOf(Resident admin, UUID societyId) {
        if (!admin.isAdmin()) {
            throw new ForbiddenException("Society admin access required");
        }
        if (admin.getRole() != Resident.Role.PLATFORM_ADMIN && !admin.getSociety().getId().equals(societyId)) {
            throw new ForbiddenException("You can only manage your own society's pools");
        }
    }

    private static boolean canSee(Resident caller, UUID societyId) {
        return caller.getRole() == Resident.Role.PLATFORM_ADMIN || caller.getSociety().getId().equals(societyId);
    }
}
