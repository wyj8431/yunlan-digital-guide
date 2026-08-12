package com.yunlan.platform.alert;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AlertControllerTest {
    @Test
    void keepsTheAcceptedResponseContractForAlertClients() throws Exception {
        var service = mock(AlertService.class);
        when(service.submit(any(AlertDtos.SubmitRequest.class)))
                .thenReturn(new AlertDtos.AcceptedResponse("accepted", 3));
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AlertController(service)).build();

        mockMvc.perform(post("/api/alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "deviceId": "device-1",
                                  "alertType": "temperature",
                                  "level": "WARNING",
                                  "message": "temperature is high",
                                  "occurredAt": "2026-08-10T01:07:42Z"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.queuedCount").value(3));
    }

    @Test
    void mapsTheVersionedCompatibilityPayloadToTheCanonicalQueueRequest() throws Exception {
        var service = mock(AlertService.class);
        when(service.submit(any(AlertDtos.SubmitRequest.class)))
                .thenReturn(new AlertDtos.AcceptedResponse("accepted", 2));
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AlertController(service)).build();

        mockMvc.perform(post("/api/alerts/compat/v1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "device_id": "legacy-device-1",
                                  "alert_type": "temperature",
                                  "severity": "WARN",
                                  "message": "temperature is high",
                                  "occurred_at": "2026-08-10T01:07:42Z"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.queuedCount").value(2));

        var request = org.mockito.ArgumentCaptor.forClass(AlertDtos.SubmitRequest.class);
        verify(service).submit(request.capture());
        assertEquals("legacy-device-1", request.getValue().deviceId());
        assertEquals("temperature", request.getValue().alertType());
        assertEquals("WARNING", request.getValue().level());
        assertEquals("2026-08-10T01:07:42Z", request.getValue().occurredAt().toString());
    }
}
