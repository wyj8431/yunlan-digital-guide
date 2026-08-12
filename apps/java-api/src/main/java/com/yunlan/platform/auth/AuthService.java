package com.yunlan.platform.auth;

import com.yunlan.platform.common.api.ApiException;
import com.yunlan.platform.common.security.AuthPrincipal;
import com.yunlan.platform.common.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserAccountRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthDtos.LoginResponse login(AuthDtos.LoginRequest request) {
        var user = users.findByEmailIgnoreCase(request.email().trim())
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.getPasswordHash()))
                .orElseThrow(() -> new ApiException(
                        "INVALID_CREDENTIALS",
                        HttpStatus.UNAUTHORIZED,
                        "Email or password is incorrect."
                ));
        var principal = new AuthPrincipal(user.getId(), user.getEmail(), user.getRole());
        return new AuthDtos.LoginResponse(
                jwtService.issue(principal),
                "Bearer",
                user.getId().toString(),
                user.getEmail(),
                user.getRole()
        );
    }
}
