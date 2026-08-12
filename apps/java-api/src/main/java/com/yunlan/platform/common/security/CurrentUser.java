package com.yunlan.platform.common.security;

import com.yunlan.platform.common.api.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import java.util.UUID;

public final class CurrentUser {
    private CurrentUser() {
    }

    public static AuthPrincipal require(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        return principal;
    }

    public static void requireRole(Authentication authentication, String role) {
        if (!role.equals(require(authentication).role())) {
            throw new ApiException("FORBIDDEN", HttpStatus.FORBIDDEN, "You do not have permission for this action.");
        }
    }

    public static UUID id(Authentication authentication) {
        return require(authentication).userId();
    }
}
