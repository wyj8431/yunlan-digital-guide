package com.yunlan.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {
    private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder BASE64_URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secret;
    private final long ttlSeconds;

    public JwtService(
            ObjectMapper objectMapper,
            @Value("${app.auth.jwt-secret:local-development-secret-change-me}") String secret,
            @Value("${app.auth.jwt-ttl-seconds:3600}") long ttlSeconds
    ) {
        if (secret.length() < 24) {
            throw new IllegalArgumentException("app.auth.jwt-secret must contain at least 24 characters");
        }
        this.objectMapper = objectMapper;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
    }

    public String issue(AuthPrincipal principal) {
        try {
            var header = BASE64_URL.encodeToString(objectMapper.writeValueAsBytes(Map.of(
                    "alg", "HS256",
                    "typ", "JWT"
            )));
            var now = Instant.now().getEpochSecond();
            var payload = BASE64_URL.encodeToString(objectMapper.writeValueAsBytes(Map.of(
                    "sub", principal.userId().toString(),
                    "email", principal.email(),
                    "role", principal.role(),
                    "iat", now,
                    "exp", now + ttlSeconds
            )));
            var unsigned = header + "." + payload;
            return unsigned + "." + sign(unsigned);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to issue authentication token", exception);
        }
    }

    public AuthPrincipal verify(String token) {
        try {
            var parts = token.split("\\.");
            if (parts.length != 3 || !constantTimeEquals(sign(parts[0] + "." + parts[1]), parts[2])) {
                throw new IllegalArgumentException("Invalid token");
            }
            @SuppressWarnings("unchecked")
            var payload = objectMapper.readValue(BASE64_URL_DECODER.decode(parts[1]), Map.class);
            var expiresAt = ((Number) payload.get("exp")).longValue();
            if (expiresAt <= Instant.now().getEpochSecond()) {
                throw new IllegalArgumentException("Expired token");
            }
            return new AuthPrincipal(
                    UUID.fromString((String) payload.get("sub")),
                    (String) payload.get("email"),
                    (String) payload.get("role")
            );
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid authentication token", exception);
        }
    }

    private String sign(String value) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return BASE64_URL.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return java.security.MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8)
        );
    }
}
