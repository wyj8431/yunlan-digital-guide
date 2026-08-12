package com.yunlan.platform.common.security;

import java.util.UUID;

public record AuthPrincipal(UUID userId, String email, String role) {
}
