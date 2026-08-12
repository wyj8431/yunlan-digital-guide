package com.yunlan.platform.ticket;

import com.yunlan.platform.auth.UserAccount;
import com.yunlan.platform.auth.UserAccountRepository;
import com.yunlan.platform.common.security.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
class TicketIdempotencyConcurrencyTest {
    @Autowired
    private TicketService service;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ProjectRepository projects;

    @Autowired
    private ProjectMemberRepository members;

    @Autowired
    private TicketRepository tickets;

    @Autowired
    private TicketEventRepository events;

    @Autowired
    private TicketAssignmentEventRepository assignmentEvents;

    @Test
    void replaysTheSameStatusResultForConcurrentRetriesWithOneIdempotencyKey() throws Exception {
        var userId = UUID.randomUUID();
        var projectId = UUID.randomUUID();
        users.save(new UserAccount(userId, userId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        projects.save(new Project(projectId, "Concurrent idempotency project"));
        members.save(new ProjectMember(projectId, userId));
        var ticket = tickets.save(new Ticket(projectId, "Concurrent status", "Retry safely.", userId, null));
        var principal = new AuthPrincipal(userId, userId + "@example.com", "MEMBER");
        var request = new TicketDtos.ChangeStatusRequest(TicketStatus.IN_PROGRESS, 0L);
        var start = new CountDownLatch(1);
        Callable<TicketDtos.TicketResponse> operation = () -> {
            start.await();
            return service.changeStatus(ticket.getId(), request, "same-status-key", principal);
        };

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(operation);
            var second = executor.submit(operation);
            start.countDown();
            var firstResponse = first.get();
            var secondResponse = second.get();

            assertEquals(TicketStatus.IN_PROGRESS, firstResponse.status());
            assertEquals(TicketStatus.IN_PROGRESS, secondResponse.status());
            assertEquals(1, events.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId()).size());
            assertEquals(1, tickets.findById(ticket.getId()).orElseThrow().getVersion());
        }
    }

    @Test
    void replaysTheSameAssigneeResultForConcurrentRetriesWithOneIdempotencyKey() throws Exception {
        var reporterId = UUID.randomUUID();
        var assigneeId = UUID.randomUUID();
        var projectId = UUID.randomUUID();
        users.save(new UserAccount(reporterId, reporterId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        users.save(new UserAccount(assigneeId, assigneeId + "@example.com", passwordEncoder.encode("secret"), "MEMBER"));
        projects.save(new Project(projectId, "Concurrent assignment project"));
        members.save(new ProjectMember(projectId, reporterId));
        members.save(new ProjectMember(projectId, assigneeId));
        var ticket = tickets.save(new Ticket(projectId, "Concurrent assignment", "Retry safely.", reporterId, null));
        var principal = new AuthPrincipal(reporterId, reporterId + "@example.com", "MEMBER");
        var request = new TicketDtos.ChangeAssigneeRequest(assigneeId, 0L);
        var start = new CountDownLatch(1);
        Callable<TicketDtos.TicketResponse> operation = () -> {
            start.await();
            return service.changeAssignee(ticket.getId(), request, "same-assignee-key", principal);
        };

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(operation);
            var second = executor.submit(operation);
            start.countDown();
            var firstResponse = first.get();
            var secondResponse = second.get();

            assertEquals(assigneeId, firstResponse.assigneeId());
            assertEquals(assigneeId, secondResponse.assigneeId());
            assertEquals(1, assignmentEvents.findAllByTicketIdOrderByCreatedAtAsc(ticket.getId()).size());
            assertEquals(1, tickets.findById(ticket.getId()).orElseThrow().getVersion());
        }
    }
}
