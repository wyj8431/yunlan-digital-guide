package com.yunlan.platform.learning;

import com.yunlan.platform.common.security.AuthPrincipal;
import com.yunlan.platform.common.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "local"})
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:learning-local-api;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
class LearningLocalApiTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Test
    void rejectsLearnerReviewRequestsWithTheStableForbiddenContract() throws Exception {
        var learner = new AuthPrincipal(UUID.randomUUID(), "learner-api@example.com", "LEARNER");
        var token = jwtService.issue(learner);

        mockMvc.perform(post("/api/learning/attempts/{id}/review", UUID.randomUUID())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
