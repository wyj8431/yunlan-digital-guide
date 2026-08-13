package com.yunlan.platform.ticket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yunlan.platform.auth.UserAccount;
import com.yunlan.platform.auth.UserAccountRepository;
import com.yunlan.platform.common.security.AuthPrincipal;
import com.yunlan.platform.common.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TicketApiTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ProjectRepository projects;

    @Autowired
    private ProjectMemberRepository members;

    @Autowired
    private TicketRepository tickets;

    private UUID reporterId;
    private UUID assigneeId;
    private UUID projectId;
    private String reporterToken;
    private String assigneeToken;

    @BeforeEach
    void seed() {
        reporterId = UUID.randomUUID();
        assigneeId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        users.save(new UserAccount(reporterId, reporterId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        users.save(new UserAccount(assigneeId, assigneeId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        projects.save(new Project(projectId, "API test project"));
        members.save(new ProjectMember(projectId, reporterId));
        members.save(new ProjectMember(projectId, assigneeId));
        reporterToken = jwtService.issue(new AuthPrincipal(reporterId, reporterId + "@example.com", "MEMBER"));
        assigneeToken = jwtService.issue(new AuthPrincipal(assigneeId, assigneeId + "@example.com", "MEMBER"));
    }

    @Test
    void completesTicketCollaborationFlow() throws Exception {
        var createBody = objectMapper.writeValueAsString(new TicketDtos.CreateRequest(
                projectId,
                "API collaboration ticket",
                "Need a comment and a status change.",
                assigneeId
        ));
        var created = mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-create-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.version").value(0))
                .andReturn();
        var ticketId = UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText());

        mockMvc.perform(post("/api/tickets/{id}/comments", ticketId)
                        .header("Authorization", "Bearer " + assigneeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"I picked this up.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("I picked this up."));

        mockMvc.perform(post("/api/tickets/{id}/status", ticketId)
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-status-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(get("/api/tickets/{id}/comments", ticketId)
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.comments[0].body").value("I picked this up."));

        mockMvc.perform(get("/api/tickets/{id}/events", ticketId)
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events[0].toStatus").value("IN_PROGRESS"));

        mockMvc.perform(get("/api/tickets/stats")
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.byStatus.IN_PROGRESS").value(1));

        mockMvc.perform(get("/api/tickets/notifications")
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.notifications[0].type").value("TICKET_COMMENT_ADDED"));
    }

    @Test
    void createsTicketsIdempotentlyAndRejectsReusedKeysForDifferentBodies() throws Exception {
        var request = objectMapper.writeValueAsString(new TicketDtos.CreateRequest(
                projectId, "Idempotent ticket", "Create this only once.", assigneeId
        ));

        var created = mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-create-replay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk())
                .andReturn();
        var ticketId = objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-create-replay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ticketId));

        mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-create-replay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TicketDtos.CreateRequest(
                                projectId, "Changed ticket", "This must conflict.", assigneeId
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));

        mockMvc.perform(post("/api/tickets")
                        .header("Authorization", "Bearer " + reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REQUIRED"));
    }

    @Test
    void listsOnlyVisibleProjectMembersForTicketAssignment() throws Exception {
        mockMvc.perform(get("/api/tickets/members")
                        .param("projectId", projectId.toString())
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(2))
                .andExpect(jsonPath("$.members[?(@.userId == '%s')].email".formatted(assigneeId))
                        .value(assigneeId + "@example.com"));

        var outsiderId = UUID.randomUUID();
        users.save(new UserAccount(outsiderId, outsiderId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        var outsiderToken = jwtService.issue(new AuthPrincipal(outsiderId, outsiderId + "@example.com", "MEMBER"));

        mockMvc.perform(get("/api/tickets/members")
                        .param("projectId", projectId.toString())
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listsAccessibleProjectsAndFiltersTicketsByProject() throws Exception {
        var secondProjectId = UUID.randomUUID();
        var privateProjectId = UUID.randomUUID();
        projects.save(new Project(secondProjectId, "Second project"));
        projects.save(new Project(privateProjectId, "Private project"));
        members.save(new ProjectMember(secondProjectId, reporterId));
        tickets.save(new Ticket(secondProjectId, "Second project ticket", "Visible in the selected project.", reporterId, null));

        mockMvc.perform(get("/api/tickets/projects")
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.length()").value(2))
                .andExpect(jsonPath("$.projects[?(@.id == '%s')].name".formatted(secondProjectId))
                        .value("Second project"));

        mockMvc.perform(get("/api/tickets")
                        .param("projectId", secondProjectId.toString())
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tickets.length()").value(1))
                .andExpect(jsonPath("$.tickets[0].title").value("Second project ticket"));

        mockMvc.perform(get("/api/tickets")
                        .param("projectId", privateProjectId.toString())
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void reassignsTicketsWithHistoryIdempotencyAndReporterPermission() throws Exception {
        var ticket = tickets.save(new Ticket(projectId, "Assignment ticket", "Needs a new owner.", reporterId, null));
        var reassignRequest = "{\"assigneeId\":\"%s\",\"expectedVersion\":0}".formatted(assigneeId);

        mockMvc.perform(post("/api/tickets/{id}/assignee", ticket.getId())
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-assignee-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reassignRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assigneeId").value(assigneeId.toString()))
                .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(post("/api/tickets/{id}/assignee", ticket.getId())
                        .header("Authorization", "Bearer " + reporterToken)
                        .header("Idempotency-Key", "api-test-assignee-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reassignRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(get("/api/tickets/{id}/assignments", ticket.getId())
                        .header("Authorization", "Bearer " + reporterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignments.length()").value(1))
                .andExpect(jsonPath("$.assignments[0].previousAssigneeId").doesNotExist())
                .andExpect(jsonPath("$.assignments[0].assigneeId").value(assigneeId.toString()));

        mockMvc.perform(post("/api/tickets/{id}/assignee", ticket.getId())
                        .header("Authorization", "Bearer " + assigneeToken)
                        .header("Idempotency-Key", "api-test-assignee-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assigneeId\":null,\"expectedVersion\":1}"))
                .andExpect(status().isForbidden());
    }
}
