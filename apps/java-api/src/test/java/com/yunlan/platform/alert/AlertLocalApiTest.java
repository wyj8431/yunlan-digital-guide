package com.yunlan.platform.alert;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.io.InputStream;
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

    @Autowired
    private ObjectMapper objectMapper;

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

    @Test
    void appliesTheSyntheticCompatibilityFixtureToTheVersionedJavaContract() throws Exception {
        var fixture = readFixture();
        for (var testCase : fixture.path("cases")) {
            var expected = testCase.path("expected");
            var result = mockMvc.perform(post("/api/alerts/compat/v1")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(testCase.path("request"))))
                    .andExpect(status().is(expected.path("httpStatus").asInt()))
                    .andReturn();

            var response = objectMapper.readTree(result.getResponse().getContentAsString());
            if (expected.has("status")) {
                assertEquals(expected.path("status").asText(), response.path("status").asText(), testCase.path("name").asText());
            }
            if (expected.has("errorCode")) {
                assertEquals(expected.path("errorCode").asText(), response.path("code").asText(), testCase.path("name").asText());
            }
            if (expected.has("canonicalLevel")) {
                var request = testCase.path("request");
                var group = waitForGroup(
                        request.path("device_id").asText(),
                        request.path("alert_type").asText(),
                        Instant.parse(request.path("occurred_at").asText()).minusSeconds(
                                Instant.parse(request.path("occurred_at").asText()).getEpochSecond() % 300
                        )
                );
                assertEquals(expected.path("canonicalLevel").asText(), group.getLevel(), testCase.path("name").asText());
            }
        }
    }

    private AlertGroup waitForGroup() throws InterruptedException {
        return waitForGroup("local-api-device");
    }

    private AlertGroup waitForGroup(String deviceId) throws InterruptedException {
        return waitForGroup(deviceId, "temperature", Instant.parse("2026-08-10T01:05:00Z"));
    }

    private AlertGroup waitForGroup(String deviceId, String alertType, Instant bucketStart) throws InterruptedException {
        for (var attempt = 0; attempt < 80; attempt++) {
            var group = groups.findByDeviceIdAndAlertTypeAndBucketStart(
                    deviceId, alertType, bucketStart
            );
            if (group.isPresent()) {
                return group.get();
            }
            Thread.sleep(25);
        }
        throw new AssertionError("Alert group was not persisted by the local queue consumer.");
    }

    private JsonNode readFixture() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/fixtures/legacy-alert-synthetic-v1.json")) {
            if (input == null) {
                throw new AssertionError("Synthetic alert compatibility fixture is missing.");
            }
            return objectMapper.readTree(input);
        }
    }
}
