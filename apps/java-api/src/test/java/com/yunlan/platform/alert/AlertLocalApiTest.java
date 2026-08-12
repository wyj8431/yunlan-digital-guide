package com.yunlan.platform.alert;

import com.yunlan.platform.common.security.AuthPrincipal;
import com.yunlan.platform.common.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:alert-local-api;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
class AlertLocalApiTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AlertGroupRepository groups;

    private String token;

    @BeforeEach
    void setUp() {
        groups.deleteAll();
        token = jwtService.issue(new AuthPrincipal(UUID.randomUUID(), "alert-api@example.com", "MEMBER"));
    }

    @Test
    void acceptsAnAlertWithTheLocalH2Profile() throws Exception {
        mockMvc.perform(post("/api/alerts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "deviceId": "local-api-device",
                                  "alertType": "temperature",
                                  "level": "WARNING",
                                  "message": "temperature is high",
                                  "occurredAt": "2026-08-10T01:07:42Z"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"));

        assertEquals(1, waitForGroup().getRepeatCount());
    }

    @Test
    void rejectsMalformedJsonWithBadRequest() throws Exception {
        mockMvc.perform(post("/api/alerts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{deviceId: invalid}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void acceptsTheAuthenticatedCompatibilityPayloadAndNormalizesWarn() throws Exception {
        mockMvc.perform(post("/api/alerts/compat/v1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "device_id": "compat-api-device",
                                  "alert_type": "temperature",
                                  "severity": "WARN",
                                  "message": "temperature is high",
                                  "occurred_at": "2026-08-10T01:07:42Z"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"));

        var group = waitForGroup("compat-api-device");
        assertEquals("WARNING", group.getLevel());
    }

    @Test
    void keepsCompatibilityIntakeProtectedByTheExistingJwtPolicy() throws Exception {
        mockMvc.perform(post("/api/alerts/compat/v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "device_id": "compat-api-device",
                                  "alert_type": "temperature",
                                  "severity": "WARNING",
                                  "message": "temperature is high",
                                  "occurred_at": "2026-08-10T01:07:42Z"
                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsAnUnknownCompatibilitySeverity() throws Exception {
        mockMvc.perform(post("/api/alerts/compat/v1")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "device_id": "compat-api-device",
                                  "alert_type": "temperature",
                                  "severity": "LOW",
                                  "message": "temperature is high",
                                  "occurred_at": "2026-08-10T01:07:42Z"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ALERT_LEVEL"));
    }

    private AlertGroup waitForGroup() throws InterruptedException {
        return waitForGroup("local-api-device");
    }

    private AlertGroup waitForGroup(String deviceId) throws InterruptedException {
        var bucketStart = Instant.parse("2026-08-10T01:05:00Z");
        for (var attempt = 0; attempt < 80; attempt++) {
            var group = groups.findByDeviceIdAndAlertTypeAndBucketStart(
                    deviceId, "temperature", bucketStart
            );
            if (group.isPresent()) {
                return group.get();
            }
            Thread.sleep(25);
        }
        throw new AssertionError("Alert group was not persisted by the local queue consumer.");
    }
}
